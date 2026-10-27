import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  hashPassword,
  verifyPassword,
} from "../src/modules/auth/password.server";
import { loginSchema } from "../src/modules/auth/validation";
import {
  appOrigin,
  coupleCookie,
  databaseConfig,
  networkIdentity,
} from "../src/lib/config.server";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as session } from "../src/app/api/auth/session/route";

process.env.APP_ORIGIN = "http://localhost:3000";
function request(
  body: string,
  origin: string | null = "http://localhost:3000",
  type = "application/json",
) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": type, ...(origin ? { Origin: origin } : {}) },
    body,
  });
}
test("Argon2id verifies exact passwords without trimming and rejects wrong/unknown accounts", async (t) => {
  const start = performance.now();
  const password = "test-only password with spaces ";
  const encoded = await hashPassword(password);
  t.diagnostic(
    `Argon2id hash on this host: ${Math.round(performance.now() - start)}ms; deployment benchmarking remains required.`,
  );
  assert.match(encoded, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(encoded, password), true);
  assert.equal(await verifyPassword(encoded, password.trim()), false);
  assert.equal(await verifyPassword(undefined, password), false);
  assert.throws(() => hashPassword("short"));
});
test("validation normalizes email only and rejects injected/unknown fields", () => {
  const password = " untrimmed password ";
  assert.deepEqual(
    loginSchema.parse({ email: " COUPLE@example.test ", password }),
    { email: "couple@example.test", password },
  );
  assert.equal(
    loginSchema.safeParse({ email: { $ne: null }, password }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({
      email: "x@example.test",
      password,
      weddingId: "foreign",
    }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({
      email: "x@example.test",
      password: "x".repeat(129),
    }).success,
    false,
  );
});
test("origin/media/body validation rejects before database access", async () => {
  assert.equal(
    (await login(request("{}", "https://evil.example"))).status,
    403,
  );
  assert.equal((await login(request("{}", null))).status, 403);
  assert.equal(
    (await login(request("{}", "http://localhost:3000", "text/plain"))).status,
    415,
  );
  assert.equal((await login(request("{"))).status, 400);
  assert.equal(
    (
      await login(
        request(
          JSON.stringify({
            email: "x@example.test",
            password: "x".repeat(70000),
          }),
        ),
      )
    ).status,
    413,
  );
  // Schema rejection occurs before any connection.
  process.env.RATE_LIMIT_SECRET = "test-only-secret-at-least-32-characters";
  assert.equal(
    (
      await login(
        request(
          JSON.stringify({
            email: "x@example.test",
            password: "password",
            foreign: "x",
          }),
        ),
      )
    ).status,
    400,
  );
});
test("missing sessions, malformed tokens, guest-only cookies and bodyless logout need no database", async () => {
  for (const cookie of [
    "",
    "mmm_dev_couple_session=invalid",
    "__Host-guest_session=guest-token",
  ]) {
    const response = await session(
      new NextRequest("http://localhost:3000/api/auth/session", {
        headers: { Cookie: cookie },
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  const response = await logout(
    new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.equal(
    (
      await logout(
        new NextRequest("http://localhost:3000/api/auth/logout", {
          method: "POST",
        }),
      )
    ).status,
    403,
  );
});
test("configuration rejects unsafe origins/production fallback and selects HTTPS cookie policy", () => {
  process.env.APP_ORIGIN = "https://wedding.example";
  assert.equal(appOrigin(), "https://wedding.example");
  assert.deepEqual(coupleCookie(), {
    name: "__Host-couple_session",
    secure: true,
  });
  process.env.APP_ORIGIN = "http://external.example";
  assert.throws(appOrigin);
  process.env.APP_ORIGIN = "https://wedding.example/path";
  assert.throws(appOrigin);
  process.env.APP_ORIGIN = "http://localhost:3000";
  assert.deepEqual(coupleCookie(), {
    name: "mmm_dev_couple_session",
    secure: false,
  });
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.MONGODB_DB = "production";
  assert.throws(databaseConfig);
  process.env.MONGODB_DB = "mmm_dev";
  assert.equal(databaseConfig().name, "mmm_dev");
  assert.equal(
    networkIdentity(new Headers({ "x-forwarded-for": "1.2.3.4" })),
    "local-or-untrusted-proxy",
  );
  delete process.env.MONGODB_URI;
});
test("missing configuration returns a safe 503, not an authenticated success", async () => {
  delete process.env.MONGODB_URI;
  const response = await login(
    request(
      JSON.stringify({
        email: "x@example.test",
        password: "test-only-password",
      }),
    ),
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(JSON.stringify(body).includes("test-only-password"), false);
});

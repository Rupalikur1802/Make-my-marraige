import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { join } from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { NextRequest } from "next/server";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.server";
import { authModels } from "../src/modules/auth/models.server";
import { weddingModel } from "../src/modules/wedding/model.server";
import {
  ensureAuthIndexes,
  provisionCouple,
} from "../src/modules/auth/provision.server";
import {
  loginCouple,
  logoutCouple,
  resolveCoupleSession,
  tokenDigest,
} from "../src/modules/auth/service.server";
import { throttleLogin } from "../src/modules/auth/rate-limit.server";
import { coupleCookie, networkIdentity } from "../src/lib/config.server";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as session } from "../src/app/api/auth/session/route";

let mongo: MongoMemoryReplSet;
const password = "test-only-wedding-password";
const email = "couple@example.test";
before(
  async () => {
    // Always create a private local replica set. Never load .env or reuse an Atlas URI.
    mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "auth-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_auth";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.RATE_LIMIT_SECRET =
      "test-only-rate-limit-secret-at-least-32-characters";
    await ensureAuthIndexes();
    await provisionCouple(email, password);
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
function request(
  path: string,
  options: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {},
) {
  return new NextRequest("http://localhost:3000" + path, options);
}
function loginRequest(
  body: unknown,
  origin: string | null = "http://localhost:3000",
) {
  return request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}
test("provisioning enforces one account/wedding pair and duplicate email rolls back", async () => {
  const db = await connectDatabase();
  const { Account } = authModels(db);
  const weddingCount = await weddingModel(db).countDocuments();
  await assert.rejects(provisionCouple(" COUPLE@example.test ", password));
  assert.equal(await weddingModel(db).countDocuments(), weddingCount);
  const account = await Account.findOne({ emailNormalized: email })
    .select("+passwordHash")
    .lean();
  assert.ok(account);
  assert.match(account.passwordHash, /^\$argon2id\$/);
  assert.notEqual(account.passwordHash, password);
  assert.ok(
    await weddingModel(db).findOne({
      _id: account.weddingId,
      ownerAccountId: account._id,
    }),
  );
});
test("multi-device sessions store only hashes; logout revokes one device", async () => {
  const first = await loginCouple({ email, password }, "device-test");
  const second = await loginCouple({ email, password }, "device-test");
  assert.notEqual(first.token, second.token);
  const { Session } = authModels(await connectDatabase());
  const saved = await Session.findOne({ tokenHash: tokenDigest(first.token) })
    .select("+tokenHash")
    .lean();
  assert.ok(saved);
  assert.notEqual(saved.tokenHash, first.token);
  assert.equal((await resolveCoupleSession(first.token))?.account.email, email);
  await logoutCouple(first.token);
  assert.equal(await resolveCoupleSession(first.token), null);
  assert.ok(await resolveCoupleSession(second.token));
  await logoutCouple(first.token);
});
test("application expiry rejects a record that TTL has not cleaned up", async () => {
  const issued = await loginCouple({ email, password }, "expiry-test");
  const { Session } = authModels(await connectDatabase());
  const future = new Date(Date.parse(issued.data.expiresAt) + 1);
  assert.equal(await resolveCoupleSession(issued.token, future), null);
  assert.ok(await Session.findOne({ tokenHash: tokenDigest(issued.token) }));
});
test("session requires current account version and reciprocal wedding ownership", async () => {
  const issued = await loginCouple({ email, password }, "version-test");
  const { Account } = authModels(await connectDatabase());
  await Account.updateOne(
    { _id: issued.data.account.id },
    { $inc: { authVersion: 1 } },
  );
  assert.equal(await resolveCoupleSession(issued.token), null);
  const current = await loginCouple({ email, password }, "ownership-test");
  const other = await provisionCouple("other@example.test", password);
  // A forged session tenant must never authorize a different wedding.
  const { Session } = authModels(await connectDatabase());
  await Session.updateOne(
    { tokenHash: tokenDigest(current.token) },
    { $set: { weddingId: other.weddingId } },
  );
  assert.equal(await resolveCoupleSession(current.token), null);
});
test("login rejects unknown fields, cross-origin, missing origin, malformed and oversized input", async () => {
  assert.equal(
    (await login(loginRequest({ email, password, weddingId: "foreign" })))
      .status,
    400,
  );
  assert.equal(
    (await login(loginRequest({ email, password }, "https://evil.example")))
      .status,
    403,
  );
  assert.equal(
    (await login(loginRequest({ email, password }, null))).status,
    403,
  );
  assert.equal(
    (
      await login(
        request("/api/auth/login", {
          method: "POST",
          headers: {
            Origin: "http://localhost:3000",
            "Content-Type": "application/json",
          },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await login(loginRequest({ email, password: "x".repeat(70000) }))).status,
    413,
  );
  assert.equal(
    (
      await login(
        request("/api/auth/login", {
          method: "POST",
          headers: {
            Origin: "http://localhost:3000",
            "Content-Type": "text/plain",
          },
          body: "email=x",
        }),
      )
    ).status,
    415,
  );
});
test("wrong password and unknown account use identical public responses", async () => {
  const wrong = await login(loginRequest({ email, password: "wrong" }));
  const unknown = await login(
    loginRequest({ email: "missing@example.test", password: "wrong" }),
  );
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual((await wrong.json()).error, (await unknown.json()).error);
});
test("cookies, safe DTOs, no-store, HTTPS settings, session and bodyless logout", async () => {
  const response = await login(
    loginRequest({ email: " COUPLE@example.test ", password }),
  );
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=lax/i);
  assert.doesNotMatch(header, /Domain=/i);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.data.account.email, email);
  assert.equal(body.data.token, undefined);
  assert.equal(body.data.passwordHash, undefined);
  const cookie = header.split(";")[0]!;
  const read = await session(
    request("/api/auth/session", { headers: { Cookie: cookie } }),
  );
  assert.equal(read.status, 200);
  assert.equal((await session(request("/api/auth/session"))).status, 401);
  const end = await logout(
    request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:3000", Cookie: cookie },
    }),
  );
  assert.equal(end.status, 204);
  assert.match(end.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.equal(
    (
      await session(
        request("/api/auth/session", { headers: { Cookie: cookie } }),
      )
    ).status,
    401,
  );
  process.env.APP_ORIGIN = "https://wedding.example";
  assert.deepEqual(coupleCookie(), {
    name: "__Host-couple_session",
    secure: true,
  });
  process.env.APP_ORIGIN = "http://localhost:3000";
  assert.equal(
    networkIdentity(new Headers({ "x-forwarded-for": "attacker-controlled" })),
    "local-or-untrusted-proxy",
  );
});
test("shared rate limits remain bounded under concurrent attempts and roll over by time", async () => {
  const db = await connectDatabase();
  const now = new Date();
  const results = await Promise.allSettled(
    Array.from({ length: 15 }, () =>
      throttleLogin(db, "limited@example.test", "concurrent", now),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    10,
  );
  const { RateLimit } = authModels(db);
  assert.equal(await RateLimit.countDocuments({ count: { $gt: 50 } }), 0);
  await throttleLogin(
    db,
    "limited@example.test",
    "concurrent",
    new Date(now.getTime() + 16 * 60 * 1000),
  );
});
test("missing database configuration fails closed and does not return login success", async () => {
  await disconnectDatabase();
  const previous = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  const response = await login(loginRequest({ email, password }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
  process.env.MONGODB_URI = previous;
});

test("public signup validates, persists ownership, rejects duplicates and supports login", async () => {
  const { POST: signup } = await import("../src/app/api/auth/signup/route");
  const send = (body: unknown, origin = "http://localhost:3000") =>
    signup(
      new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const data = {
    email: " NEW@example.test ",
    password,
    confirmPassword: password,
  };
  assert.equal((await send(data, "https://evil.example")).status, 403);
  assert.equal(
    (await send({ ...data, password: "short", confirmPassword: "short" }))
      .status,
    400,
  );
  assert.equal(
    (await send({ ...data, confirmPassword: "different-password" })).status,
    400,
  );
  assert.equal((await send({ ...data, weddingId: "untrusted" })).status, 400);
  const db = await connectDatabase();
  const weddings = weddingModel(db);
  const beforeCount = await weddings.countDocuments();
  const created = await send(data);
  assert.equal(created.status, 201);
  assert.deepEqual((await created.json()).data, { created: true });
  assert.equal(created.headers.get("set-cookie"), null);
  assert.equal(await weddings.countDocuments(), beforeCount + 1);
  const duplicate = await Promise.all([send(data), send(data)]);
  assert.ok(duplicate.every((response) => response.status === 409));
  assert.equal(await weddings.countDocuments(), beforeCount + 1);
  const loggedIn = await loginCouple(
    { email: "new@example.test", password },
    "signup-test",
  );
  const actor = await resolveCoupleSession(loggedIn.token);
  assert.ok(actor);
  assert.ok(
    await weddings.findOne({
      _id: actor.weddingId,
      ownerAccountId: actor.account.id,
    }),
  );
  await logoutCouple(loggedIn.token);
});

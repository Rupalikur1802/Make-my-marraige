import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import {
  ensureAuthIndexes,
  provisionCouple,
} from "../src/modules/auth/provision.server";
import { disconnectDatabase } from "../src/lib/db.server";

test(
  "built application serves public pages and performs database-backed login, refresh and logout over HTTP",
  { timeout: 120000 },
  async () => {
    const listener = createServer();
    await new Promise<void>((resolve) =>
      listener.listen(0, "127.0.0.1", resolve),
    );
    const address = listener.address();
    if (!address || typeof address === "string")
      throw new Error("No test port available");
    const port = address.port;
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
    mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
    const mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "http-db-")) },
      ],
    });
    const origin = `http://127.0.0.1:${port}`;
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_http";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "http-test-only-secret-at-least-32-characters";
    let server: ReturnType<typeof spawn> | undefined;
    try {
      await ensureAuthIndexes();
      await provisionCouple(
        "http-couple@example.test",
        "test-only-http-password",
      );
      server = spawn(
        process.execPath,
        [
          join(process.cwd(), "node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: "production" },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let failure = "";
      server.stderr?.on("data", (chunk) => {
        failure = (failure + String(chunk)).slice(-3000);
      });
      server.stdout?.on("data", () => undefined);
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null)
          throw new Error(
            "Built Next.js server exited before startup: " + failure,
          );
        try {
          const response = await fetch(origin, {
            signal: AbortSignal.timeout(2000),
          });
          if (response.status === 200) {
            ready = true;
            break;
          }
        } catch {}
        await delay(250);
      }
      assert.ok(ready, "Production server must start");
      const publicPage = await fetch(origin);
      assert.match(await publicPage.text(), /Beautiful/);
      const loginPage = await fetch(origin + "/login");
      assert.equal(loginPage.status, 200);
      const loginHtml = await loginPage.text();
      assert.match(loginHtml, /Welcome back/);
      assert.match(loginHtml, /autocomplete="current-password"/i);
      assert.doesNotMatch(loginHtml, /value="ceremony-at-udaivilas"/);
      const signupPage = await fetch(origin + "/signup");
      assert.equal(signupPage.status, 200);
      const signupHtml = await signupPage.text();
      assert.match(signupHtml, /Create account/);
      assert.match(signupHtml, /autocomplete="new-password"/i);
      const signup = await fetch(origin + "/api/auth/signup", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "signup-http@example.test",
          password: "test-only-http-password",
          confirmPassword: "test-only-http-password",
        }),
      });
      assert.equal(signup.status, 201);
      const signupLogin = await fetch(origin + "/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "signup-http@example.test",
          password: "test-only-http-password",
        }),
      });
      assert.equal(signupLogin.status, 200);
      const signupWorkspace = await fetch(origin + "/workspace", {
        headers: {
          Cookie: signupLogin.headers.get("set-cookie")!.split(";")[0]!,
        },
      });
      assert.equal(signupWorkspace.status, 200);
      assert.match(await signupWorkspace.text(), /signup-http@example.test/);
      const illustration = await fetch(origin + "/images/couple-login.jpg");
      assert.equal(illustration.status, 200);
      const protectedResponse = await fetch(origin + "/workspace", {
        redirect: "manual",
      });
      assert.equal(protectedResponse.status, 307);
      assert.match(protectedResponse.headers.get("location")!, /\/login$/);
      const rejected = await fetch(origin + "/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      assert.equal(rejected.status, 403);
      const signedIn = await fetch(origin + "/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "http-couple@example.test",
          password: "test-only-http-password",
        }),
      });
      assert.equal(signedIn.status, 200);
      const cookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
      assert.match(signedIn.headers.get("set-cookie")!, /HttpOnly/i);
      for (let refresh = 0; refresh < 2; refresh++) {
        const workspace = await fetch(origin + "/workspace", {
          headers: { Cookie: cookie },
        });
        assert.equal(workspace.status, 200);
        assert.match(await workspace.text(), /http-couple@example.test/);
        assert.match(workspace.headers.get("cache-control")!, /no-store/);
      }
      const session = await fetch(origin + "/api/auth/session", {
        headers: { Cookie: cookie },
      });
      assert.equal(session.status, 200);
      const signout = await fetch(origin + "/api/auth/logout", {
        method: "POST",
        headers: { Origin: origin, Cookie: cookie },
      });
      assert.equal(signout.status, 204);
      const revoked = await fetch(origin + "/api/auth/session", {
        headers: { Cookie: cookie },
      });
      assert.equal(revoked.status, 401);
      const returnToPrivate = await fetch(origin + "/workspace", {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      assert.equal(returnToPrivate.status, 307);
    } finally {
      if (server && server.exitCode === null) {
        const stopped = new Promise<void>((resolve) =>
          server!.once("exit", () => resolve()),
        );
        server.kill();
        await stopped;
      }
      await disconnectDatabase();
      await mongo.stop();
    }
  },
);

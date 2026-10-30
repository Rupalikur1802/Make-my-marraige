import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
    process.env.INVITATION_EMAIL_ENABLED = "false";
    process.env.RESEND_API_KEY = "test-only-not-live";
    process.env.EMAIL_FROM = "fixture-sender@example.test";
    process.env.CLOUDINARY_CLOUD_NAME = "http-fixture-only";
    process.env.CLOUDINARY_API_KEY = "http-fixture-key";
    process.env.CLOUDINARY_API_SECRET = "http-fixture-secret";
    process.env.CLOUDINARY_PHOTO_PREFIX = "mmm_test_http_photos";
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
      assert.match(await signupWorkspace.text(), /\/wedding\/setup/);
      const illustration = await fetch(origin + "/images/couple-login.jpg");
      assert.equal(illustration.status, 200);
      const protectedResponse = await fetch(origin + "/workspace", {
        redirect: "manual",
      });
      assert.ok([200, 307].includes(protectedResponse.status));
      assert.match(
        protectedResponse.headers.get("location") ??
          (await protectedResponse.text()),
        /\/login/,
      );
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
        assert.match(await workspace.text(), /\/wedding\/setup/);
        assert.match(workspace.headers.get("cache-control")!, /no-store/);
      }
      const session = await fetch(origin + "/api/auth/session", {
        headers: { Cookie: cookie },
      });
      assert.equal(session.status, 200);
      const setupPage = await fetch(origin + "/wedding/setup", {
        headers: { Cookie: cookie },
      });
      assert.equal(setupPage.status, 200);
      assert.equal(setupPage.headers.get("referrer-policy"), "no-referrer");
      assert.match(setupPage.headers.get("cache-control")!, /no-store/);
      assert.match(await setupPage.text(), /Let’s start with your celebration/);
      const weddingBefore = await fetch(origin + "/api/wedding", {
        headers: { Cookie: cookie },
      });
      assert.equal(weddingBefore.status, 200);
      assert.equal((await weddingBefore.json()).data.setupStatus, "draft");
      const patchWedding = (body: unknown) =>
        fetch(origin + "/api/wedding", {
          method: "PATCH",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const draft = await patchWedding({
        expectedVersion: 0,
        groomName: "Arjun",
        brideName: "Priya",
      });
      assert.equal(draft.status, 200);
      const resumed = await fetch(origin + "/wedding/setup", {
        headers: { Cookie: cookie },
      });
      assert.match(await resumed.text(), /value="Arjun"/);
      const completed = await patchWedding({
        expectedVersion: 1,
        setupStatus: "complete",
        weddingDate: "2026-12-10",
        venue: "Test-only wedding hall",
      });
      assert.equal(completed.status, 200);
      const overview = await fetch(origin + "/workspace", {
        headers: { Cookie: cookie },
      });
      assert.equal(overview.status, 200);
      const overviewHtml = await overview.text();
      assert.match(overviewHtml, /at a glance/);
      assert.match(overviewHtml, /Test-only wedding hall/);
      assert.match(overviewHtml, /No published ceremonies yet/);
      for (const label of [
        "Dashboard",
        "Events",
        "Tasks",
        "Expenses",
        "Guests",
        "Invitation",
        "Photos",
        "Settings",
      ])
        assert.ok(overviewHtml.includes(label), `Sidebar includes ${label}`);
      assert.match(overviewHtml, /href="\/photos"/);
      const photosPage = await fetch(origin + "/photos", {
        headers: { Cookie: cookie },
      });
      assert.equal(photosPage.status, 200);
      const photosHtml = await photosPage.text();
      assert.match(photosHtml, /Your wedding memories start here/);
      assert.match(photosHtml, /Allow guest photo access/);
      assert.ok(!photosHtml.includes("http-fixture-secret"));
      const photosApi = await fetch(origin + "/api/photos", {
        headers: { Cookie: cookie },
      });
      assert.equal(photosApi.status, 200);
      assert.equal((await photosApi.json()).data.guestAccess, true);
      assert.equal((await fetch(origin + "/api/photos")).status, 401);
      const taskCreated = await fetch(origin + "/api/tasks", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          title: "Verify task planner",
          assigneeName: "Family",
          dueDate: "2026-10-01",
          notes: "Disposable HTTP fixture",
        }),
      });
      assert.equal(taskCreated.status, 201);
      const taskRecord = (await taskCreated.json()).data;
      const taskPage = await fetch(origin + "/tasks", {
        headers: { Cookie: cookie },
      });
      const taskHtml = await taskPage.text();
      assert.match(taskHtml, /Tasks &amp; responsibilities/);
      assert.match(taskHtml, /Verify task planner/);
      assert.match(taskPage.headers.get("cache-control")!, /no-store/);
      const taskDashboard = await fetch(origin + "/api/dashboard", {
        headers: { Cookie: cookie },
      });
      assert.equal((await taskDashboard.json()).data.tasks.pending, 1);
      const taskUpdated = await fetch(origin + "/api/tasks/" + taskRecord.id, {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expectedVersion: 0, status: "completed" }),
      });
      assert.equal(taskUpdated.status, 200);
      assert.equal((await taskUpdated.json()).data.isOverdue, false);
      const taskDeleted = await fetch(
        origin + "/api/tasks/" + taskRecord.id + "?expectedVersion=1",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(taskDeleted.status, 204);
      const expenseKey = randomUUID();
      const expenseBody = {
        description: "HTTP recorded payment",
        amountPaise: 29,
        spentOn: "2026-10-01",
        payerName: "Bride",
      };
      const recordPayment = () =>
        fetch(origin + "/api/expenses", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
            "Idempotency-Key": expenseKey,
          },
          body: JSON.stringify(expenseBody),
        });
      const expenseCreated = await recordPayment();
      assert.equal(expenseCreated.status, 201);
      const expenseRecord = (await expenseCreated.json()).data;
      const expenseReplay = await recordPayment();
      assert.equal(expenseReplay.status, 200);
      assert.equal(expenseReplay.headers.get("Idempotency-Replayed"), "true");
      const expensePage = await fetch(origin + "/expenses", {
        headers: { Cookie: cookie },
      });
      const expenseHtml = await expensePage.text();
      assert.match(expenseHtml, /Expenses &amp; spending/);
      assert.match(expenseHtml, /HTTP recorded payment/);
      assert.match(expenseHtml, /₹0\.29/);
      const spendingDashboard = await fetch(origin + "/api/dashboard", {
        headers: { Cookie: cookie },
      });
      assert.equal(
        (await spendingDashboard.json()).data.expenses.totalPaise,
        29,
      );
      const summaryExpense = await fetch(
        origin + "/api/expenses/summary?payerKey=bride",
        { headers: { Cookie: cookie } },
      );
      assert.equal((await summaryExpense.json()).data.totalPaise, 29);
      const expenseChanged = await fetch(
        origin + "/api/expenses/" + expenseRecord.id,
        {
          method: "PATCH",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 0, amountPaise: 101 }),
        },
      );
      assert.equal(expenseChanged.status, 200);
      const expenseRemoved = await fetch(
        origin + "/api/expenses/" + expenseRecord.id + "?expectedVersion=1",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(expenseRemoved.status, 204);
      const invitationDirectory = await fetch(
        origin + "/families?section=invitations",
        { headers: { Cookie: cookie } },
      );
      assert.equal(invitationDirectory.status, 200);
      const invitationDirectoryHtml = await invitationDirectory.text();
      assert.match(invitationDirectoryHtml, /<h1>Invitations<\/h1>/);
      assert.doesNotMatch(invitationDirectoryHtml, /Unable to load families/);
      const stale = await patchWedding({
        expectedVersion: 1,
        venue: "Stale overwrite",
      });
      assert.equal(stale.status, 409);
      const edited = await patchWedding({
        expectedVersion: 2,
        venue: "Updated wedding hall",
      });
      assert.equal(edited.status, 200);
      const refreshed = await fetch(origin + "/workspace", {
        headers: { Cookie: cookie },
      });
      assert.match(await refreshed.text(), /Updated wedding hall/);
      const ceremoniesResponse = await fetch(origin + "/api/events", {
        headers: { Cookie: cookie },
      });
      assert.equal(ceremoniesResponse.status, 200);
      const ceremonies = (await ceremoniesResponse.json()).data;
      assert.equal(ceremonies.length, 6);
      const ceremony = ceremonies.find(
        (event: { presetKey: string }) => event.presetKey === "sangeet",
      );
      assert.ok(ceremony);
      const listPage = await fetch(origin + "/ceremonies", {
        headers: { Cookie: cookie },
      });
      assert.equal(listPage.status, 200);
      assert.equal(listPage.headers.get("referrer-policy"), "no-referrer");
      assert.match(await listPage.text(), /Manage your ceremonies/);
      const editorPage = await fetch(origin + "/ceremonies/" + ceremony.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(editorPage.status, 200);
      assert.match(await editorPage.text(), /Time.*IST/);
      const patchCeremony = (body: unknown) =>
        fetch(origin + "/api/events/" + ceremony.id, {
          method: "PATCH",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const incomplete = await patchCeremony({
        expectedVersion: 0,
        status: "published",
      });
      assert.equal(incomplete.status, 400);
      const publishedCeremony = await patchCeremony({
        expectedVersion: 0,
        name: "Sangeet Sandhya",
        status: "published",
        startsAt: "2026-12-09T18:45:00.000Z",
        venue: "Test ballroom",
      });
      assert.equal(publishedCeremony.status, 200);
      const publishedList = await fetch(origin + "/ceremonies", {
        headers: { Cookie: cookie },
      });
      const publishedHtml = await publishedList.text();
      assert.match(publishedHtml, /Sangeet Sandhya/);
      assert.match(publishedHtml, /Test ballroom/);
      assert.match(publishedHtml, /IST/);
      const staleCeremony = await patchCeremony({
        expectedVersion: 0,
        name: "Stale ceremony",
      });
      assert.equal(staleCeremony.status, 409);
      const movedToDraft = await patchCeremony({
        expectedVersion: 1,
        status: "draft",
      });
      assert.equal(movedToDraft.status, 200);
      const movedData = (await movedToDraft.json()).data;
      assert.equal(movedData.startsAt, "2026-12-09T18:45:00.000Z");
      assert.equal(movedData.venue, "Test ballroom");
      const creationKey = randomUUID();
      const createDraft = () =>
        fetch(origin + "/api/events", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
            "Idempotency-Key": creationKey,
          },
          body: JSON.stringify({
            name: "Welcome Dinner",
            venue: "Sunset Lawns",
          }),
        });
      const created = await createDraft();
      assert.equal(created.status, 201);
      const custom = (await created.json()).data;
      assert.equal(custom.presetKey, null);
      assert.equal(custom.status, "draft");
      const replayed = await createDraft();
      assert.equal((await replayed.json()).data.id, custom.id);
      const customPage = await fetch(origin + "/ceremonies/" + custom.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(customPage.status, 200);
      assert.match(await customPage.text(), /Custom ceremony/);
      const customPublished = await fetch(origin + "/api/events/" + custom.id, {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: 0,
          status: "published",
          startsAt: "2026-12-08T13:00:00.000Z",
        }),
      });
      assert.equal(customPublished.status, 200);
      const staleDelete = await fetch(
        origin + "/api/events/" + custom.id + "?expectedVersion=0",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(staleDelete.status, 409);
      const deleted = await fetch(
        origin + "/api/events/" + custom.id + "?expectedVersion=1",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(deleted.status, 204);
      const missing = await fetch(origin + "/api/events/" + custom.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(missing.status, 404);
      const afterDelete = await fetch(origin + "/api/events", {
        headers: { Cookie: cookie },
      });
      assert.equal((await afterDelete.json()).data.length, 6);
      const familyHeaders = {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      };
      const newFamilyPage = await fetch(origin + "/families/new", {
        headers: { Cookie: cookie },
      });
      assert.equal(newFamilyPage.status, 200);
      assert.match(await newFamilyPage.text(), /Add family/);
      const familyCreated = await fetch(origin + "/api/families", {
        method: "POST",
        headers: familyHeaders,
        body: JSON.stringify({
          name: "HTTP Fixture Family",
          email: "sharma@example.test",
          invitedCount: 4,
          eventIds: [ceremony.id],
        }),
      });
      assert.equal(familyCreated.status, 201);
      const family = (await familyCreated.json()).data;
      assert.equal(family.email, "sharma@example.test");
      assert.equal(family.eventAssignments.length, 1);
      const familiesPage = await fetch(origin + "/families?q=HTTP&eventId=", {
        headers: { Cookie: cookie },
      });
      assert.equal(familiesPage.status, 200);
      assert.equal(familiesPage.headers.get("referrer-policy"), "no-referrer");
      assert.match(await familiesPage.text(), /HTTP Fixture Family/);
      const familyPage = await fetch(origin + "/families/" + family.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(familyPage.status, 200);
      const familyHtml = await familyPage.text();
      assert.match(familyHtml, /value="HTTP Fixture Family"/);
      assert.match(familyHtml, /value="sharma@example.test"/);
      const byEmail = await fetch(origin + "/api/families?q=SHARMA%40EXAMPLE", {
        headers: { Cookie: cookie },
      });
      assert.equal(byEmail.status, 200);
      assert.equal((await byEmail.json()).data[0].id, family.id);
      const familyPatched = await fetch(origin + "/api/families/" + family.id, {
        method: "PATCH",
        headers: familyHeaders,
        body: JSON.stringify({
          expectedRevision: 0,
          name: "Edited HTTP Family",
        }),
      });
      assert.equal(familyPatched.status, 200);
      const familyAssignments = await fetch(
        origin + "/api/families/" + family.id + "/events",
        {
          method: "PUT",
          headers: familyHeaders,
          body: JSON.stringify({
            expectedRevision: 1,
            eventIds: [],
            confirmResponseRemoval: true,
          }),
        },
      );
      assert.equal(familyAssignments.status, 200);
      assert.equal(
        (await familyAssignments.json()).data.eventAssignments.length,
        0,
      );
      const staleFamilyDelete = await fetch(
        origin + "/api/families/" + family.id + "?expectedRevision=1",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(staleFamilyDelete.status, 409);
      const deletedFamily = await fetch(
        origin + "/api/families/" + family.id + "?expectedRevision=2",
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(deletedFamily.status, 204);
      const missingFamily = await fetch(origin + "/api/families/" + family.id, {
        headers: { Cookie: cookie },
      });
      assert.equal(missingFamily.status, 404);
      const inviteFamilyResponse = await fetch(origin + "/api/families", {
        method: "POST",
        headers: familyHeaders,
        body: JSON.stringify({
          name: "HTTP Invitation Family",
          email: "invitation@example.test",
          invitedCount: 3,
          eventIds: [ceremony.id],
        }),
      });
      assert.equal(inviteFamilyResponse.status, 201);
      const inviteFamily = (await inviteFamilyResponse.json()).data;
      // The earlier unpublish test intentionally left this ceremony in draft.
      const currentCeremonyResponse = await fetch(
        origin + "/api/events/" + ceremony.id,
        { headers: { Cookie: cookie } },
      );
      const currentCeremony = (await currentCeremonyResponse.json()).data;
      const republished = await fetch(origin + "/api/events/" + ceremony.id, {
        method: "PATCH",
        headers: familyHeaders,
        body: JSON.stringify({
          expectedVersion: currentCeremony.version,
          status: "published",
        }),
      });
      assert.equal(republished.status, 200);
      const invitationPath = "/api/families/" + inviteFamily.id;
      const managePage = await fetch(
        origin + "/families/" + inviteFamily.id + "/invitation",
        { headers: { Cookie: cookie } },
      );
      assert.equal(managePage.status, 200);
      assert.match(await managePage.text(), /Generate invitation link/);
      const generated = await fetch(
        origin + invitationPath + "/invitation-link",
        {
          method: "POST",
          headers: familyHeaders,
          body: JSON.stringify({ expectedRevision: 0 }),
        },
      );
      assert.equal(generated.status, 200);
      const link = (await generated.json()).data.invitationUrl;
      const token = new URLSearchParams(new URL(link).hash.slice(1)).get(
        "token",
      );
      assert.ok(token);
      assert.equal(new URL(link).pathname, "/invite");
      const landing = await fetch(origin + "/invite");
      assert.equal(landing.status, 200);
      assert.equal((await landing.text()).includes(token), false);
      assert.equal(landing.headers.get("referrer-policy"), "no-referrer");
      const opened = await fetch(origin + "/api/guest/exchange", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      assert.equal(opened.status, 200);
      const guestCookie = opened.headers.get("set-cookie")!.split(";")[0]!;
      assert.match(opened.headers.get("set-cookie")!, /HttpOnly/);
      const guestData = await fetch(origin + "/api/guest/invitation", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestData.status, 200);
      const invitation = (await guestData.json()).data;
      assert.equal(invitation.family.name, "HTTP Invitation Family");
      assert.equal(invitation.events.length, 1);
      assert.equal("email" in invitation.family, false);
      const guestPage = await fetch(origin + "/guest", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestPage.status, 200);
      const guestHtml = await guestPage.text();
      assert.match(guestHtml, /HTTP Invitation Family/);
      assert.match(guestHtml, /Accept invitation/);
      assert.match(guestHtml, /Your attendance/);
      assert.match(guestHtml, /Save response/);
      assert.match(guestHtml, /Open wedding photos/);
      const guestPhotos = await fetch(origin + "/guest/photos", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestPhotos.status, 200);
      assert.match(await guestPhotos.text(), /Be the first to share a memory/);
      const pausedPhotos = await fetch(origin + "/api/photos/settings", {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ guestAccess: false, expectedVersion: 0 }),
      });
      assert.equal(pausedPhotos.status, 200);
      const guestPhotosBlocked = await fetch(origin + "/api/guest/photos", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestPhotosBlocked.status, 403);
      assert.equal(
        (await guestPhotosBlocked.json()).error.code,
        "PHOTO_ACCESS_PAUSED",
      );
      assert.equal(
        (
          await fetch(origin + "/api/photos/settings", {
            method: "PATCH",
            headers: {
              Cookie: cookie,
              Origin: origin,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ guestAccess: true, expectedVersion: 1 }),
          })
        ).status,
        200,
      );
      assert.equal(invitation.family.invitationAcceptedAt, null);
      const acceptance = await fetch(origin + "/api/guest/accept", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: guestCookie,
        },
        body: "{}",
      });
      assert.equal(acceptance.status, 200);
      const acceptedAt = (await acceptance.json()).data.family
        .invitationAcceptedAt;
      assert.ok(acceptedAt);
      const coupleFamily = await fetch(origin + invitationPath, {
        headers: { Cookie: cookie },
      });
      assert.equal(
        (await coupleFamily.json()).data.invitationAcceptedAt,
        acceptedAt,
      );
      const acceptedRows = await fetch(
        origin + "/families?section=invitations",
        {
          headers: { Cookie: cookie },
        },
      );
      const invitationRowsHtml = await acceptedRows.text();
      assert.match(invitationRowsHtml, /Accepted/);
      assert.match(invitationRowsHtml, /Invitation sending and acceptance/);
      assert.doesNotMatch(
        invitationRowsHtml,
        /Saved family records and ceremony assignments/,
      );
      const rsvpPath = "/api/guest/rsvp/" + invitation.events[0].invitation.id;
      const rsvpHeaders = {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: guestCookie,
      };
      const rsvpSave = await fetch(origin + rsvpPath, {
        method: "PUT",
        headers: rsvpHeaders,
        body: JSON.stringify({
          expectedVersion: 0,
          status: "attending",
          attendingCount: 2,
        }),
      });
      assert.equal(rsvpSave.status, 200);
      assert.equal((await rsvpSave.json()).data.version, 1);
      const summary = await fetch(
        origin + "/api/attendance?eventId=" + invitation.events[0].id,
        { headers: { Cookie: cookie } },
      );
      assert.equal(summary.status, 200);
      assert.equal((await summary.json()).data.summary.confirmedGuests, 2);
      const guestDirectory = await fetch(origin + "/families", {
        headers: { Cookie: cookie },
      });
      const guestDirectoryHtml = await guestDirectory.text();
      assert.match(guestDirectoryHtml, /<h1>Guests<\/h1>/);
      assert.match(guestDirectoryHtml, /Attending/);
      assert.doesNotMatch(
        guestDirectoryHtml,
        /Invitation sending and acceptance/,
      );
      const attendancePage = await fetch(
        origin + "/attendance?eventId=" + invitation.events[0].id,
        { headers: { Cookie: cookie } },
      );
      assert.equal(attendancePage.status, 200);
      assert.match(attendancePage.headers.get("cache-control")!, /no-store/);
      const attendanceHtml = await attendancePage.text();
      assert.match(attendanceHtml, /HTTP Invitation Family/);
      assert.match(attendanceHtml, /Confirmed guests/);
      const familyDetails = await fetch(
        origin + "/families/" + inviteFamily.id,
        { headers: { Cookie: cookie } },
      );
      assert.match(await familyDetails.text(), /Ceremony attendance/);
      const rsvpUpdate = await fetch(origin + rsvpPath, {
        method: "PUT",
        headers: rsvpHeaders,
        body: JSON.stringify({
          expectedVersion: 1,
          status: "notAttending",
          attendingCount: 0,
        }),
      });
      assert.equal(rsvpUpdate.status, 200);
      const refreshedAttendance = await fetch(
        origin + "/api/attendance?eventId=" + invitation.events[0].id,
        { headers: { Cookie: cookie } },
      );
      const refreshedSummary = (await refreshedAttendance.json()).data.summary;
      assert.equal(refreshedSummary.confirmedGuests, 0);
      assert.equal(refreshedSummary.notAttendingFamilies, 1);
      const guestAttendanceDenied = await fetch(origin + "/api/attendance", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestAttendanceDenied.status, 401);
      const guestDenied = await fetch(origin + "/api/families", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestDenied.status, 401);
      async function invitationRevision() {
        const response = await fetch(origin + invitationPath, {
          headers: { Cookie: cookie },
        });
        return (await response.json()).data.revision as number;
      }
      const emailPreview = await fetch(
        origin + invitationPath + "/email-preview",
        {
          method: "POST",
          headers: familyHeaders,
          body: JSON.stringify({
            expectedRevision: await invitationRevision(),
            token,
            requestKey: randomUUID(),
          }),
        },
      );
      assert.equal(emailPreview.status, 200);
      const attempt = (await emailPreview.json()).data;
      assert.equal(attempt.status, "ready");
      const disabledSend = await fetch(origin + invitationPath + "/email", {
        method: "POST",
        headers: familyHeaders,
        body: JSON.stringify({ attemptId: attempt.id, token }),
      });
      assert.equal(disabledSend.status, 503);
      assert.equal((await disabledSend.json()).error.code, "EMAIL_UNAVAILABLE");
      const rotated = await fetch(
        origin + invitationPath + "/invitation-link",
        {
          method: "POST",
          headers: familyHeaders,
          body: JSON.stringify({
            expectedRevision: await invitationRevision(),
            replace: true,
          }),
        },
      );
      assert.equal(rotated.status, 200);
      const guestRevoked = await fetch(origin + "/api/guest/invitation", {
        headers: { Cookie: guestCookie },
      });
      assert.equal(guestRevoked.status, 401);
      const revokedRsvp = await fetch(origin + rsvpPath, {
        method: "PUT",
        headers: rsvpHeaders,
        body: JSON.stringify({
          expectedVersion: 2,
          status: "attending",
          attendingCount: 1,
        }),
      });
      assert.equal(revokedRsvp.status, 401);
      const revokedAcceptance = await fetch(origin + "/api/guest/accept", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: guestCookie,
        },
        body: "{}",
      });
      assert.equal(revokedAcceptance.status, 401);
      const invalidatedLink = await fetch(origin + "/api/guest/exchange", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      assert.equal(invalidatedLink.status, 404);
      const deleteInvitedFamily = await fetch(
        origin +
          invitationPath +
          "?expectedRevision=" +
          (await invitationRevision()),
        { method: "DELETE", headers: { Cookie: cookie, Origin: origin } },
      );
      assert.equal(deleteInvitedFamily.status, 204);
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
      assert.ok([200, 307].includes(returnToPrivate.status));
      assert.match(
        returnToPrivate.headers.get("location") ??
          (await returnToPrivate.text()),
        /\/login/,
      );
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

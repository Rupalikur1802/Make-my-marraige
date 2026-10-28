import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { join } from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { NextRequest } from "next/server";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.server";
import {
  ensureAuthIndexes,
  provisionCouple,
} from "../src/modules/auth/provision.server";
import { loginCouple } from "../src/modules/auth/service.server";
import { weddingModel } from "../src/modules/wedding/model.server";
import { eventModel } from "../src/modules/events/model.server";
import {
  getWedding,
  getSetupCeremonies,
  updateWedding,
} from "../src/modules/wedding/service.server";
import { isCalendarDate, photoCutoff } from "../src/modules/wedding/validation";
import { GET, PATCH } from "../src/app/api/wedding/route";

let mongo: MongoMemoryReplSet;
let sequence = 0;
const password = "test-only-wedding-setup-password";
before(
  async () => {
    mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "setup-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_setup";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.RATE_LIMIT_SECRET =
      "test-only-setup-secret-at-least-32-characters";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function couple() {
  const email = "setup-" + ++sequence + "@example.test";
  await provisionCouple(email, password);
  return loginCouple({ email, password }, "setup-test");
}
const complete = {
  expectedVersion: 0,
  setupStatus: "complete",
  groomName: " Arjun ",
  brideName: " Priya ",
  weddingDate: "2026-12-10",
  venue: " Wedding Hall, Pune ",
};
const errorCode = (code: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === code;
function request(
  token?: string,
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/api/wedding", {
    method: body === undefined ? "GET" : "PATCH",
    headers: {
      ...(token ? { Cookie: "mmm_dev_couple_session=" + token } : {}),
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("calendar dates reject rollover and apply exactly seven calendar days at midnight IST", () => {
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("2026-04-31"), false);
  assert.equal(isCalendarDate("2026-12-1 0"), false);
  assert.equal(isCalendarDate("0000-01-01"), false);
  assert.equal(
    photoCutoff("2026-12-10").toISOString(),
    "2026-12-16T18:30:00.000Z",
  );
  assert.equal(
    photoCutoff("2028-02-25").toISOString(),
    "2028-03-02T18:30:00.000Z",
  );
});
test("draft progress persists, blank fields clear, DTO is safe and date cutoff follows edits", async () => {
  const { data: actor } = await couple();
  const initial = await getWedding(actor);
  assert.equal(initial.groomName, null);
  const draft = await updateWedding(actor, {
    expectedVersion: 0,
    groomName: " Arjun ",
    weddingDate: "2026-12-10",
  });
  assert.equal(draft.setupStatus, "draft");
  assert.equal(draft.groomName, "Arjun");
  assert.equal(draft.photoVisibleUntil, "2026-12-16T18:30:00.000Z");
  assert.equal((await getWedding(actor)).version, 1);
  assert.equal(
    await eventModel(await connectDatabase()).countDocuments({
      weddingId: actor.weddingId,
    }),
    0,
  );
  const cleared = await updateWedding(actor, {
    expectedVersion: 1,
    weddingDate: "",
    groomName: "",
  });
  assert.equal(cleared.weddingDate, null);
  assert.equal(cleared.photoVisibleUntil, null);
  assert.equal(cleared.groomName, null);
  assert.equal("ownerAccountId" in cleared, false);
  assert.equal("presetsSeededAt" in cleared, false);
});
test("completion validates the resulting record and rejects unsupported fields, invalid dates and downgrade", async () => {
  const { data: actor } = await couple();
  await assert.rejects(
    updateWedding(actor, { expectedVersion: 0, setupStatus: "complete" }),
    errorCode("SETUP_INCOMPLETE"),
  );
  await assert.rejects(
    updateWedding(actor, { ...complete, weddingDate: "2026-02-30" }),
  );
  await assert.rejects(
    updateWedding(actor, { ...complete, ownerAccountId: actor.account.id }),
  );
  await assert.rejects(updateWedding(actor, { ...complete, timezone: "UTC" }));
  await assert.rejects(
    updateWedding(actor, { ...complete, photoVisibleUntil: "2099-01-01" }),
  );
  await assert.rejects(
    updateWedding(actor, { ...complete, groomName: "a".repeat(101) }),
  );
  const saved = await updateWedding(actor, complete);
  assert.equal(saved.version, 1);
  await assert.rejects(
    updateWedding(actor, { expectedVersion: 1, setupStatus: "draft" }),
    errorCode("INVALID_TRANSITION"),
  );
  await assert.rejects(
    updateWedding(actor, { expectedVersion: 1, venue: "" }),
    errorCode("SETUP_INCOMPLETE"),
  );
});
test("completion seeds six private drafts once, stale retries conflict and edits do not reseed", async () => {
  const { data: actor } = await couple();
  await updateWedding(actor, complete);
  const events = await getSetupCeremonies(actor);
  assert.deepEqual(
    events.map((event) => event.presetKey),
    ["engagement", "haldi", "mehendi", "sangeet", "wedding", "reception"],
  );
  assert.ok(
    events.every(
      (event) =>
        event.status === "draft" &&
        event.venue === null &&
        event.startsAt === null,
    ),
  );
  await assert.rejects(
    updateWedding(actor, complete),
    errorCode("VERSION_CONFLICT"),
  );
  const edited = await updateWedding(actor, {
    expectedVersion: 1,
    venue: "Updated venue",
    weddingDate: "2026-12-11",
    setupStatus: "complete",
  });
  assert.equal(edited.photoVisibleUntil, "2026-12-17T18:30:00.000Z");
  assert.equal((await getSetupCeremonies(actor)).length, 6);
  // Future deletion must not cause setup edits to recreate a deleted ceremony.
  await eventModel(await connectDatabase()).deleteOne({
    weddingId: actor.weddingId,
    presetKey: "haldi",
  });
  await updateWedding(actor, {
    expectedVersion: 2,
    setupStatus: "complete",
    groomName: "Arjun Sharma",
  });
  assert.equal((await getSetupCeremonies(actor)).length, 5);
});
test("concurrent completions accept exactly one version and never duplicate presets", async () => {
  const { data: actor } = await couple();
  const attempts = await Promise.allSettled([
    updateWedding(actor, complete),
    updateWedding(actor, complete),
  ]);
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failure = attempts.find((result) => result.status === "rejected");
  assert.ok(
    failure?.status === "rejected" &&
      errorCode("VERSION_CONFLICT")(failure.reason),
  );
  assert.equal((await getWedding(actor)).version, 1);
  assert.equal((await getSetupCeremonies(actor)).length, 6);
});
test("failed seed rolls back wedding completion and partial event inserts", async () => {
  const { data: actor } = await couple();
  const db = await connectDatabase();
  await eventModel(db).create({
    weddingId: actor.weddingId,
    presetKey: "wedding",
    name: "Preexisting conflict",
  });
  await assert.rejects(updateWedding(actor, complete));
  const wedding = await getWedding(actor);
  assert.equal(wedding.setupStatus, "draft");
  assert.equal(wedding.version, 0);
  assert.equal(wedding.groomName, null);
  assert.equal(
    await eventModel(db).countDocuments({ weddingId: actor.weddingId }),
    1,
  );
  assert.equal(
    (await weddingModel(db).findById(actor.weddingId).lean())?.presetsSeededAt,
    undefined,
  );
});
test("HTTP protects ownership, Origin, strict bodies and private responses", async () => {
  const first = await couple();
  const second = await couple();
  assert.equal((await GET(request())).status, 401);
  assert.equal(
    (await PATCH(request(first.token, complete, "https://evil.example")))
      .status,
    403,
  );
  assert.equal(
    (
      await PATCH(
        request(first.token, { ...complete, weddingId: second.data.weddingId }),
      )
    ).status,
    400,
  );
  const saved = await PATCH(request(first.token, complete));
  assert.equal(saved.status, 200);
  assert.match(saved.headers.get("cache-control")!, /no-store/);
  const own = await GET(request(second.token));
  assert.equal((await own.json()).data.setupStatus, "draft");
  assert.equal((await getSetupCeremonies(second.data)).length, 0);
  await assert.rejects(
    getWedding({ ...first.data, weddingId: second.data.weddingId }),
    errorCode("NOT_FOUND"),
  );
  await assert.rejects(
    getSetupCeremonies({ ...first.data, weddingId: second.data.weddingId }),
    errorCode("NOT_FOUND"),
  );
  const malformed = await PATCH(
    new NextRequest("http://localhost:3000/api/wedding", {
      method: "PATCH",
      headers: {
        Cookie: "mmm_dev_couple_session=" + first.token,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: "{",
    }),
  );
  assert.equal(malformed.status, 400);
});

test("completion fails closed without the preset unique index and does not mutate drafts", async () => {
  const { data: actor } = await couple();
  const Event = eventModel(await connectDatabase());
  await Event.collection.dropIndex("weddingId_1_presetKey_1");
  try {
    await assert.rejects(updateWedding(actor, complete));
    assert.equal((await getWedding(actor)).version, 0);
    assert.equal(await Event.countDocuments({ weddingId: actor.weddingId }), 0);
  } finally {
    await Event.createIndexes();
  }
});

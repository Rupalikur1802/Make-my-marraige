import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
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
import { updateWedding } from "../src/modules/wedding/service.server";
import {
  getCeremony,
  listCeremonies,
  updateCeremony,
  createCeremony,
  deleteCeremony,
} from "../src/modules/events/service.server";
import {
  istInstant,
  istInputs,
  ceremonyTiming,
} from "../src/modules/events/validation";
import { GET as list, POST as create } from "../src/app/api/events/route";
import { GET, PATCH, DELETE as remove } from "../src/app/api/events/[id]/route";
import { eventModel } from "../src/modules/events/model.server";
let mongo: MongoMemoryReplSet;
let sequence = 0;
const password = "test-only-ceremony-password";
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "events-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_events";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.RATE_LIMIT_SECRET =
      "test-only-event-secret-at-least-32-characters";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function couple(complete = true) {
  const email = "ceremony-" + ++sequence + "@example.test";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "events-test");
  if (complete)
    await updateWedding(auth.data, {
      expectedVersion: 0,
      setupStatus: "complete",
      groomName: "Arjun",
      brideName: "Priya",
      weddingDate: "2026-12-10",
      venue: "Wedding Hall",
    });
  return auth;
}
const code = (expected: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === expected;
const details = {
  name: "Sangeet Sandhya",
  startsAt: "2026-12-09T14:00:00.000Z",
  venue: " Grand Ballroom ",
};
function request(
  token?: string,
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/api/events", {
    method: body === undefined ? "GET" : "PATCH",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Cookie: "mmm_dev_couple_session=" + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("IST conversion preserves local calendar day and midnight boundaries", () => {
  assert.equal(istInstant("2026-12-10", "00:15"), "2026-12-09T18:45:00.000Z");
  assert.equal(istInstant("2026-12-10", "23:59"), "2026-12-10T18:29:00.000Z");
  assert.deepEqual(istInputs("2026-12-09T18:45:00.000Z"), {
    date: "2026-12-10",
    time: "00:15",
  });
  assert.equal(istInstant("2026-02-29", "10:00"), null);
  assert.equal(istInstant("2028-02-29", "24:00"), null);
  assert.match(ceremonyTiming(details.startsAt), /IST$/);
});
test("list contains six actual presets in stable order with safe DTOs", async () => {
  const auth = await couple();
  const events = await listCeremonies(auth.data);
  assert.deepEqual(
    events.map((event) => event.presetKey),
    ["engagement", "haldi", "mehendi", "sangeet", "wedding", "reception"],
  );
  assert.ok(
    events.every(
      (event) =>
        event.startsAt === null &&
        event.venue === null &&
        event.status === "draft",
    ),
  );
  assert.equal("weddingId" in events[0]!, false);
  assert.ok(
    events.every(
      (event) => event.version === 0 && event.createdAt && event.updatedAt,
    ),
  );
  const pending = await couple(false);
  await assert.rejects(listCeremonies(pending.data), code("SETUP_REQUIRED"));
});
test("draft edits persist and optional timing/venue can be cleared", async () => {
  const auth = await couple();
  const event = (await listCeremonies(auth.data))[3]!;
  const saved = await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    ...details,
  });
  assert.equal(saved.name, "Sangeet Sandhya");
  assert.equal(saved.venue, "Grand Ballroom");
  assert.equal(saved.status, "draft");
  assert.equal(
    (await getCeremony(auth.data, event.id)).startsAt,
    details.startsAt,
  );
  const cleared = await updateCeremony(auth.data, event.id, {
    expectedVersion: 1,
    startsAt: null,
    venue: null,
  });
  assert.equal(cleared.startsAt, null);
  assert.equal(cleared.venue, null);
  assert.equal(cleared.version, 2);
});
test("publication checks the complete resulting record and enforces strict inputs", async () => {
  const auth = await couple();
  const event = (await listCeremonies(auth.data))[0]!;
  await assert.rejects(
    updateCeremony(auth.data, event.id, {
      expectedVersion: 0,
      status: "published",
    }),
    code("PUBLICATION_INCOMPLETE"),
  );
  for (const extra of [
    { name: " " },
    { name: "a".repeat(101) },
    { venue: "v".repeat(501) },
    { presetKey: "haldi" },
    { weddingId: auth.data.weddingId },
    { mapsUrl: "https://example.test" },
    { startsAt: "2026-02-30T12:00:00Z" },
    { startsAt: "2026-12-10T24:00:00Z" },
  ])
    await assert.rejects(
      updateCeremony(auth.data, event.id, { expectedVersion: 0, ...extra }),
    );
  assert.equal((await getCeremony(auth.data, event.id)).version, 0);
  const published = await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    ...details,
    status: "published",
  });
  assert.equal(published.status, "published");
  await assert.rejects(
    updateCeremony(auth.data, event.id, { expectedVersion: 1, venue: null }),
    code("PUBLICATION_INCOMPLETE"),
  );
  assert.equal((await getCeremony(auth.data, event.id)).version, 1);
  const renamed = await updateCeremony(auth.data, event.id, {
    expectedVersion: 1,
    name: "Evening Sangeet",
  });
  assert.equal(renamed.status, "published");
});
test("moving to draft preserves details and republishing does not seed extra events", async () => {
  const auth = await couple();
  const event = (await listCeremonies(auth.data))[0]!;
  const published = await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    ...details,
    status: "published",
  });
  const draft = await updateCeremony(auth.data, event.id, {
    expectedVersion: 1,
    status: "draft",
  });
  assert.equal(draft.name, published.name);
  assert.equal(draft.startsAt, published.startsAt);
  assert.equal(draft.venue, published.venue);
  assert.equal(draft.status, "draft");
  await updateCeremony(auth.data, event.id, {
    expectedVersion: 2,
    status: "published",
  });
  assert.equal(
    await eventModel(await connectDatabase()).countDocuments({
      weddingId: auth.data.weddingId,
    }),
    6,
  );
});
test("simultaneous edits accept one writer and stale changes never overwrite", async () => {
  const auth = await couple();
  const event = (await listCeremonies(auth.data))[0]!;
  const attempts = await Promise.allSettled(
    ["First", "Second"].map((name) =>
      updateCeremony(auth.data, event.id, { expectedVersion: 0, name }),
    ),
  );
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failed = attempts.find((result) => result.status === "rejected");
  assert.ok(
    failed?.status === "rejected" && code("VERSION_CONFLICT")(failed.reason),
  );
  assert.equal((await getCeremony(auth.data, event.id)).version, 1);
});
test("foreign and malformed IDs are safe 404s and cannot be read or mutated", async () => {
  const first = await couple(),
    second = await couple();
  const event = (await listCeremonies(first.data))[0]!;
  await assert.rejects(getCeremony(second.data, event.id), code("NOT_FOUND"));
  await assert.rejects(
    updateCeremony(second.data, event.id, {
      expectedVersion: 0,
      name: "Stolen",
    }),
    code("NOT_FOUND"),
  );
  await assert.rejects(getCeremony(first.data, "invalid"), code("NOT_FOUND"));
  assert.equal((await getCeremony(first.data, event.id)).version, 0);
});
test("HTTP editing requires a couple session, Origin and bounded JSON", async () => {
  const auth = await couple();
  const event = (await listCeremonies(auth.data))[0]!;
  const context = { params: Promise.resolve({ id: event.id }) };
  assert.equal((await list(request())).status, 401);
  assert.equal((await GET(request(), context)).status, 401);
  assert.equal(
    (
      await PATCH(
        request(
          auth.token,
          { expectedVersion: 0, name: "New" },
          "https://evil.example",
        ),
        context,
      )
    ).status,
    403,
  );
  const badMedia = new NextRequest(
    "http://localhost:3000/api/events/" + event.id,
    {
      method: "PATCH",
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "mmm_dev_couple_session=" + auth.token,
        "Content-Type": "text/plain",
      },
      body: "{}",
    },
  );
  assert.equal((await PATCH(badMedia, context)).status, 415);
  const oversized = new NextRequest(
    "http://localhost:3000/api/events/" + event.id,
    {
      method: "PATCH",
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "mmm_dev_couple_session=" + auth.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expectedVersion: 0, name: "x".repeat(66000) }),
    },
  );
  assert.equal((await PATCH(oversized, context)).status, 413);
  const malformed = new NextRequest(
    "http://localhost:3000/api/events/" + event.id,
    {
      method: "PATCH",
      headers: {
        Origin: "http://localhost:3000",
        Cookie: "mmm_dev_couple_session=" + auth.token,
        "Content-Type": "application/json",
      },
      body: "{",
    },
  );
  assert.equal((await PATCH(malformed, context)).status, 400);
  const other = await couple();
  assert.equal((await GET(request(other.token), context)).status, 404);
  const saved = await PATCH(
    request(auth.token, { expectedVersion: 0, ...details }),
    context,
  );
  assert.equal(saved.status, 200);
  assert.match(saved.headers.get("cache-control")!, /no-store/);
  const result = await saved.json();
  assert.equal(result.data.venue, "Grand Ballroom");
  assert.equal("weddingId" in result.data, false);
  const listResponse = await list(request(auth.token));
  assert.equal((await listResponse.json()).data.length, 6);
});

test("custom creation is draft-only, tenant-scoped and retry-safe under concurrent submissions", async () => {
  const auth = await couple(),
    key = randomUUID();
  const [first, replay] = await Promise.all([
    createCeremony(auth.data, { name: " Welcome Dinner " }, key),
    createCeremony(auth.data, { name: " Welcome Dinner " }, key),
  ]);
  assert.equal(first.id, replay.id);
  assert.equal(first.status, "draft");
  assert.equal(first.presetKey, null);
  assert.equal("createKeyHash" in first, false);
  assert.equal("createPayloadHash" in first, false);
  assert.equal((await listCeremonies(auth.data)).length, 7);
  await assert.rejects(
    createCeremony(auth.data, { name: "Other details" }, key),
    code("CREATE_CONFLICT"),
  );
  await assert.rejects(
    createCeremony(
      auth.data,
      { name: "No", status: "published" },
      randomUUID(),
    ),
  );
  await assert.rejects(
    createCeremony(auth.data, { name: "No", presetKey: "haldi" }, randomUUID()),
  );
  await assert.rejects(createCeremony(auth.data, { name: " " }, randomUUID()));
  await assert.rejects(createCeremony(auth.data, { name: "No" }, "invalid"));
  const other = await createCeremony(
    auth.data,
    { name: "Welcome Dinner" },
    randomUUID(),
  );
  assert.notEqual(other.id, first.id);
  const published = await updateCeremony(auth.data, first.id, {
    expectedVersion: 0,
    ...details,
    status: "published",
  });
  assert.equal(published.status, "published");
  const retryAfterEdit = await createCeremony(
    auth.data,
    { name: " Welcome Dinner " },
    key,
  );
  assert.equal(retryAfterEdit.id, first.id);
  const list = await listCeremonies(auth.data);
  assert.deepEqual(
    list.slice(0, 6).map((event) => event.presetKey),
    ["engagement", "haldi", "mehendi", "sangeet", "wedding", "reception"],
  );
  assert.ok(list.slice(6).every((event) => event.presetKey === null));
  const secondTenant = await couple();
  const sameKeyOtherTenant = await createCeremony(
    secondTenant.data,
    { name: "Welcome Dinner" },
    key,
  );
  assert.notEqual(sameKeyOtherTenant.id, first.id);
});
test("deletion removes only owned assignments, preserves spending/tasks and advances their versions", async () => {
  const auth = await couple(),
    other = await couple();
  const event = await createCeremony(
    auth.data,
    { name: "Dinner" },
    randomUUID(),
  );
  const db = (await connectDatabase()).db!;
  const tenant = new Types.ObjectId(auth.data.weddingId),
    eventId = new Types.ObjectId(event.id),
    otherTenant = new Types.ObjectId(other.data.weddingId);
  const taskId = new Types.ObjectId(),
    expenseId = new Types.ObjectId(),
    invitationId = new Types.ObjectId(),
    foreignId = new Types.ObjectId();
  await db.collection("tasks").insertOne({
    _id: taskId,
    weddingId: tenant,
    eventId,
    title: "Keep task",
    version: 2,
  });
  await db.collection("expenses").insertOne({
    _id: expenseId,
    weddingId: tenant,
    eventId,
    amountPaise: 12500,
    description: "Recorded ceremony payment",
    spentOn: "2026-10-01",
    payerName: "Groom",
    payerKey: "groom",
    idempotencyKey: randomUUID(),
    createPayloadHash: "keep-hash",
    version: 4,
  });
  await db.collection("eventInvitations").insertOne({
    _id: invitationId,
    weddingId: tenant,
    eventId,
    status: "attending",
    attendingCount: 3,
  });
  await db.collection("tasks").insertOne({
    _id: foreignId,
    weddingId: otherTenant,
    eventId,
    title: "Foreign fixture",
    version: 0,
  });
  await deleteCeremony(auth.data, event.id, 0);
  assert.equal(
    await db.collection("eventInvitations").findOne({ _id: invitationId }),
    null,
  );
  const task = await db.collection("tasks").findOne({ _id: taskId }),
    expense = await db.collection("expenses").findOne({ _id: expenseId });
  assert.equal(task?.title, "Keep task");
  assert.equal(task?.eventId, undefined);
  assert.equal(task?.version, 3);
  assert.equal(expense?.amountPaise, 12500);
  assert.equal(expense?.createPayloadHash, "keep-hash");
  assert.equal(expense?.eventId, undefined);
  assert.equal(expense?.version, 5);
  assert.ok(
    (await db.collection("tasks").findOne({ _id: foreignId }))?.eventId,
  );
  await assert.rejects(getCeremony(auth.data, event.id), code("NOT_FOUND"));
  await assert.rejects(
    deleteCeremony(auth.data, event.id, 0),
    code("NOT_FOUND"),
  );
});
test("preset deletion is permanent across setup edits and never touches another wedding", async () => {
  const auth = await couple(),
    other = await couple();
  const event = (await listCeremonies(auth.data))[0]!;
  await assert.rejects(
    deleteCeremony(other.data, event.id, 0),
    code("NOT_FOUND"),
  );
  await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    name: "Updated name",
  });
  await assert.rejects(
    deleteCeremony(auth.data, event.id, 0),
    code("VERSION_CONFLICT"),
  );
  await deleteCeremony(auth.data, event.id, 1);
  await updateWedding(auth.data, {
    expectedVersion: 1,
    setupStatus: "complete",
    venue: "New venue",
  });
  assert.equal((await listCeremonies(auth.data)).length, 5);
  assert.equal((await listCeremonies(other.data)).length, 6);
});
test("a failed related-record cleanup rolls back event deletion and prior assignment removal", async () => {
  const auth = await couple();
  const event = await createCeremony(
    auth.data,
    { name: "Rollback" },
    randomUUID(),
  );
  const db = (await connectDatabase()).db!,
    tenant = new Types.ObjectId(auth.data.weddingId),
    eventId = new Types.ObjectId(event.id);
  const taskId = new Types.ObjectId(),
    invitationId = new Types.ObjectId();
  await db.collection("tasks").insertOne({
    _id: taskId,
    weddingId: tenant,
    eventId,
    title: "Required link fixture",
    version: 0,
  });
  await db.collection("eventInvitations").insertOne({
    _id: invitationId,
    weddingId: tenant,
    eventId,
    status: "pending",
  });
  await db.command({
    collMod: "tasks",
    validator: { eventId: { $exists: true } },
    validationLevel: "strict",
    validationAction: "error",
  });
  try {
    await assert.rejects(deleteCeremony(auth.data, event.id, 0));
    assert.equal((await getCeremony(auth.data, event.id)).version, 0);
    assert.ok(
      await db.collection("eventInvitations").findOne({ _id: invitationId }),
    );
    assert.ok((await db.collection("tasks").findOne({ _id: taskId }))?.eventId);
  } finally {
    await db.command({
      collMod: "tasks",
      validator: {},
      validationLevel: "strict",
    });
  }
});
test("edit and delete races have one winner without partial cleanup", async () => {
  const auth = await couple();
  const event = await createCeremony(auth.data, { name: "Race" }, randomUUID());
  const result = await Promise.allSettled([
    deleteCeremony(auth.data, event.id, 0),
    updateCeremony(auth.data, event.id, {
      expectedVersion: 0,
      name: "Race edit",
    }),
  ]);
  assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = result.find((item) => item.status === "rejected");
  assert.ok(
    rejected?.status === "rejected" &&
      (code("VERSION_CONFLICT")(rejected.reason) ||
        code("NOT_FOUND")(rejected.reason)),
  );
});
test("create/delete HTTP enforces keys, version, Origin and bodyless deletion", async () => {
  const auth = await couple(),
    key = randomUUID();
  const send = (
    body: unknown,
    token = auth.token,
    origin = "http://localhost:3000",
  ) =>
    create(
      new NextRequest("http://localhost:3000/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(token ? { Cookie: "mmm_dev_couple_session=" + token } : {}),
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      }),
    );
  assert.equal((await send({ name: "API" }, "")).status, 401);
  assert.equal(
    (await send({ name: "API" }, auth.token, "https://evil.example")).status,
    403,
  );
  const made = await send({ name: "API" });
  assert.equal(made.status, 201);
  const data = (await made.json()).data;
  const context = { params: Promise.resolve({ id: data.id }) };
  const deletion = (
    query: string,
    origin = "http://localhost:3000",
    body?: string,
  ) =>
    remove(
      new NextRequest("http://localhost:3000/api/events/" + data.id + query, {
        method: "DELETE",
        headers: {
          Origin: origin,
          Cookie: "mmm_dev_couple_session=" + auth.token,
        },
        ...(body ? { body } : {}),
      }),
      context,
    );
  assert.equal((await deletion("")).status, 400);
  assert.equal(
    (await deletion("?expectedVersion=0&expectedVersion=0")).status,
    400,
  );
  assert.equal(
    (await deletion("?expectedVersion=0", "https://evil.example")).status,
    403,
  );
  assert.equal(
    (await deletion("?expectedVersion=0", "http://localhost:3000", "{}"))
      .status,
    400,
  );
  assert.equal((await deletion("?expectedVersion=1")).status, 409);
  assert.equal((await deletion("?expectedVersion=0")).status, 204);
  assert.equal((await deletion("?expectedVersion=0")).status, 404);
});

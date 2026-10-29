import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Schema, Types } from "mongoose";
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
  listCeremonies,
  getCeremony,
  deleteCeremony,
} from "../src/modules/events/service.server";
import {
  createFamily,
  getFamily,
  listFamilies,
  updateFamily,
  replaceAssignments,
  deleteFamily,
} from "../src/modules/families/service.server";
import { familyModels } from "../src/modules/families/model.server";
import { GET as list, POST } from "../src/app/api/families/route";
import { GET, PATCH, DELETE } from "../src/app/api/families/[id]/route";
import { PUT } from "../src/app/api/families/[id]/events/route";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const password = "test-only-family-password";
const input = {
  name: " Sharma Family ",
  email: "sharma@example.test",
  invitedCount: 5,
};
const code = (expected: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === expected;
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "families-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_families";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.RATE_LIMIT_SECRET =
      "test-only-families-secret-at-least-32-characters";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function couple(complete = true) {
  const email = "family-" + ++sequence + "@example.test";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "families-test");
  if (complete)
    await updateWedding(auth.data, {
      expectedVersion: 0,
      setupStatus: "complete",
      groomName: "Arjun",
      brideName: "Priya",
      weddingDate: "2026-12-10",
      venue: "Wedding Hall",
    });
  return { ...auth, events: complete ? await listCeremonies(auth.data) : [] };
}
test("creation saves a safe household and unique pending assignments, including draft ceremonies", async () => {
  const auth = await couple(),
    event = auth.events[0]!;
  const f = await createFamily(auth.data, { ...input, eventIds: [event.id] });
  assert.equal(f.name, "Sharma Family");
  assert.equal(f.revision, 0);
  assert.equal(f.hasInvitationLink, false);
  assert.equal(f.eventAssignments.length, 1);
  assert.equal(f.eventAssignments[0]!.status, "pending");
  assert.equal(f.eventAssignments[0]!.eventStatus, "draft");
  assert.equal("tokenHash" in f, false);
  assert.equal("weddingId" in f, false);
  assert.equal("searchName" in f, false);
  const empty = await createFamily(auth.data, input);
  assert.equal(empty.eventAssignments.length, 0);
  assert.notEqual(empty.id, f.id); // Names and email addresses are deliberately not unique.
  assert.equal(
    (await getCeremony(auth.data, event.id)).version,
    event.version + 1,
  );
});
test("validation rejects malformed input and foreign/deleted assignments without partial family records", async () => {
  const auth = await couple(),
    foreign = await couple();
  for (const invalid of [
    { ...input, invitedCount: 0 },
    { ...input, invitedCount: 1.5 },
    { ...input, email: "9876543210" },
    { ...input, name: " " },
    { ...input, name: "x".repeat(151) },
    { ...input, weddingId: foreign.data.weddingId },
    { ...input, eventIds: [auth.events[0]!.id, auth.events[0]!.id] },
  ])
    await assert.rejects(createFamily(auth.data, invalid));
  const before = await getCeremony(auth.data, auth.events[0]!.id);
  await assert.rejects(
    createFamily(auth.data, {
      ...input,
      eventIds: [auth.events[0]!.id, foreign.events[0]!.id],
    }),
    code("EVENT_UNAVAILABLE"),
  );
  assert.equal((await listFamilies(auth.data)).total, 0);
  assert.equal(
    (await getCeremony(auth.data, before.id)).version,
    before.version,
  );
  await assert.rejects(
    createFamily((await couple(false)).data, input),
    code("SETUP_REQUIRED"),
  );
});

test("invitation email is optional, normalized, searchable and clearable without changing other family data", async () => {
  const auth = await couple();
  const f = await createFamily(auth.data, {
    ...input,
    email: "  SHARMA+Family@Example.test  ",
  });
  assert.equal(f.email, "sharma+family@example.test");
  assert.equal(
    (await listFamilies(auth.data, { q: "SHARMA+FAMILY@EXAMPLE" })).total,
    1,
  );
  const cleared = await updateFamily(auth.data, f.id, {
    expectedRevision: 0,
    email: "   ",
  });
  assert.equal(cleared.email, null);
  assert.equal(cleared.invitedCount, f.invitedCount);
  const restored = await updateFamily(auth.data, f.id, {
    expectedRevision: 1,
    email: "other@example.test",
  });
  const unset = await updateFamily(auth.data, f.id, {
    expectedRevision: restored.revision,
    email: null,
  });
  assert.equal(unset.email, null);
  const withoutEmail = await createFamily(auth.data, {
    name: "No email yet",
    invitedCount: 2,
  });
  assert.equal(withoutEmail.email, null);
  const c = await connectDatabase(),
    id = new Types.ObjectId();
  await c.db!.collection("families").insertOne({
    _id: id,
    weddingId: new Types.ObjectId(auth.data.weddingId),
    name: "Existing family",
    searchName: "existing family",
    invitedCount: 3,
    revision: 0,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    legacyContact: "preserve-existing-data",
  });
  const existing = await getFamily(auth.data, id.toString());
  assert.equal(existing.email, null);
  assert.equal("legacyContact" in existing, false);
  await updateFamily(auth.data, id.toString(), {
    expectedRevision: 0,
    email: "existing@example.test",
  });
  assert.equal(
    (await c.db!.collection("families").findOne({ _id: id }))?.legacyContact,
    "preserve-existing-data",
  );
  await assert.rejects(
    updateFamily(auth.data, f.id, {
      expectedRevision: unset.revision,
      email: "invalid",
    }),
  );
});

test("development reload replaces a cached family schema before saving an email contact", async () => {
  const auth = await couple(),
    c = await connectDatabase();
  const outdated = new Schema(
    {
      name: String,
      weddingId: Schema.Types.ObjectId,
      searchName: String,
      invitedCount: Number,
      tokenVersion: { type: Number, default: 0 },
      revision: { type: Number, default: 0 },
      legacyContact: { type: String, required: true },
    },
    { strict: "throw", timestamps: true, autoIndex: false, autoCreate: false },
  );
  c.deleteModel("Family");
  c.model("Family", outdated, "families");
  try {
    const f = await createFamily(auth.data, input);
    assert.equal(f.email, input.email);
    assert.equal(
      familyModels(c).Family.schema.path("legacyContact"),
      undefined,
    );
  } finally {
    c.deleteModel("Family");
    familyModels(c);
  }
});
test("family reads search literal text, paginate deterministically and isolate wedding totals", async () => {
  const auth = await couple(),
    other = await couple();
  const event = auth.events[0]!;
  await createFamily(auth.data, {
    ...input,
    name: "Alpha [home]",
    eventIds: [event.id],
  });
  await createFamily(auth.data, { ...input, name: "Beta", invitedCount: 2 });
  await createFamily(other.data, input);
  const result = await listFamilies(auth.data, { pageSize: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.families.length, 1);
  assert.equal(result.families[0]!.name, "Alpha [home]");
  assert.deepEqual(result.summary, { families: 2, invitedMembers: 7 });
  assert.equal("eventAssignments" in result.families[0]!, false);
  assert.equal((await listFamilies(auth.data, { q: "[home]" })).total, 1);
  assert.equal((await listFamilies(auth.data, { q: ".*" })).total, 0);
  assert.equal(
    (await listFamilies(auth.data, { q: "SHARMA@EXAMPLE" })).total,
    2,
  );
  assert.equal((await listFamilies(auth.data, { eventId: event.id })).total, 1);
  await assert.rejects(
    listFamilies(auth.data, { eventId: other.events[0]!.id }),
    code("EVENT_UNAVAILABLE"),
  );
  await assert.rejects(listFamilies(auth.data, { rsvpStatus: "pending" }));
});
test("details have optimistic concurrency and preserve assignments; counts cannot invalidate responses", async () => {
  const auth = await couple(),
    event = auth.events[0]!,
    f = await createFamily(auth.data, { ...input, eventIds: [event.id] });
  const results = await Promise.allSettled([
    updateFamily(auth.data, f.id, { expectedRevision: 0, name: "One" }),
    updateFamily(auth.data, f.id, { expectedRevision: 0, name: "Two" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const current = await getFamily(auth.data, f.id);
  assert.equal(current.revision, 1);
  assert.equal(
    current.eventAssignments[0]!.invitationId,
    f.eventAssignments[0]!.invitationId,
  );
  const { Invitation } = familyModels(await connectDatabase());
  await Invitation.updateOne(
    { _id: f.eventAssignments[0]!.invitationId },
    {
      $set: { status: "attending", attendingCount: 4, respondedAt: new Date() },
    },
  );
  await assert.rejects(
    updateFamily(auth.data, f.id, { expectedRevision: 1, invitedCount: 3 }),
    code("INVITED_COUNT_CONFLICT"),
  );
  assert.equal((await getFamily(auth.data, f.id)).revision, 1);
  assert.equal(
    (
      await updateFamily(auth.data, f.id, {
        expectedRevision: 1,
        invitedCount: 4,
      })
    ).invitedCount,
    4,
  );
});
test("assignment replacement preserves retained responses and confirms removal of responded rows", async () => {
  const auth = await couple(),
    [first, second, third] = auth.events;
  const f = await createFamily(auth.data, {
    ...input,
    eventIds: [first!.id, second!.id],
  });
  const { Invitation } = familyModels(await connectDatabase());
  await Invitation.updateMany(
    { familyId: f.id },
    {
      $set: {
        status: "attending",
        attendingCount: 2,
        respondedAt: new Date(),
        version: 3,
      },
    },
  );
  await assert.rejects(
    replaceAssignments(auth.data, f.id, {
      expectedRevision: 0,
      eventIds: [second!.id, third!.id],
    }),
    code("RESPONSE_REMOVAL_CONFIRMATION_REQUIRED"),
  );
  assert.equal((await getFamily(auth.data, f.id)).revision, 0);
  const updated = await replaceAssignments(auth.data, f.id, {
    expectedRevision: 0,
    eventIds: [second!.id, third!.id],
    confirmResponseRemoval: true,
  });
  assert.equal(updated.revision, 1);
  const retained = updated.eventAssignments.find(
    (r) => r.eventId === second!.id,
  )!;
  assert.equal(retained.status, "attending");
  assert.equal(retained.version, 3);
  assert.equal(
    retained.invitationId,
    f.eventAssignments.find((r) => r.eventId === second!.id)!.invitationId,
  );
  assert.equal(
    updated.eventAssignments.find((r) => r.eventId === third!.id)!.status,
    "pending",
  );
  assert.equal(await Invitation.countDocuments({ familyId: f.id }), 2);
  await assert.rejects(
    replaceAssignments(auth.data, f.id, { expectedRevision: 0, eventIds: [] }),
    code("VERSION_CONFLICT"),
  );
});
test("foreign IDs are safe not-found for read, edit, assignment and deletion", async () => {
  const a = await couple(),
    b = await couple(),
    f = await createFamily(b.data, input);
  for (const id of [f.id, "invalid"]) {
    await assert.rejects(getFamily(a.data, id), code("NOT_FOUND"));
    await assert.rejects(
      updateFamily(a.data, id, { expectedRevision: 0, name: "No" }),
      code("NOT_FOUND"),
    );
    await assert.rejects(
      replaceAssignments(a.data, id, { expectedRevision: 0, eventIds: [] }),
      code("NOT_FOUND"),
    );
    await assert.rejects(deleteFamily(a.data, id, 0), code("NOT_FOUND"));
  }
});
test("family deletion removes own assignments and guest sessions while preserving couple and foreign records", async () => {
  const auth = await couple(),
    other = await couple(),
    f = await createFamily(auth.data, {
      ...input,
      eventIds: [auth.events[0]!.id],
    }),
    foreign = await createFamily(other.data, {
      ...input,
      eventIds: [other.events[0]!.id],
    });
  const c = await connectDatabase();
  await c.db!.collection("sessions").insertMany([
    {
      kind: "guest",
      tokenHash: "a".repeat(64),
      familyId: new Types.ObjectId(f.id),
      weddingId: new Types.ObjectId(auth.data.weddingId),
    },
    {
      kind: "guest",
      tokenHash: "b".repeat(64),
      familyId: new Types.ObjectId(foreign.id),
      weddingId: new Types.ObjectId(other.data.weddingId),
    },
  ]);
  await assert.rejects(
    deleteFamily(auth.data, f.id, 1),
    code("VERSION_CONFLICT"),
  );
  await deleteFamily(auth.data, f.id, 0);
  await assert.rejects(getFamily(auth.data, f.id), code("NOT_FOUND"));
  assert.equal(
    await familyModels(c).Invitation.countDocuments({ familyId: f.id }),
    0,
  );
  assert.equal(
    await c
      .db!.collection("sessions")
      .countDocuments({ kind: "guest", familyId: new Types.ObjectId(f.id) }),
    0,
  );
  assert.equal(
    (await c.db!.collection("sessions").countDocuments({ kind: "couple" })) > 0,
    true,
  );
  assert.equal(
    (await getFamily(other.data, foreign.id)).eventAssignments.length,
    1,
  );
  assert.equal((await listCeremonies(auth.data)).length, 6);
});
test("ceremony deletion cleans canonical assignments and advances affected family revisions", async () => {
  const auth = await couple(),
    e = auth.events[0]!,
    f = await createFamily(auth.data, { ...input, eventIds: [e.id] });
  const current = await getCeremony(auth.data, e.id);
  await deleteCeremony(auth.data, e.id, current.version);
  const updated = await getFamily(auth.data, f.id);
  assert.equal(updated.eventAssignments.length, 0);
  assert.equal(updated.revision, 1);
  await assert.rejects(
    updateFamily(auth.data, f.id, { expectedRevision: 0, name: "stale" }),
    code("VERSION_CONFLICT"),
  );
});
test("assignment/deletion races never leave an invitation pointing at a missing event or family", async () => {
  const auth = await couple(),
    e = auth.events[0]!,
    f = await createFamily(auth.data, input);
  await Promise.allSettled([
    replaceAssignments(auth.data, f.id, {
      expectedRevision: 0,
      eventIds: [e.id],
    }),
    deleteCeremony(auth.data, e.id, e.version),
  ]);
  const c = await connectDatabase(),
    { Invitation } = familyModels(c);
  for (const row of await Invitation.find({
    weddingId: auth.data.weddingId,
  }).lean()) {
    assert.ok(await c.db!.collection("events").findOne({ _id: row.eventId }));
    assert.ok(
      await c.db!.collection("families").findOne({ _id: row.familyId }),
    );
  }
  const current = await getFamily(auth.data, f.id);
  await Promise.allSettled([
    replaceAssignments(auth.data, f.id, {
      expectedRevision: current.revision,
      eventIds: [auth.events[1]!.id],
    }),
    deleteFamily(auth.data, f.id, current.revision),
  ]);
  for (const row of await Invitation.find({
    weddingId: auth.data.weddingId,
  }).lean())
    assert.ok(
      await c.db!.collection("families").findOne({ _id: row.familyId }),
    );
});
test("failed assignment insertion rolls back family creation and event version locks", async () => {
  const auth = await couple(),
    e = auth.events[0]!,
    c = await connectDatabase();
  await c.db!.command({
    collMod: "eventInvitations",
    validator: { status: { $eq: "impossible" } },
    validationLevel: "strict",
    validationAction: "error",
  });
  try {
    await assert.rejects(
      createFamily(auth.data, { ...input, eventIds: [e.id] }),
    );
    assert.equal((await listFamilies(auth.data)).total, 0);
    assert.equal((await getCeremony(auth.data, e.id)).version, e.version);
  } finally {
    await c.db!.command({ collMod: "eventInvitations", validator: {} });
  }
});
test("assignment creation fails closed without unique index", async () => {
  const auth = await couple(),
    c = await connectDatabase(),
    { Invitation } = familyModels(c);
  await Invitation.collection.dropIndex("weddingId_1_familyId_1_eventId_1");
  try {
    await assert.rejects(createFamily(auth.data, input));
    assert.equal((await listFamilies(auth.data)).total, 0);
  } finally {
    await ensureAuthIndexes();
  }
});
function request(
  method: string,
  token?: string,
  body?: unknown,
  path = "/api/families",
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Cookie: "mmm_dev_couple_session=" + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("HTTP routes enforce authentication, Origin, strict fields, query preconditions and private DTOs", async () => {
  const auth = await couple(),
    ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  assert.equal((await list(request("GET"))).status, 401);
  assert.equal(
    (
      await POST(
        request(
          "POST",
          auth.token,
          input,
          "/api/families",
          "https://foreign.test",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request("POST", auth.token, { ...input, tokenHash: "x" })))
      .status,
    400,
  );
  const created = await POST(
    request("POST", auth.token, { ...input, eventIds: [auth.events[0]!.id] }),
  );
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("Cache-Control"), "private, no-store");
  const f = (await created.json()).data;
  assert.equal((await GET(request("GET", auth.token), ctx(f.id))).status, 200);
  assert.equal(
    (
      await PATCH(
        request("PATCH", auth.token, { expectedRevision: 0, name: "Edited" }),
        ctx(f.id),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await PUT(
        request("PUT", auth.token, { expectedRevision: 0, eventIds: [] }),
        ctx(f.id),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await DELETE(
        request("DELETE", auth.token, undefined, "/api/families/" + f.id),
        ctx(f.id),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await DELETE(
        request(
          "DELETE",
          auth.token,
          undefined,
          "/api/families/" + f.id + "?expectedRevision=1&expectedRevision=1",
        ),
        ctx(f.id),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await DELETE(
        request(
          "DELETE",
          auth.token,
          {},
          "/api/families/" + f.id + "?expectedRevision=1",
        ),
        ctx(f.id),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await DELETE(
        request(
          "DELETE",
          auth.token,
          undefined,
          "/api/families/" + f.id + "?expectedRevision=1",
        ),
        ctx(f.id),
      )
    ).status,
    204,
  );
  assert.equal((await GET(request("GET", auth.token), ctx(f.id))).status, 404);
});

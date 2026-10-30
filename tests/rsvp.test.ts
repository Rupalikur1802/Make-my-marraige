import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
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
  updateCeremony,
  getCeremony,
  deleteCeremony,
} from "../src/modules/events/service.server";
import {
  createFamily,
  getFamily,
  updateFamily,
  replaceAssignments,
  deleteFamily,
} from "../src/modules/families/service.server";
import { familyModels } from "../src/modules/families/model.server";
import {
  exchangeInvitation,
  generateInvitationLink,
  guestInvitation,
  acceptGuestInvitation,
  logoutGuest,
} from "../src/modules/invitations/service.server";
import {
  saveRsvp,
  attendanceSummary,
} from "../src/modules/rsvp/service.server";
import { PUT } from "../src/app/api/guest/rsvp/[invitationId]/route";
import { GET } from "../src/app/api/attendance/route";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const origin = "https://rsvp.example.test",
  password = "test-only-rsvp-password";
const code = (value: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === value;
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "rsvp-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_rsvp";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "test-only-rsvp-secret-at-least-32-characters";
    process.env.INVITATION_EMAIL_ENABLED = "false";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function fixture() {
  const email = `rsvp-${++sequence}@example.test`;
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "rsvp-test");
  await updateWedding(auth.data, {
    expectedVersion: 0,
    setupStatus: "complete",
    groomName: "Arjun",
    brideName: "Priya",
    weddingDate: "2026-10-20",
    venue: "Wedding Hall",
  });
  const events = await listCeremonies(auth.data),
    event = events[0]!;
  await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    status: "published",
    startsAt: "2026-10-19T13:00:00.000Z",
    venue: "Ceremony Hall",
  });
  const family = await createFamily(auth.data, {
    name: "Sharma Family",
    invitedCount: 4,
    eventIds: [event.id, events[1]!.id],
  });
  const generated = await generateInvitationLink(auth.data, family.id, {
    expectedRevision: family.revision,
  });
  const token = new URLSearchParams(
    new URL(generated.invitationUrl).hash.slice(1),
  ).get("token")!;
  const guest = await exchangeInvitation(token, "rsvp-fixture");
  const detail = await getFamily(auth.data, family.id);
  return {
    auth,
    family: detail,
    events,
    event,
    guest,
    token,
    row: detail.eventAssignments.find((row) => row.eventId === event.id)!,
  };
}
const attending = {
  expectedVersion: 0,
  status: "attending",
  attendingCount: 3,
};

test("guest saves and updates ceremony attendance anytime without accepting the family invitation", async () => {
  const f = await fixture();
  const before = await guestInvitation(f.guest.token);
  assert.equal(before.events.length, 1);
  assert.equal(before.events[0]!.invitation!.status, "pending");
  const saved = await saveRsvp(f.guest.token, f.row.invitationId, attending);
  assert.equal(saved.version, 1);
  assert.equal(saved.status, "attending");
  assert.ok(saved.respondedAt);
  assert.equal(
    (await getFamily(f.auth.data, f.family.id)).invitationAcceptedAt,
    null,
  );
  const no = await saveRsvp(f.guest.token, f.row.invitationId, {
    expectedVersion: 1,
    status: "notAttending",
    attendingCount: 0,
  });
  assert.equal(no.version, 2);
  assert.equal(no.attendingCount, 0);
  await saveRsvp(f.guest.token, f.row.invitationId, {
    ...attending,
    expectedVersion: 2,
    attendingCount: 4,
  });
  assert.equal(
    (await guestInvitation(f.guest.token)).events[0]!.invitation!
      .attendingCount,
    4,
  );
});
test("accepting a family invitation does not confirm any ceremony", async () => {
  const f = await fixture();
  await acceptGuestInvitation(f.guest.token);
  const family = await getFamily(f.auth.data, f.family.id);
  assert.ok(family.invitationAcceptedAt);
  assert.ok(
    family.eventAssignments.every(
      (row) => row.status === "pending" && row.attendingCount === 0,
    ),
  );
});
test("strict validation and count limits fail without advancing family or invitation versions", async () => {
  const f = await fixture();
  const eventBefore = await getCeremony(f.auth.data, f.event.id);
  for (const body of [
    { ...attending, status: "pending" },
    { ...attending, attendingCount: 0 },
    { ...attending, attendingCount: -1 },
    { ...attending, attendingCount: 1.5 },
    { ...attending, attendingCount: "2" },
    { ...attending, status: "notAttending", attendingCount: 1 },
    { ...attending, familyId: f.family.id },
    { ...attending, expectedVersion: -1 },
  ])
    await assert.rejects(saveRsvp(f.guest.token, f.row.invitationId, body));
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, {
      ...attending,
      attendingCount: 5,
    }),
    code("ATTENDING_COUNT_EXCEEDED"),
  );
  const family = await getFamily(f.auth.data, f.family.id);
  assert.equal(family.revision, f.family.revision);
  assert.equal(
    (await getCeremony(f.auth.data, f.event.id)).version,
    eventBefore.version,
  );
  assert.equal(
    family.eventAssignments.find(
      (row) => row.invitationId === f.row.invitationId,
    )!.version,
    0,
  );
});
test("stale and concurrent saves have one winner without overwriting newer responses", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    saveRsvp(f.guest.token, f.row.invitationId, attending),
    saveRsvp(f.guest.token, f.row.invitationId, {
      ...attending,
      attendingCount: 2,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.filter(
      (r) => r.status === "rejected" && code("VERSION_CONFLICT")(r.reason),
    ).length,
    1,
  );
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, attending),
    code("VERSION_CONFLICT"),
  );
  assert.equal(
    (await guestInvitation(f.guest.token)).events[0]!.invitation!.version,
    1,
  );
});
test("guest cannot write foreign, draft or removed ceremony assignments", async () => {
  const f = await fixture(),
    other = await fixture();
  await assert.rejects(
    saveRsvp(f.guest.token, other.row.invitationId, attending),
    code("INVITATION_UNAVAILABLE"),
  );
  const draft = f.family.eventAssignments.find(
    (row) => row.eventStatus === "draft",
  )!;
  await assert.rejects(
    saveRsvp(f.guest.token, draft.invitationId, attending),
    code("INVITATION_UNAVAILABLE"),
  );
  await replaceAssignments(f.auth.data, f.family.id, {
    expectedRevision: f.family.revision,
    eventIds: [],
  });
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, attending),
    code("INVITATION_UNAVAILABLE"),
  );
});
test("unpublishing hides responses, publishing retains them and deletion removes them", async () => {
  const f = await fixture();
  await saveRsvp(f.guest.token, f.row.invitationId, attending);
  await updateCeremony(f.auth.data, f.event.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.event.id)).version,
    status: "draft",
  });
  assert.equal((await guestInvitation(f.guest.token)).events.length, 0);
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, {
      ...attending,
      expectedVersion: 1,
    }),
    code("INVITATION_UNAVAILABLE"),
  );
  await updateCeremony(f.auth.data, f.event.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.event.id)).version,
    status: "published",
  });
  assert.equal(
    (await guestInvitation(f.guest.token)).events[0]!.invitation!
      .attendingCount,
    3,
  );
  await deleteCeremony(
    f.auth.data,
    f.event.id,
    (await getCeremony(f.auth.data, f.event.id)).version,
  );
  assert.equal(
    await familyModels(await connectDatabase()).Invitation.countDocuments({
      _id: f.row.invitationId,
    }),
    0,
  );
});
test("expired, logged-out, replaced and couple sessions cannot submit a guest response", async () => {
  const f = await fixture();
  await assert.rejects(
    saveRsvp(undefined, f.row.invitationId, attending),
    code("UNAUTHENTICATED"),
  );
  await assert.rejects(
    saveRsvp(f.auth.token, f.row.invitationId, attending),
    code("UNAUTHENTICATED"),
  );
  await assert.rejects(
    saveRsvp(
      f.guest.token,
      f.row.invitationId,
      attending,
      new Date(f.guest.expiresAt.getTime() + 1),
    ),
    code("UNAUTHENTICATED"),
  );
  await logoutGuest(f.guest.token);
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, attending),
    code("UNAUTHENTICATED"),
  );
  const guest = await exchangeInvitation(f.token, "rsvp-rotation");
  await generateInvitationLink(f.auth.data, f.family.id, {
    expectedRevision: (await getFamily(f.auth.data, f.family.id)).revision,
    replace: true,
  });
  await assert.rejects(
    saveRsvp(guest.token, f.row.invitationId, attending),
    code("UNAUTHENTICATED"),
  );
});
test("family count reduction races preserve attendance limits and existing confirmed counts", async () => {
  const f = await fixture();
  await Promise.allSettled([
    saveRsvp(f.guest.token, f.row.invitationId, {
      ...attending,
      attendingCount: 4,
    }),
    updateFamily(f.auth.data, f.family.id, {
      expectedRevision: f.family.revision,
      invitedCount: 2,
    }),
  ]);
  const family = await getFamily(f.auth.data, f.family.id);
  assert.ok(
    family.eventAssignments.every(
      (row) => row.attendingCount <= family.invitedCount,
    ),
  );
  if (family.eventAssignments.some((row) => row.attendingCount === 4))
    await assert.rejects(
      updateFamily(f.auth.data, f.family.id, {
        expectedRevision: family.revision,
        invitedCount: 2,
      }),
      code("INVITED_COUNT_CONFLICT"),
    );
});
test("response races with assignment and ceremony deletion leave no dangling rows", async () => {
  const f = await fixture();
  await Promise.allSettled([
    saveRsvp(f.guest.token, f.row.invitationId, attending),
    replaceAssignments(f.auth.data, f.family.id, {
      expectedRevision: f.family.revision,
      eventIds: [],
      confirmResponseRemoval: true,
    }),
  ]);
  const family = await getFamily(f.auth.data, f.family.id);
  await replaceAssignments(f.auth.data, f.family.id, {
    expectedRevision: family.revision,
    eventIds: [],
    confirmResponseRemoval: true,
  });
  assert.equal(
    await familyModels(await connectDatabase()).Invitation.countDocuments({
      familyId: f.family.id,
    }),
    0,
  );
  const g = await fixture();
  await Promise.allSettled([
    saveRsvp(g.guest.token, g.row.invitationId, attending),
    deleteCeremony(
      g.auth.data,
      g.event.id,
      (await getCeremony(g.auth.data, g.event.id)).version,
    ),
  ]);
  const remaining = await listCeremonies(g.auth.data);
  if (remaining.some((event) => event.id === g.event.id))
    await deleteCeremony(
      g.auth.data,
      g.event.id,
      (await getCeremony(g.auth.data, g.event.id)).version,
    );
  assert.equal(
    await familyModels(await connectDatabase()).Invitation.countDocuments({
      eventId: g.event.id,
    }),
    0,
  );
});
test("family deletion prevents future saves and removes attendance from the summary", async () => {
  const f = await fixture();
  await saveRsvp(f.guest.token, f.row.invitationId, attending);
  await deleteFamily(
    f.auth.data,
    f.family.id,
    (await getFamily(f.auth.data, f.family.id)).revision,
  );
  await assert.rejects(
    saveRsvp(f.guest.token, f.row.invitationId, {
      ...attending,
      expectedVersion: 1,
    }),
    code("UNAUTHENTICATED"),
  );
  assert.equal(
    (await attendanceSummary(f.auth.data)).summary.confirmedGuests,
    0,
  );
});
test("couple summary totals cover the whole ceremony independent of literal search, response filter and pagination", async () => {
  const f = await fixture();
  await saveRsvp(f.guest.token, f.row.invitationId, attending);
  await createFamily(f.auth.data, {
    name: "Literal [Family]",
    invitedCount: 2,
    eventIds: [f.event.id],
  });
  const decline = await createFamily(f.auth.data, {
    name: "Declining Family",
    invitedCount: 2,
    eventIds: [f.event.id],
  });
  const link = await generateInvitationLink(f.auth.data, decline.id, {
    expectedRevision: decline.revision,
  });
  const guest = await exchangeInvitation(
    new URLSearchParams(new URL(link.invitationUrl).hash.slice(1)).get(
      "token",
    )!,
    "declining-rsvp",
  );
  await saveRsvp(guest.token, decline.eventAssignments[0]!.invitationId, {
    expectedVersion: 0,
    status: "notAttending",
    attendingCount: 0,
  });
  const summary = await attendanceSummary(f.auth.data, { pageSize: 1 });
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.total, 3);
  assert.deepEqual(summary.summary, {
    confirmedGuests: 3,
    attendingFamilies: 1,
    notAttendingFamilies: 1,
    pendingFamilies: 1,
    assignedFamilies: 3,
  });
  const filtered = await attendanceSummary(f.auth.data, {
    status: "pending",
    q: "[Family]",
    pageSize: 1,
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.rows[0]!.familyName, "Literal [Family]");
  assert.deepEqual(filtered.summary, summary.summary);
  const empty = await attendanceSummary(f.auth.data, { q: "does-not-exist" });
  assert.equal(empty.rows.length, 0);
  assert.deepEqual(empty.summary, summary.summary);
  for (const key of ["tokenHash", "email", "weddingId", "accountId"])
    assert.equal(key in summary.rows[0]!, false);
  const other = await fixture();
  await assert.rejects(
    attendanceSummary(other.auth.data, { eventId: f.event.id }),
    code("EVENT_UNAVAILABLE"),
  );
});
test("couple summary rejects malformed queries and reports no published ceremonies clearly", async () => {
  const f = await fixture();
  for (const query of [
    { q: "x".repeat(101) },
    { pageSize: 101 },
    { status: "yes" },
    { familyId: f.family.id },
    { eventId: [f.event.id] },
  ])
    await assert.rejects(attendanceSummary(f.auth.data, query));
  await updateCeremony(f.auth.data, f.event.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.event.id)).version,
    status: "draft",
  });
  const data = await attendanceSummary(f.auth.data);
  assert.equal(data.selected, null);
  assert.equal(data.rows.length, 0);
  assert.equal(data.total, 0);
});
test("HTTP routes enforce session kinds, exact Origin, strict bodies and private cache policy", async () => {
  const f = await fixture(),
    path = "/api/guest/rsvp/" + f.row.invitationId;
  const context = {
    params: Promise.resolve({ invitationId: f.row.invitationId }),
  };
  const request = (
    cookie: string,
    requestOrigin = origin,
    body: unknown = attending,
  ) =>
    new NextRequest(origin + path, {
      method: "PUT",
      headers: {
        Origin: requestOrigin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const guestCookie = "__Host-guest_session=" + f.guest.token,
    coupleCookie = "__Host-couple_session=" + f.auth.token;
  assert.equal(
    (await PUT(request(guestCookie, "https://foreign.example.test"), context))
      .status,
    403,
  );
  assert.equal((await PUT(request(coupleCookie), context)).status, 401);
  assert.equal(
    (
      await PUT(
        request(guestCookie, origin, { ...attending, eventId: f.event.id }),
        context,
      )
    ).status,
    400,
  );
  const saved = await PUT(request(guestCookie), context);
  assert.equal(saved.status, 200);
  assert.match(saved.headers.get("cache-control")!, /no-store/);
  const read = await GET(
    new NextRequest(origin + "/api/attendance", {
      headers: { Cookie: coupleCookie },
    }),
  );
  assert.equal(read.status, 200);
  assert.equal((await read.json()).data.summary.confirmedGuests, 3);
  assert.equal(
    (
      await GET(
        new NextRequest(origin + "/api/attendance", {
          headers: { Cookie: guestCookie },
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await GET(
        new NextRequest(origin + "/api/attendance?page=1&page=2", {
          headers: { Cookie: coupleCookie },
        }),
      )
    ).status,
    400,
  );
});

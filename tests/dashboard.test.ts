import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { Types } from "mongoose";
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
} from "../src/modules/events/service.server";
import {
  createFamily,
  getFamily,
  deleteFamily,
} from "../src/modules/families/service.server";
import { familyModels } from "../src/modules/families/model.server";
import {
  generateInvitationLink,
  exchangeInvitation,
  acceptGuestInvitation,
} from "../src/modules/invitations/service.server";
import { saveRsvp } from "../src/modules/rsvp/service.server";
import { dashboard } from "../src/modules/dashboard/service.server";
import {
  daysUntilWedding,
  countdownLabel,
} from "../src/modules/dashboard/date";
import { GET } from "../src/app/api/dashboard/route";
import { eventModel } from "../src/modules/events/model.server";

let mongo: MongoMemoryReplSet,
  sequence = 0;
const origin = "https://dashboard.example.test",
  now = new Date("2026-10-29T12:00:00Z");
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "dashboard-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_dashboard";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "test-only-dashboard-secret-at-least-32-characters";
    process.env.INVITATION_EMAIL_ENABLED = "false";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function actor(complete = true) {
  const email = `dashboard-${++sequence}@example.test`,
    password = "test-only-dashboard-password";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "dashboard-test");
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
async function fixture() {
  const auth = await actor(),
    events = await listCeremonies(auth.data);
  for (const event of events.slice(0, 3))
    await updateCeremony(auth.data, event.id, {
      expectedVersion: 0,
      status: "published",
      startsAt: "2026-12-09T13:00:00.000Z",
      venue: "Ceremony Hall",
    });
  const a = await createFamily(auth.data, {
    name: "Family A",
    invitedCount: 4,
    eventIds: events.slice(0, 2).map((e) => e.id),
  });
  await createFamily(auth.data, {
    name: "Family B",
    invitedCount: 3,
    eventIds: [events[0]!.id],
  });
  await createFamily(auth.data, {
    name: "Draft only",
    invitedCount: 2,
    eventIds: [events[3]!.id],
  });
  await createFamily(auth.data, {
    name: "Unassigned",
    invitedCount: 1,
    eventIds: [],
  });
  const link = await generateInvitationLink(auth.data, a.id, {
    expectedRevision: a.revision,
  });
  const token = new URLSearchParams(
    new URL(link.invitationUrl).hash.slice(1),
  ).get("token")!;
  const guest = await exchangeInvitation(token, "dashboard-fixture");
  const detail = await getFamily(auth.data, a.id);
  const row = detail.eventAssignments.find((r) => r.eventId === events[0]!.id)!;
  return { auth, events, a: detail, guest, row };
}
test("countdown uses IST calendar days, including midnight, leap dates and past dates", () => {
  assert.equal(
    daysUntilWedding("2026-10-30", new Date("2026-10-29T18:29:59Z")),
    1,
  );
  assert.equal(
    daysUntilWedding("2026-10-30", new Date("2026-10-29T18:30:00Z")),
    0,
  );
  assert.equal(
    daysUntilWedding("2028-03-01", new Date("2028-02-28T18:30:00Z")),
    1,
  );
  assert.equal(countdownLabel(0), "Today is your wedding day");
  assert.equal(countdownLabel(1), "1 day to go");
  assert.equal(countdownLabel(-1), "Your wedding was 1 day ago");
  assert.throws(() => daysUntilWedding("2026-02-30", now));
});
test("unique pending families, acceptance and per-event attendance remain separate", async () => {
  const f = await fixture();
  let data = await dashboard(f.auth.data, now);
  assert.deepEqual(data.guests, {
    families: 4,
    invitedMembers: 10,
    familiesWithPendingRsvp: 2,
  });
  assert.deepEqual(data.invitationAcceptance, {
    acceptedFamilies: 0,
    awaitingAcceptanceFamilies: 4,
  });
  await acceptGuestInvitation(f.guest.token);
  await saveRsvp(f.guest.token, f.row.invitationId, {
    expectedVersion: 0,
    status: "attending",
    attendingCount: 3,
  });
  data = await dashboard(f.auth.data, now);
  assert.equal(data.invitationAcceptance.acceptedFamilies, 1);
  assert.equal(data.guests.familiesWithPendingRsvp, 2);
  const event = data.eventAttendance.find(
    (e) => e.eventId === f.events[0]!.id,
  )!;
  assert.equal(event.attendingMembers, 3);
  assert.equal(event.pendingFamilies, 1);
  assert.equal(data.eventAttendance.length, 3);
  assert.deepEqual(data.tasks, {
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    total: 0,
  });
  assert.equal(data.expenses.totalPaise, 0);
});
test("summary reflects response edits, unpublishing, deleted families and wedding edits", async () => {
  const f = await fixture();
  await saveRsvp(f.guest.token, f.row.invitationId, {
    expectedVersion: 0,
    status: "attending",
    attendingCount: 3,
  });
  await saveRsvp(f.guest.token, f.row.invitationId, {
    expectedVersion: 1,
    status: "notAttending",
    attendingCount: 0,
  });
  let data = await dashboard(f.auth.data, now);
  assert.equal(
    data.eventAttendance.find((e) => e.eventId === f.events[0]!.id)!
      .attendingMembers,
    0,
  );
  await updateCeremony(f.auth.data, f.events[0]!.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.events[0]!.id)).version,
    status: "draft",
  });
  data = await dashboard(f.auth.data, now);
  assert.equal(data.guests.familiesWithPendingRsvp, 1);
  const family = await getFamily(f.auth.data, f.a.id);
  await deleteFamily(f.auth.data, family.id, family.revision);
  await updateWedding(f.auth.data, {
    expectedVersion: 1,
    weddingDate: "2026-10-29",
    venue: "Updated Hall",
  });
  data = await dashboard(f.auth.data, now);
  assert.deepEqual(data.guests, {
    families: 3,
    invitedMembers: 6,
    familiesWithPendingRsvp: 0,
  });
  assert.equal(data.wedding.daysUntilWedding, 0);
  assert.equal(data.wedding.venue, "Updated Hall");
});
test("upcoming ceremonies are chronological, future published only and limited to six", async () => {
  const auth = await actor(),
    Event = eventModel(await connectDatabase());
  for (let day = 8; day >= 1; day--)
    await Event.create({
      weddingId: auth.data.weddingId,
      name: `Future ${day}`,
      status: "published",
      startsAt: new Date(`2026-11-0${day}T12:00:00Z`),
      venue: "Hall",
    });
  await Event.create({
    weddingId: auth.data.weddingId,
    name: "Past",
    status: "published",
    startsAt: new Date("2026-01-01T12:00:00Z"),
  });
  const data = await dashboard(auth.data, now);
  assert.deepEqual(
    data.upcomingEvents.map((e) => e.eventName),
    ["Future 1", "Future 2", "Future 3", "Future 4", "Future 5", "Future 6"],
  );
  assert.equal(data.eventAttendance.length, 9);
  assert.ok(data.eventAttendance.every((e) => e.assignedFamilies === 0));
});
test("empty data is explicit and incomplete setup cannot open the dashboard", async () => {
  const auth = await actor(),
    data = await dashboard(auth.data, now);
  assert.equal(data.guests.families, 0);
  assert.deepEqual(data.upcomingEvents, []);
  assert.deepEqual(data.eventAttendance, []);
  assert.equal(data.serverNow, now.toISOString());
  const incomplete = await actor(false);
  await assert.rejects(dashboard(incomplete.data, now), {
    code: "SETUP_REQUIRED",
  });
});
test("tenant ownership and family joins exclude foreign and orphan assignments", async () => {
  const f = await fixture(),
    other = await fixture();
  await assert.rejects(
    dashboard({ ...f.auth.data, weddingId: other.auth.data.weddingId }, now),
    { code: "SETUP_REQUIRED" },
  );
  const c = await connectDatabase(),
    { Invitation } = familyModels(c);
  await Invitation.create([
    {
      weddingId: f.auth.data.weddingId,
      eventId: f.events[0]!.id,
      familyId: other.a.id,
      status: "attending",
      attendingCount: 99,
    },
    {
      weddingId: f.auth.data.weddingId,
      eventId: f.events[0]!.id,
      familyId: new Types.ObjectId(),
      status: "pending",
    },
  ]);
  const data = await dashboard(f.auth.data, now),
    event = data.eventAttendance.find((e) => e.eventId === f.events[0]!.id)!;
  assert.equal(event.assignedFamilies, 2);
  assert.equal(event.attendingMembers, 0);
  assert.equal(data.guests.familiesWithPendingRsvp, 2);
  assert.doesNotMatch(
    JSON.stringify(data),
    /tokenHash|accountId|familyId|@example/,
  );
});
test("API requires couple session, rejects filters, and returns safe unavailable errors", async () => {
  assert.equal(
    (await GET(new NextRequest(origin + "/api/dashboard"))).status,
    401,
  );
  const f = await fixture();
  const request = (suffix = "") =>
    new NextRequest(origin + "/api/dashboard" + suffix, {
      headers: { Cookie: `__Host-couple_session=${f.auth.token}` },
    });
  assert.equal((await GET(request("?weddingId=other"))).status, 400);
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  const { Family } = familyModels(await connectDatabase());
  const mocked = mock.method(Family, "aggregate", () => {
    throw new Error("private database details");
  });
  try {
    const unavailable = await GET(request());
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(
      await unavailable.text(),
      /private database details|"families":0/,
    );
  } finally {
    mocked.mock.restore();
  }
});

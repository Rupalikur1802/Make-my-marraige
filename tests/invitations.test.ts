import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
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
  deleteCeremony,
  getCeremony,
} from "../src/modules/events/service.server";
import {
  createFamily,
  getFamily,
  updateFamily,
  deleteFamily,
  replaceAssignments,
} from "../src/modules/families/service.server";
import {
  generateInvitationLink,
  exchangeInvitation,
  guestInvitation,
  prepareInvitationEmail,
  sendInvitationEmail,
  invitationManagement,
  acceptGuestInvitation,
} from "../src/modules/invitations/service.server";
import { invitationModels } from "../src/modules/invitations/model.server";
import {
  sendViaResend,
  deliverySettings,
  type EmailTransport,
} from "../src/modules/invitations/email.server";
import { POST as createLink } from "../src/app/api/families/[id]/invitation-link/route";
import { POST as exchange } from "../src/app/api/guest/exchange/route";
import { GET as guestGet } from "../src/app/api/guest/invitation/route";
import { POST as send } from "../src/app/api/families/[id]/email/route";
import { GET as familyGet } from "../src/app/api/families/route";
import { POST as acceptInvitation } from "../src/app/api/guest/accept/route";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const code = (expected: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === expected;
const origin = "https://wedding.example.test",
  password = "test-only-invitation-password";
const accepted: EmailTransport = async () => ({
  status: "accepted",
  id: "fixture-email-id",
});
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        {
          dbPath: mkdtempSync(join(process.cwd(), ".cache", "invitation-db-")),
        },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_invitations";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "test-only-invitation-secret-at-least-32-characters";
    process.env.INVITATION_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "test-only-not-a-live-key";
    process.env.EMAIL_FROM = "invites@example.test";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function fixture() {
  const email = "invite-" + ++sequence + "@example.test";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "invitation-test");
  await updateWedding(auth.data, {
    expectedVersion: 0,
    setupStatus: "complete",
    groomName: "Arjun",
    brideName: "Priya",
    weddingDate: "2026-12-10",
    venue: "Wedding Hall",
  });
  const events = await listCeremonies(auth.data),
    event = events[0]!;
  await updateCeremony(auth.data, event.id, {
    expectedVersion: 0,
    status: "published",
    startsAt: "2026-12-09T13:00:00.000Z",
    venue: "Published Hall",
  });
  const family = await createFamily(auth.data, {
    name: "Invited Family",
    email: "recipient@example.test",
    invitedCount: 4,
    eventIds: [event.id, events[1]!.id],
  });
  const link = await generateInvitationLink(auth.data, family.id, {
    expectedRevision: family.revision,
  });
  const token = new URLSearchParams(
    new URL(link.invitationUrl).hash.slice(1),
  ).get("token")!;
  return { auth, family, events, event, token, link };
}
async function prepare(
  f: Awaited<ReturnType<typeof fixture>>,
  now = new Date(),
) {
  const latest = await getFamily(f.auth.data, f.family.id);
  return prepareInvitationEmail(
    f.auth.data,
    f.family.id,
    {
      expectedRevision: latest.revision,
      token: f.token,
      requestKey: randomUUID(),
    },
    now,
  );
}

test("email invitation can be accepted explicitly and the owning couple sees it without changing ceremony attendance", async () => {
  const f = await fixture(),
    other = await fixture();
  const prepared = await prepare(f);
  assert.equal(
    (
      await sendInvitationEmail(
        f.auth.data,
        f.family.id,
        { attemptId: prepared.id, token: f.token },
        accepted,
      )
    ).status,
    "accepted",
  );
  const guest = await exchangeInvitation(f.token, "accept-flow");
  assert.equal(
    (await guestInvitation(guest.token)).family.invitationAcceptedAt,
    null,
  );
  const before = await getFamily(f.auth.data, f.family.id);
  assert.equal(before.invitationAcceptedAt, null);
  const results = await Promise.all([
    acceptGuestInvitation(guest.token),
    acceptGuestInvitation(guest.token),
  ]);
  assert.ok(results[0]!.family.invitationAcceptedAt);
  assert.equal(
    results[0]!.family.invitationAcceptedAt,
    results[1]!.family.invitationAcceptedAt,
  );
  const after = await getFamily(f.auth.data, f.family.id);
  assert.equal(
    after.invitationAcceptedAt,
    results[0]!.family.invitationAcceptedAt,
  );
  assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(after.eventAssignments, before.eventAssignments);
  assert.equal(
    (await invitationManagement(f.auth.data, f.family.id)).family
      .invitationAcceptedAt,
    after.invitationAcceptedAt,
  );
  await assert.rejects(
    getFamily(other.auth.data, f.family.id),
    code("NOT_FOUND"),
  );
});

test("acceptance requires the current unexpired guest session and persists through link replacement", async () => {
  const f = await fixture();
  await assert.rejects(
    acceptGuestInvitation(undefined),
    code("UNAUTHENTICATED"),
  );
  await assert.rejects(
    acceptGuestInvitation(f.auth.token),
    code("UNAUTHENTICATED"),
  );
  const guest = await exchangeInvitation(f.token, "accept-revocation");
  await assert.rejects(
    acceptGuestInvitation(guest.token, new Date(guest.expiresAt.getTime() + 1)),
    code("UNAUTHENTICATED"),
  );
  const result = await acceptGuestInvitation(guest.token);
  let family = await getFamily(f.auth.data, f.family.id);
  await generateInvitationLink(f.auth.data, family.id, {
    expectedRevision: family.revision,
    replace: true,
  });
  await assert.rejects(
    acceptGuestInvitation(guest.token),
    code("UNAUTHENTICATED"),
  );
  family = await getFamily(f.auth.data, f.family.id);
  assert.equal(family.invitationAcceptedAt, result.family.invitationAcceptedAt);
  await deleteFamily(f.auth.data, family.id, family.revision);
  await assert.rejects(
    acceptGuestInvitation(guest.token),
    code("UNAUTHENTICATED"),
  );
});

test("acceptance API rejects cross-origin requests and supplied identities; opening alone never accepts", async () => {
  const f = await fixture(),
    guest = await exchangeInvitation(f.token, "accept-api");
  const cookie = "__Host-guest_session=" + guest.token;
  assert.equal(
    (
      await acceptInvitation(
        request(
          "/api/guest/accept",
          "POST",
          {},
          cookie,
          "https://other.example.test",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await acceptInvitation(
        request("/api/guest/accept", "POST", { familyId: f.family.id }, cookie),
      )
    ).status,
    400,
  );
  assert.equal(
    (await acceptInvitation(request("/api/guest/accept", "POST", {}))).status,
    401,
  );
  await guestGet(request("/api/guest/invitation", "GET", undefined, cookie));
  assert.equal(
    (await getFamily(f.auth.data, f.family.id)).invitationAcceptedAt,
    null,
  );
  const response = await acceptInvitation(
    request("/api/guest/accept", "POST", {}, cookie),
  );
  assert.equal(response.status, 200);
  assert.ok((await response.json()).data.family.invitationAcceptedAt);
});
test("private link uses a fragment; database and DTOs contain no plaintext invitation token", async () => {
  const f = await fixture(),
    c = await connectDatabase();
  assert.equal(new URL(f.link.invitationUrl).pathname, "/invite");
  assert.equal(f.token.length, 43);
  const stored = await c.db!.collection("families").findOne({
    _id: new (await import("mongoose")).Types.ObjectId(f.family.id),
  });
  assert.equal(JSON.stringify(stored).includes(f.token), false);
  assert.equal(
    "tokenHash" in (await getFamily(f.auth.data, f.family.id)),
    false,
  );
  const a = await prepare(f);
  const record = await invitationModels(c)
    .EmailAttempt.findById(a.id)
    .select("+snapshot")
    .lean();
  assert.equal(JSON.stringify(record).includes(f.token), false);
});
test("guest exchange creates an independent hashed session and exposes only assigned published events", async () => {
  const f = await fixture(),
    guest = await exchangeInvitation(f.token, "guest-fixture"),
    data = await guestInvitation(guest.token);
  assert.equal(data.family.name, f.family.name);
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0]!.id, f.event.id);
  for (const forbidden of [
    "email",
    "tokenHash",
    "weddingId",
    "account",
    "expenses",
    "tasks",
  ])
    assert.equal(forbidden in data, false);
  assert.equal("email" in data.family, false);
  const stored = await invitationModels(await connectDatabase())
    .GuestSession.findOne({ kind: "guest", familyId: f.family.id })
    .select("+tokenHash")
    .lean();
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, guest.token);
  await assert.rejects(
    guestInvitation(guest.token, new Date(guest.expiresAt.getTime() + 1)),
    code("UNAUTHENTICATED"),
  );
  await updateCeremony(f.auth.data, f.event.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.event.id)).version,
    status: "draft",
  });
  assert.equal((await guestInvitation(guest.token)).events.length, 0);
});
test("replacement requires explicit confirmation, invalidates old link and revokes old guest sessions", async () => {
  const f = await fixture(),
    guest = await exchangeInvitation(f.token, "rotation");
  const latest = await getFamily(f.auth.data, f.family.id);
  await assert.rejects(
    generateInvitationLink(f.auth.data, f.family.id, {
      expectedRevision: latest.revision,
    }),
    code("REPLACEMENT_CONFIRMATION_REQUIRED"),
  );
  const replacement = await generateInvitationLink(f.auth.data, f.family.id, {
    expectedRevision: latest.revision,
    replace: true,
  });
  assert.notEqual(replacement.invitationUrl, f.link.invitationUrl);
  await assert.rejects(
    exchangeInvitation(f.token, "rotation"),
    code("INVITATION_UNAVAILABLE"),
  );
  await assert.rejects(guestInvitation(guest.token), code("UNAUTHENTICATED"));
  await assert.rejects(
    generateInvitationLink(f.auth.data, f.family.id, {
      expectedRevision: latest.revision,
      replace: true,
    }),
    code("VERSION_CONFLICT"),
  );
});
test("foreign family IDs cannot generate links, preview emails or send", async () => {
  const a = await fixture(),
    b = await fixture();
  await assert.rejects(
    generateInvitationLink(a.auth.data, b.family.id, {
      expectedRevision: b.link.revision,
    }),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    prepareInvitationEmail(a.auth.data, b.family.id, {
      expectedRevision: b.link.revision,
      token: b.token,
      requestKey: randomUUID(),
    }),
    code("NOT_FOUND"),
  );
  const p = await prepare(b);
  await assert.rejects(
    sendInvitationEmail(
      a.auth.data,
      b.family.id,
      { attemptId: p.id, token: b.token },
      accepted,
    ),
    code("NOT_FOUND"),
  );
});
test("preparing a preview never sends; recipient is saved contact and draft ceremonies are excluded", async () => {
  const f = await fixture(),
    key = randomUUID(),
    body = {
      expectedRevision: f.link.revision,
      token: f.token,
      requestKey: key,
    };
  const p = await prepareInvitationEmail(f.auth.data, f.family.id, body),
    replay = await prepareInvitationEmail(f.auth.data, f.family.id, body);
  assert.equal(p.id, replay.id);
  assert.equal(p.status, "ready");
  assert.equal(p.preview.recipient, "recipient@example.test");
  assert.equal(p.preview.invitation.events.length, 1);
  await assert.rejects(
    prepareInvitationEmail(f.auth.data, f.family.id, {
      ...body,
      recipient: "outsider@example.test",
    }),
  );
  const latest = await getFamily(f.auth.data, f.family.id);
  await updateFamily(f.auth.data, f.family.id, {
    expectedRevision: latest.revision,
    email: null,
  });
  await assert.rejects(prepare(f), code("EMAIL_REQUIRED"));
});
test("accepted sends replay locally without calling provider twice and require explicit resend", async () => {
  const f = await fixture(),
    p = await prepare(f);
  let calls = 0;
  const transport: EmailTransport = async (payload, key) => {
    calls++;
    assert.equal(payload.to.length, 1);
    assert.equal(payload.to[0], "recipient@example.test");
    assert.match(key, /^invitation\//);
    assert.match(payload.text, new RegExp(f.token));
    return { status: "accepted", id: "fixture-id" };
  };
  const body = { attemptId: p.id, token: f.token };
  assert.equal(
    (await sendInvitationEmail(f.auth.data, f.family.id, body, transport))
      .status,
    "accepted",
  );
  assert.equal(
    (await sendInvitationEmail(f.auth.data, f.family.id, body, transport))
      .status,
    "accepted",
  );
  assert.equal(calls, 1);
  await assert.rejects(prepare(f), code("RESEND_CONFIRMATION_REQUIRED"));
  const latest = await getFamily(f.auth.data, f.family.id),
    future = new Date(Date.now() + 61000);
  const resend = await prepareInvitationEmail(
    f.auth.data,
    f.family.id,
    {
      expectedRevision: latest.revision,
      token: f.token,
      requestKey: randomUUID(),
      confirmResend: true,
    },
    future,
  );
  assert.notEqual(resend.id, p.id);
});
test("concurrent requests have one provider caller and expose in-progress status", async () => {
  const f = await fixture(),
    p = await prepare(f);
  let release!: () => void, started!: () => void;
  const began = new Promise<void>((r) => {
    started = r;
  });
  const waiting = new Promise<void>((r) => {
    release = r;
  });
  let calls = 0;
  const transport: EmailTransport = async () => {
    calls++;
    started();
    await waiting;
    return { status: "accepted", id: "concurrent-id" };
  };
  const first = sendInvitationEmail(
    f.auth.data,
    f.family.id,
    { attemptId: p.id, token: f.token },
    transport,
  );
  await began;
  try {
    await assert.rejects(
      sendInvitationEmail(
        f.auth.data,
        f.family.id,
        { attemptId: p.id, token: f.token },
        transport,
      ),
      code("SEND_IN_PROGRESS"),
    );
  } finally {
    release();
  }
  await first;
  assert.equal(calls, 1);
});
test("uncertain and failed sends retry the exact immutable payload with the same provider key", async () => {
  const f = await fixture(),
    p = await prepare(f),
    payloads: string[] = [],
    keys: string[] = [];
  const transport: EmailTransport = async (payload, key) => {
    payloads.push(JSON.stringify(payload));
    keys.push(key);
    return payloads.length === 1
      ? { status: "failed" }
      : payloads.length === 2
        ? { status: "uncertain" }
        : { status: "accepted", id: "retry-id" };
  };
  const body = { attemptId: p.id, token: f.token };
  assert.equal(
    (await sendInvitationEmail(f.auth.data, f.family.id, body, transport))
      .status,
    "failed",
  );
  assert.equal(
    (await sendInvitationEmail(f.auth.data, f.family.id, body, transport))
      .status,
    "uncertain",
  );
  await assert.rejects(prepare(f), code("SEND_UNRESOLVED"));
  assert.equal(
    (await sendInvitationEmail(f.auth.data, f.family.id, body, transport))
      .status,
    "accepted",
  );
  assert.equal(payloads[0], payloads[1]);
  assert.equal(keys[0], keys[1]);
  assert.equal(payloads[1], payloads[2]);
  assert.equal(keys[1], keys[2]);
});

test("expired send lease recovers a crashed caller using the same provider key", async () => {
  const f = await fixture(),
    now = new Date(),
    p = await prepare(f, now),
    keys = new Set<string>();
  let actualEmails = 0;
  const crash: EmailTransport = async (_payload, key) => {
    if (!keys.has(key)) {
      keys.add(key);
      actualEmails++;
    }
    throw new Error("simulated caller termination");
  };
  const body = { attemptId: p.id, token: f.token };
  await assert.rejects(
    sendInvitationEmail(f.auth.data, f.family.id, body, crash, now),
  );
  const recover: EmailTransport = async (_payload, key) => {
    if (!keys.has(key)) {
      keys.add(key);
      actualEmails++;
    }
    return { status: "accepted", id: "recovered-id" };
  };
  const result = await sendInvitationEmail(
    f.auth.data,
    f.family.id,
    body,
    recover,
    new Date(now.getTime() + 61000),
  );
  assert.equal(result.status, "accepted");
  assert.equal(actualEmails, 1);
});
test("retry window expires before provider deduplication expiry; stale preview does not send", async () => {
  const f = await fixture(),
    now = new Date(),
    p = await prepare(f, now);
  let calls = 0;
  const transport: EmailTransport = async () => {
    calls++;
    return { status: "accepted", id: "never" };
  };
  await assert.rejects(
    sendInvitationEmail(
      f.auth.data,
      f.family.id,
      { attemptId: p.id, token: f.token },
      transport,
      new Date(now.getTime() + 24 * 3600000),
    ),
    code("RETRY_WINDOW_EXPIRED"),
  );
  assert.equal(calls, 0);
  const family = await getFamily(f.auth.data, f.family.id);
  await updateFamily(f.auth.data, f.family.id, {
    expectedRevision: family.revision,
    email: "changed@example.test",
  });
  await assert.rejects(
    sendInvitationEmail(
      f.auth.data,
      f.family.id,
      { attemptId: p.id, token: f.token },
      transport,
    ),
    code("VERSION_CONFLICT"),
  );
  assert.equal(calls, 0);
});
test("ceremony and wedding edits invalidate email preview without changing link", async () => {
  const f = await fixture(),
    p = await prepare(f);
  await updateCeremony(f.auth.data, f.event.id, {
    expectedVersion: (await getCeremony(f.auth.data, f.event.id)).version,
    venue: "New venue",
  });
  await assert.rejects(
    sendInvitationEmail(
      f.auth.data,
      f.family.id,
      { attemptId: p.id, token: f.token },
      accepted,
    ),
    code("VERSION_CONFLICT"),
  );
  const guest = await exchangeInvitation(f.token, "updated-event");
  assert.equal(
    (await guestInvitation(guest.token)).events[0]!.venue,
    "New venue",
  );
  const next = await prepare(f);
  await updateWedding(f.auth.data, {
    expectedVersion: 1,
    groomName: "Updated name",
  });
  await assert.rejects(
    sendInvitationEmail(
      f.auth.data,
      f.family.id,
      { attemptId: next.id, token: f.token },
      accepted,
    ),
    code("VERSION_CONFLICT"),
  );
});
test("removing assignment and deleting event/family immediately restricts guest access and cleans receipts", async () => {
  const f = await fixture(),
    p = await prepare(f),
    guest = await exchangeInvitation(f.token, "cleanup");
  let family = await getFamily(f.auth.data, f.family.id);
  await replaceAssignments(f.auth.data, f.family.id, {
    expectedRevision: family.revision,
    eventIds: [],
  });
  assert.equal((await guestInvitation(guest.token)).events.length, 0);
  family = await getFamily(f.auth.data, f.family.id);
  await replaceAssignments(f.auth.data, f.family.id, {
    expectedRevision: family.revision,
    eventIds: [f.event.id],
  });
  assert.equal((await guestInvitation(guest.token)).events.length, 1);
  await deleteCeremony(
    f.auth.data,
    f.event.id,
    (await getCeremony(f.auth.data, f.event.id)).version,
  );
  assert.equal((await guestInvitation(guest.token)).events.length, 0);
  family = await getFamily(f.auth.data, f.family.id);
  await deleteFamily(f.auth.data, f.family.id, family.revision);
  await assert.rejects(guestInvitation(guest.token), code("UNAUTHENTICATED"));
  assert.equal(
    await invitationModels(await connectDatabase()).EmailAttempt.countDocuments(
      { _id: p.id },
    ),
    0,
  );
  await assert.rejects(
    exchangeInvitation(f.token, "cleanup"),
    code("INVITATION_UNAVAILABLE"),
  );
});
test("missing credentials or local origin disables live sends without disabling link preview", async () => {
  const f = await fixture(),
    p = await prepare(f);
  process.env.INVITATION_EMAIL_ENABLED = "false";
  try {
    assert.equal(deliverySettings().available, false);
    await assert.rejects(
      sendInvitationEmail(
        f.auth.data,
        f.family.id,
        { attemptId: p.id, token: f.token },
        accepted,
      ),
      code("EMAIL_UNAVAILABLE"),
    );
    assert.ok(
      (await invitationManagement(f.auth.data, f.family.id)).invitation.events
        .length,
    );
  } finally {
    process.env.INVITATION_EMAIL_ENABLED = "true";
  }
  process.env.APP_ORIGIN = "http://localhost:3000";
  try {
    assert.equal(deliverySettings().available, false);
  } finally {
    process.env.APP_ORIGIN = origin;
  }
});
test("provider adapter uses one-recipient Resend request and classifies acceptance/failure/uncertainty", async () => {
  let mode = 200,
    seen = 0;
  const server = createServer(async (request, response) => {
    seen++;
    assert.equal(request.headers["idempotency-key"], "fixture-key");
    let text = "";
    for await (const chunk of request) text += chunk;
    assert.equal(JSON.parse(text).to.length, 1);
    response.writeHead(mode, { "Content-Type": "application/json" });
    response.end(
      mode === 200
        ? JSON.stringify({ id: "local-provider-id" })
        : JSON.stringify({ message: "private provider details" }),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error();
  const realFetch = globalThis.fetch;
  const replacement = mock.method(
    globalThis,
    "fetch",
    async (
      url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      assert.equal(url, "https://api.resend.com/emails");
      return realFetch("http://127.0.0.1:" + addr.port, init);
    },
  );
  const payload = {
    from: "invites@example.test",
    to: ["recipient@example.test"],
    subject: "Fixture",
    text: "Fixture",
    html: "<p>Fixture</p>",
  };
  try {
    assert.equal(
      (await sendViaResend(payload, "fixture-key")).status,
      "accepted",
    );
    mode = 422;
    assert.equal(
      (await sendViaResend(payload, "fixture-key")).status,
      "failed",
    );
    mode = 500;
    assert.equal(
      (await sendViaResend(payload, "fixture-key")).status,
      "uncertain",
    );
    assert.equal(seen, 3);
  } finally {
    replacement.mock.restore();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  requestOrigin = origin,
) {
  return new NextRequest(origin + path, {
    method,
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("HTTP auth, Origin and cookie isolation protect management and guest resources", async () => {
  const f = await fixture(),
    context = { params: Promise.resolve({ id: f.family.id }) },
    coupleCookie = "__Host-couple_session=" + f.auth.token;
  assert.equal(
    (
      await createLink(
        request("/api/families/x/invitation-link", "POST", {
          expectedRevision: 0,
        }),
        context,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await createLink(
        request(
          "/api/families/x/invitation-link",
          "POST",
          { expectedRevision: 0 },
          coupleCookie,
          "https://evil.example.test",
        ),
        context,
      )
    ).status,
    403,
  );
  const opened = await exchange(
    request("/api/guest/exchange", "POST", { token: f.token }),
  );
  assert.equal(opened.status, 200);
  const cookie = opened.headers.get("set-cookie")!.split(";")[0]!;
  assert.match(opened.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(opened.headers.get("set-cookie")!, /Secure/);
  assert.match(opened.headers.get("set-cookie")!, /SameSite=Lax/i);
  assert.equal(
    (await guestGet(request("/api/guest/invitation", "GET", undefined, cookie)))
      .status,
    200,
  );
  assert.equal(
    (await familyGet(request("/api/families", "GET", undefined, cookie)))
      .status,
    401,
  );
  assert.equal(
    (
      await guestGet(
        request(
          "/api/guest/invitation",
          "GET",
          undefined,
          "__Host-guest_session=" + f.auth.token,
        ),
      )
    ).status,
    401,
  );
  assert.equal(opened.headers.get("referrer-policy"), "no-referrer");
  const prepared = await prepare(f);
  process.env.INVITATION_EMAIL_ENABLED = "false";
  try {
    const disabled = await send(
      request(
        "/api/families/" + f.family.id + "/email",
        "POST",
        { attemptId: prepared.id, token: f.token },
        coupleCookie,
      ),
      context,
    );
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error.code, "EMAIL_UNAVAILABLE");
  } finally {
    process.env.INVITATION_EMAIL_ENABLED = "true";
  }
  const guestToken = cookie.split("=")[1]!;
  assert.equal(
    (
      await familyGet(
        request(
          "/api/families",
          "GET",
          undefined,
          "__Host-couple_session=" + guestToken,
        ),
      )
    ).status,
    401,
  );
});
test("invalid token guessing is throttled without disclosing family existence", async () => {
  const token = "z".repeat(43);
  for (let i = 0; i < 20; i++)
    await assert.rejects(
      exchangeInvitation(token, "invalid-test"),
      code("INVITATION_UNAVAILABLE"),
    );
  await assert.rejects(
    exchangeInvitation(token, "invalid-test"),
    code("RATE_LIMITED"),
  );
});

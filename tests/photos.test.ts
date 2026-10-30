import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
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
} from "../src/modules/events/service.server";
import {
  createFamily,
  getFamily,
  deleteFamily,
} from "../src/modules/families/service.server";
import {
  generateInvitationLink,
  exchangeInvitation,
} from "../src/modules/invitations/service.server";
import {
  beginPhotoUpload,
  completePhotoUpload,
  listPhotos,
  savePhotoSettings,
  deletePhoto,
  photoImage,
  cleanupPhotoUploads,
  type PhotoPrincipal,
} from "../src/modules/photos/service.server";
import {
  photoProvider,
  photoConfig,
  signPhotoUpload,
  validateProviderPhoto,
  THUMB,
  LARGE,
} from "../src/modules/photos/provider.server";
import { photoModels } from "../src/modules/photos/model.server";
import {
  MAX_PHOTO_BYTES,
  PHOTO_RESERVATION,
  WEDDING_PHOTO_LIMIT,
  uploadSchema,
} from "../src/modules/photos/validation";
import { photoRoutes } from "../src/modules/photos/http.server";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const now = new Date(),
  origin = "https://photos.example.test";
const code = (expected: string) => (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === expected;
const details = {
  width: 100,
  height: 120,
  format: "jpg",
  providerVersion: 123,
};
const data = () => ({
  filename: "Wedding moment.jpg",
  size: 12345,
  contentType: "image/jpeg",
  requestKey: randomUUID(),
});
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "photos-db-")) },
      ],
    });
    Object.assign(process.env, {
      MONGODB_URI: mongo.getUri(),
      MONGODB_DB: "mmm_test_photos",
      APP_ORIGIN: origin,
      RATE_LIMIT_SECRET: "test-only-photos-secret-at-least-32-characters",
      INVITATION_EMAIL_ENABLED: "false",
      CLOUDINARY_CLOUD_NAME: "test-only",
      CLOUDINARY_API_KEY: "test-key",
      CLOUDINARY_API_SECRET: "test-secret",
      CLOUDINARY_PHOTO_PREFIX: "mmm_test_photos",
    });
    await ensureAuthIndexes();
    mock.method(photoProvider, "inspect", async () => details);
    mock.method(photoProvider, "remove", async () => {});
    mock.method(
      photoProvider,
      "image",
      async () =>
        new Response("fixture-image", {
          headers: { "Content-Type": "image/jpeg" },
        }),
    );
  },
  { timeout: 600000 },
);
after(async () => {
  mock.restoreAll();
  await disconnectDatabase();
  await mongo?.stop();
});
async function fixture(complete = true) {
  const email = "photos-" + ++sequence + "@example.test",
    password = "test-only-photo-password";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "photos-test");
  if (complete)
    await updateWedding(auth.data, {
      expectedVersion: 0,
      setupStatus: "complete",
      groomName: "Arjun",
      brideName: "Priya",
      weddingDate: "2026-12-10",
      venue: "Hall",
    });
  const p: PhotoPrincipal = { kind: "couple", actor: auth.data };
  return { auth, p };
}
async function guest(f: Awaited<ReturnType<typeof fixture>>) {
  const e = (await listCeremonies(f.auth.data))[0]!;
  await updateCeremony(f.auth.data, e.id, {
    expectedVersion: e.version,
    status: "published",
    startsAt: "2026-12-09T12:00:00Z",
    venue: "Hall",
  });
  const family = await createFamily(f.auth.data, {
    name: "Family",
    invitedCount: 2,
    eventIds: [e.id],
  });
  const link = await generateInvitationLink(f.auth.data, family.id, {
    expectedRevision: family.revision,
  });
  const token = new URLSearchParams(
    new URL(link.invitationUrl).hash.slice(1),
  ).get("token")!;
  const session = await exchangeInvitation(token, "photos-test");
  return {
    p: { kind: "guest", token: session.token } as PhotoPrincipal,
    family,
  };
}
test("strict upload validation rejects oversized, invalid types and injected ownership", () => {
  for (const v of [
    { ...data(), size: MAX_PHOTO_BYTES + 1 },
    { ...data(), size: 0 },
    { ...data(), size: 1.5 },
    { ...data(), contentType: "image/svg+xml" },
    { ...data(), filename: "../private.jpg" },
    { ...data(), weddingId: randomUUID() },
  ])
    assert.equal(uploadSchema.safeParse(v).success, false);
});
test("configuration is lazy and fails closed without an isolated namespace", () => {
  const saved = process.env.CLOUDINARY_PHOTO_PREFIX;
  delete process.env.CLOUDINARY_PHOTO_PREFIX;
  assert.throws(photoConfig, code("PHOTO_CONFIGURATION_REQUIRED"));
  process.env.CLOUDINARY_PHOTO_PREFIX = "mmm_prod_wrong";
  assert.throws(photoConfig, code("PHOTO_CONFIGURATION_REQUIRED"));
  process.env.CLOUDINARY_PHOTO_PREFIX = saved;
});
test("upload ticket fixes authenticated storage, target and transformations without exposing secret", () => {
  const ticket = signPhotoUpload("mmm_test_photos/fixed/photo", 123);
  assert.equal(ticket.fields.type, "authenticated");
  assert.equal(ticket.fields.overwrite, "false");
  assert.ok(ticket.fields.transformation!.includes("fl_strip_profile"));
  assert.equal(ticket.fields.public_id, "mmm_test_photos/fixed/photo");
  assert.ok(!JSON.stringify(ticket).includes("test-secret"));
});
test("pending uploads stay hidden; completion and same-key retries are idempotent", async () => {
  const f = await fixture(),
    input = data();
  const [a, b] = await Promise.all([
    beginPhotoUpload(f.p, input, now),
    beginPhotoUpload(f.p, input, now),
  ]);
  assert.equal(a.id, b.id);
  assert.equal((await listPhotos(f.p)).photos.length, 0);
  const result = await completePhotoUpload(f.p, a.id, now);
  assert.equal(result.filename, input.filename);
  assert.equal((await completePhotoUpload(f.p, a.id, now)).id, a.id);
  assert.equal((await beginPhotoUpload(f.p, input, now)).ready, true);
  assert.equal((await listPhotos(f.p)).photos.length, 1);
  await assert.rejects(
    beginPhotoUpload(f.p, { ...input, filename: "Changed.jpg" }, now),
    code("IDEMPOTENCY_CONFLICT"),
  );
  const rows = await photoModels(await connectDatabase())
    .Photo.find({ weddingId: f.auth.data.weddingId })
    .lean();
  assert.equal(rows.length, 1);
});
test("tenant isolation, safe DTO and incomplete wedding setup", async () => {
  const a = await fixture(),
    b = await fixture(),
    draft = await fixture(false);
  const t = await beginPhotoUpload(a.p, data());
  await completePhotoUpload(a.p, t.id);
  assert.equal((await listPhotos(b.p)).photos.length, 0);
  await assert.rejects(photoImage(b.p, t.id, false), code("NOT_FOUND"));
  await assert.rejects(deletePhoto(b.p, t.id), code("NOT_FOUND"));
  await assert.rejects(listPhotos(draft.p), code("SETUP_REQUIRED"));
  const dto = (await listPhotos(a.p)).photos[0]!;
  assert.deepEqual(Object.keys(dto).sort(), [
    "createdAt",
    "filename",
    "height",
    "id",
    "uploadedBy",
    "width",
  ]);
});
test("guest shares wedding gallery, cannot delete/change access; pause blocks every entry point", async () => {
  const f = await fixture(),
    g = await guest(f);
  const t = await beginPhotoUpload(g.p, data());
  await completePhotoUpload(g.p, t.id);
  assert.equal((await listPhotos(f.p)).photos[0]!.uploadedBy, "Guest");
  await assert.rejects(deletePhoto(g.p, t.id), code("FORBIDDEN"));
  await assert.rejects(
    savePhotoSettings(g.p, { guestAccess: false, expectedVersion: 0 }),
    code("FORBIDDEN"),
  );
  const pending = await beginPhotoUpload(g.p, data());
  await savePhotoSettings(f.p, { guestAccess: false, expectedVersion: 0 });
  for (const fn of [
    () => listPhotos(g.p),
    () => beginPhotoUpload(g.p, data()),
    () => completePhotoUpload(g.p, pending.id),
    () => photoImage(g.p, t.id, false),
  ])
    await assert.rejects(fn(), code("PHOTO_ACCESS_PAUSED"));
  assert.equal((await listPhotos(f.p)).photos.length, 1);
  await savePhotoSettings(f.p, { guestAccess: true, expectedVersion: 1 });
  assert.equal((await listPhotos(g.p)).photos.length, 1);
});
test("revoked/deleted families lose gallery and media access", async () => {
  const f = await fixture(),
    g = await guest(f);
  const t = await beginPhotoUpload(f.p, data());
  await completePhotoUpload(f.p, t.id);
  const latest = await getFamily(f.auth.data, g.family.id);
  await deleteFamily(f.auth.data, g.family.id, latest.revision);
  await assert.rejects(listPhotos(g.p));
  await assert.rejects(photoImage(g.p, t.id, true));
  assert.equal((await listPhotos(f.p)).photos.length, 1);
});
test("settings conflicts are explicit and wedding date does not expire gallery", async () => {
  const f = await fixture();
  await savePhotoSettings(f.p, { guestAccess: false, expectedVersion: 0 });
  await assert.rejects(
    savePhotoSettings(f.p, { guestAccess: true, expectedVersion: 0 }),
    code("VERSION_CONFLICT"),
  );
  assert.equal((await listPhotos(f.p)).guestAccess, false);
});
test("failed provider checks retain pending records for retry and cleanup", async () => {
  const f = await fixture(),
    t = await beginPhotoUpload(f.p, data());
  const m = mock.method(photoProvider, "inspect", async () => {
    throw Error("fixture failure");
  });
  await assert.rejects(completePhotoUpload(f.p, t.id));
  assert.equal((await listPhotos(f.p)).photos.length, 0);
  m.mock.restore();
  await completePhotoUpload(f.p, t.id);
  assert.equal((await listPhotos(f.p)).photos.length, 1);
});
test("concurrent completion permits one lease and eventually one visible photo", async () => {
  const f = await fixture(),
    t = await beginPhotoUpload(f.p, data());
  const results = await Promise.allSettled([
    completePhotoUpload(f.p, t.id),
    completePhotoUpload(f.p, t.id),
  ]);
  assert.ok(results.some((r) => r.status === "fulfilled"));
  assert.equal((await listPhotos(f.p)).photos.length, 1);
});
test("deletion failure remains hidden and retry releases capacity exactly once", async () => {
  const f = await fixture(),
    t = await beginPhotoUpload(f.p, data());
  await completePhotoUpload(f.p, t.id);
  const m = mock.method(photoProvider, "remove", async () => {
    throw Error("fixture failure");
  });
  await assert.rejects(deletePhoto(f.p, t.id));
  assert.equal((await listPhotos(f.p)).photos.length, 0);
  const { Gallery } = photoModels(await connectDatabase());
  assert.equal(
    (await Gallery.findById(f.auth.data.weddingId).lean())!.reservedBytes,
    PHOTO_RESERVATION,
  );
  m.mock.restore();
  await deletePhoto(f.p, t.id);
  await deletePhoto(f.p, t.id);
  assert.equal(
    (await Gallery.findById(f.auth.data.weddingId).lean())!.reservedBytes,
    0,
  );
});
test("cleanup removes only expired pending/deleting/tombstones and preserves ready photos", async () => {
  const f = await fixture(),
    a = await beginPhotoUpload(f.p, data(), now),
    b = await beginPhotoUpload(f.p, data(), now);
  await completePhotoUpload(f.p, a.id, now);
  const result = await cleanupPhotoUploads(
    new Date(now.getTime() + 3 * 60 * 60 * 1000),
  );
  assert.ok(result.cleaned >= 1);
  assert.equal((await listPhotos(f.p)).photos[0]!.id, a.id);
  const row = await photoModels(await connectDatabase())
    .Photo.findById(b.id)
    .lean();
  assert.equal(row!.state, "deleted");
  assert.equal(row!.cleaned, true);
});
test("wedding quota rejects tickets before provider credentials and rolls back counters", async () => {
  const f = await fixture();
  await listPhotos(f.p);
  const { Gallery, Usage } = photoModels(await connectDatabase());
  await Gallery.create({
    _id: f.auth.data.weddingId,
    reservedBytes: WEDDING_PHOTO_LIMIT,
  });
  const before = await Usage.findById("test-only:mmm_test_photos").lean();
  await assert.rejects(
    beginPhotoUpload(f.p, data()),
    code("PHOTO_STORAGE_FULL"),
  );
  assert.equal(
    (await Usage.findById("test-only:mmm_test_photos").lean())?.reservedBytes,
    before?.reservedBytes,
  );
});
test("rate limit and ticket expiry are enforced without extending upload timestamps", async () => {
  const f = await fixture();
  for (let i = 0; i < 20; i++) await beginPhotoUpload(f.p, data(), now);
  await assert.rejects(
    beginPhotoUpload(f.p, data(), now),
    code("RATE_LIMITED"),
  );
  const other = await fixture(),
    input = data(),
    ticket = await beginPhotoUpload(other.p, input, now);
  await assert.rejects(
    beginPhotoUpload(other.p, input, new Date(now.getTime() + 56 * 60 * 1000)),
    code("UPLOAD_EXPIRED"),
  );
  assert.equal(
    (await photoModels(await connectDatabase())
      .Photo.findById(ticket.id)
      .lean())!.signedAt,
    Math.floor(now.getTime() / 1000),
  );
});
test("HTTP authenticates, enforces Origin, rejects fields and protects media headers", async () => {
  const f = await fixture(),
    r = photoRoutes(false);
  const req = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = true,
    o = origin,
  ) =>
    new NextRequest(origin + path, {
      method,
      headers: {
        ...(cookie ? { cookie: "__Host-couple_session=" + f.auth.token } : {}),
        origin: o,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await r.list(req("/api/photos", "GET", undefined, false))).status,
    401,
  );
  assert.equal(
    (
      await r.begin(
        req("/api/photos/uploads", "POST", data(), true, "https://evil.test"),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await r.begin(
        req("/api/photos/uploads", "POST", { ...data(), publicId: "x" }),
      )
    ).status,
    400,
  );
  const t = await beginPhotoUpload(f.p, data());
  await completePhotoUpload(f.p, t.id);
  const image = await r.image(req("/api/photos/" + t.id + "/media"), {
    params: Promise.resolve({ id: t.id }),
  });
  assert.equal(image.status, 200);
  assert.ok(image.headers.get("cache-control")!.includes("no-store"));
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.equal(await image.text(), "fixture-image");
  const completion = await r.complete(
    new NextRequest(origin + "/api/photos/" + t.id + "/complete", {
      method: "POST",
      body: "",
      headers: { cookie: "__Host-couple_session=" + f.auth.token, origin },
    }),
    { params: Promise.resolve({ id: t.id }) },
  );
  assert.equal(completion.status, 200);
  assert.equal(
    (
      await r.complete(
        new NextRequest(origin + "/api/photos/" + t.id + "/complete", {
          method: "POST",
          body: "{}",
          headers: { cookie: "__Host-couple_session=" + f.auth.token, origin },
        }),
        { params: Promise.resolve({ id: t.id }) },
      )
    ).status,
    400,
  );
});
test("provider validation rejects malformed, foreign, animated and oversized media", () => {
  const resource = {
    public_id: "fixture/photo",
    resource_type: "image",
    type: "authenticated",
    format: "jpg",
    version: 1,
    bytes: 1000,
    width: 100,
    height: 100,
    derived: [
      { transformation: THUMB, format: "jpg", bytes: 500 },
      { transformation: LARGE, format: "jpg", bytes: 800 },
    ],
  };
  assert.equal(validateProviderPhoto(resource, "fixture/photo").width, 100);
  for (const invalid of [
    { ...resource, public_id: "foreign/photo" },
    { ...resource, type: "upload" },
    { ...resource, pages: 2 },
    { ...resource, bytes: MAX_PHOTO_BYTES + 1 },
    { ...resource, width: 5000 },
    { ...resource, version: undefined },
    { ...resource, derived: [] },
    {
      ...resource,
      derived: [{ transformation: THUMB, format: "jpg", bytes: -1 }],
    },
  ])
    assert.throws(
      () => validateProviderPhoto(invalid, "fixture/photo"),
      code("INVALID_PHOTO"),
    );
});
test("gallery pagination is stable, disjoint and rejects unrecognized filters", async () => {
  const f = await fixture(),
    t = await beginPhotoUpload(f.p, data());
  await completePhotoUpload(f.p, t.id);
  const { Photo } = photoModels(await connectDatabase()),
    sample = await Photo.findById(t.id).lean();
  await Photo.insertMany(
    Array.from({ length: 25 }, () => {
      const id = new (
        sample!._id.constructor as typeof import("mongoose").Types.ObjectId
      )();
      return {
        ...sample!,
        _id: id,
        requestKey: randomUUID(),
        publicId: "test-only/" + id,
      };
    }),
  );
  const first = await listPhotos(f.p),
    second = await listPhotos(f.p, { before: first.nextCursor });
  assert.equal(first.photos.length, 24);
  assert.equal(second.photos.length, 2);
  assert.equal(
    new Set([...first.photos, ...second.photos].map((p) => p.id)).size,
    26,
  );
  assert.equal(second.nextCursor, null);
  await assert.rejects(listPhotos(f.p, { weddingId: "foreign" }));
});
test("pausing during provider validation prevents publishing a guest upload", async () => {
  const f = await fixture(),
    g = await guest(f),
    t = await beginPhotoUpload(g.p, data());
  const m = mock.method(photoProvider, "inspect", async () => {
    await savePhotoSettings(f.p, { guestAccess: false, expectedVersion: 0 });
    return details;
  });
  try {
    await assert.rejects(
      completePhotoUpload(g.p, t.id),
      code("PHOTO_ACCESS_PAUSED"),
    );
    assert.equal((await listPhotos(f.p)).photos.length, 0);
  } finally {
    m.mock.restore();
  }
});
test("cleanup claims cannot remove a concurrently completed ready photo", async () => {
  const f = await fixture(),
    t = await beginPhotoUpload(f.p, data(), now);
  await completePhotoUpload(f.p, t.id, now);
  await cleanupPhotoUploads(new Date(now.getTime() + 365 * 86400000));
  assert.equal((await listPhotos(f.p)).photos[0]!.id, t.id);
});
test("missing retry index fails closed with actionable setup error", async () => {
  const c = await connectDatabase(),
    { Photo } = photoModels(c),
    f = await fixture();
  await Photo.collection.dropIndex("weddingId_1_requestKey_1");
  try {
    await assert.rejects(listPhotos(f.p), code("PHOTO_SETUP_REQUIRED"));
  } finally {
    await Photo.createIndexes();
  }
});

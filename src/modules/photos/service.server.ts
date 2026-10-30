import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Types, type ClientSession, type Connection } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { AuthError } from "@/modules/auth/errors";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { resolveGuestSession } from "@/modules/invitations/service.server";
import { familyModels } from "@/modules/families/model.server";
import { weddingModel } from "@/modules/wedding/model.server";
import {
  photoModels,
  requirePhotoIndexes,
  type PhotoRecord,
} from "./model.server";
import { photoConfig, photoProvider, signPhotoUpload } from "./provider.server";
import {
  uploadSchema,
  galleryQuerySchema,
  photoIdSchema,
  settingsSchema,
  PHOTO_RESERVATION,
  WEDDING_PHOTO_LIMIT,
  APPLICATION_PHOTO_LIMIT,
  type GalleryDTO,
  type PhotoDTO,
} from "./validation";
export type PhotoPrincipal =
  | {
      kind: "couple";
      actor: NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
    }
  | { kind: "guest"; token: string | undefined };
const missing = () =>
  new AuthError("NOT_FOUND", 404, "This photo is no longer available.");
const paused = () =>
  new AuthError(
    "PHOTO_ACCESS_PAUSED",
    403,
    "The couple has paused guest access to the wedding gallery.",
  );
const conflict = () =>
  new AuthError(
    "VERSION_CONFLICT",
    409,
    "Photo settings changed on another device. Refresh before saving again.",
  );
async function access(
  c: Connection,
  p: PhotoPrincipal,
  session: ClientSession,
  write = false,
  now = new Date(),
) {
  let weddingId: Types.ObjectId, principalKey: string;
  if (p.kind === "couple") {
    weddingId = new Types.ObjectId(p.actor.weddingId);
    if (
      !(await weddingModel(c)
        .exists({
          _id: weddingId,
          ownerAccountId: p.actor.account.id,
          setupStatus: "complete",
        })
        .session(session))
    )
      throw new AuthError(
        "SETUP_REQUIRED",
        409,
        "Complete wedding setup before using photos.",
      );
    principalKey = "couple:" + p.actor.account.id;
  } else {
    const saved = await resolveGuestSession(p.token, session, now);
    const filter = {
      _id: saved.familyId,
      weddingId: saved.weddingId,
      tokenVersion: saved.tokenVersion,
      tokenHash: { $type: "string" as const },
    };
    const Family = familyModels(c).Family;
    const family = write
      ? await Family.findOneAndUpdate(
          filter,
          { $inc: { revision: 1 } },
          { session, returnDocument: "after" },
        ).lean()
      : await Family.findOne(filter).session(session).lean();
    if (
      !family ||
      !(await weddingModel(c)
        .exists({ _id: saved.weddingId, setupStatus: "complete" })
        .session(session))
    )
      throw new AuthError(
        "UNAUTHENTICATED",
        401,
        "Open your invitation link to access wedding photos.",
      );
    weddingId = saved.weddingId;
    principalKey = "guest:" + family._id + ":" + saved.tokenVersion;
  }
  const { Gallery } = photoModels(c);
  const gallery = write
    ? await Gallery.findOneAndUpdate(
        { _id: weddingId },
        { $inc: { revision: 1 } },
        {
          session,
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        },
      ).lean()
    : await Gallery.findById(weddingId).session(session).lean();
  if (p.kind === "guest" && gallery?.guestAccess === false) throw paused();
  return { weddingId, principalKey, gallery };
}
function dto(r: PhotoRecord & { _id: Types.ObjectId }): PhotoDTO {
  return {
    id: r._id.toString(),
    filename: r.filename,
    uploadedBy: r.uploadedBy as "Couple" | "Guest",
    createdAt: r.createdAt.toISOString(),
    width: r.width!,
    height: r.height!,
  };
}
async function database() {
  photoConfig();
  const c = await connectDatabase();
  await requirePhotoIndexes(c);
  return c;
}
export async function listPhotos(
  p: PhotoPrincipal,
  query: unknown = {},
): Promise<GalleryDTO> {
  const parsed = galleryQuerySchema.parse(query),
    c = await database(),
    config = photoConfig();
  return c.transaction(async (session) => {
    const a = await access(c, p, session);
    const rows = await photoModels(c)
      .Photo.find({
        weddingId: a.weddingId,
        storageScope: config.scope,
        state: "ready",
        ...(parsed.before
          ? { _id: { $lt: new Types.ObjectId(parsed.before) } }
          : {}),
      })
      .sort({ _id: -1 })
      .limit(25)
      .session(session)
      .lean();
    return {
      photos: rows.slice(0, 24).map(dto),
      nextCursor: rows.length > 24 ? rows[23]._id.toString() : null,
      guestAccess: a.gallery?.guestAccess ?? true,
      settingsVersion: a.gallery?.settingsVersion ?? 0,
    };
  });
}
export async function savePhotoSettings(p: PhotoPrincipal, input: unknown) {
  if (p.kind !== "couple")
    throw new AuthError(
      "FORBIDDEN",
      403,
      "Only the couple can change photo access.",
    );
  const parsed = settingsSchema.parse(input),
    c = await database();
  return c.transaction(async (session) => {
    const a = await access(c, p, session, true);
    if (a.gallery!.settingsVersion !== parsed.expectedVersion) throw conflict();
    const row = await photoModels(c)
      .Gallery.findOneAndUpdate(
        { _id: a.weddingId, settingsVersion: parsed.expectedVersion },
        {
          $set: { guestAccess: parsed.guestAccess },
          $inc: { settingsVersion: 1 },
        },
        { session, returnDocument: "after" },
      )
      .lean();
    if (!row) throw conflict();
    return {
      guestAccess: row.guestAccess,
      settingsVersion: row.settingsVersion,
    };
  });
}
export async function beginPhotoUpload(
  p: PhotoPrincipal,
  input: unknown,
  now = new Date(),
) {
  const parsed = uploadSchema.parse(input),
    config = photoConfig(),
    c = await database();
  const hash = createHash("sha256")
    .update(JSON.stringify(parsed))
    .digest("hex");
  const photoId = new Types.ObjectId(),
    signedAt = Math.floor(now.getTime() / 1000);
  const row = await c.transaction(async (session) => {
    const a = await access(c, p, session, true, now),
      { Photo, Gallery, Usage, Rate } = photoModels(c);
    const prior = await Photo.findOne({
      weddingId: a.weddingId,
      requestKey: parsed.requestKey,
    })
      .session(session)
      .lean();
    if (prior) {
      if (prior.principalKey !== a.principalKey || prior.payloadHash !== hash)
        throw new AuthError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "This upload request has already been used. Select the photo again.",
        );
      if (prior.state === "ready") return prior;
      if (prior.state !== "pending" || prior.cleanupAfter <= now)
        throw new AuthError(
          "UPLOAD_EXPIRED",
          409,
          "This upload expired. Select the photo again.",
        );
      return prior;
    }
    // Reserve a conservative fixed allowance including two previews before issuing credentials.
    if (
      !(await Gallery.updateOne(
        {
          _id: a.weddingId,
          reservedBytes: { $lte: WEDDING_PHOTO_LIMIT - PHOTO_RESERVATION },
        },
        { $inc: { reservedBytes: PHOTO_RESERVATION } },
        { session },
      ).then((r) => r.modifiedCount))
    )
      throw new AuthError(
        "PHOTO_STORAGE_FULL",
        409,
        "Photo storage is currently full.",
      );
    await Usage.updateOne(
      { _id: config.scope },
      { $setOnInsert: { reservedBytes: 0 } },
      { session, upsert: true },
    );
    if (
      !(await Usage.updateOne(
        {
          _id: config.scope,
          reservedBytes: { $lte: APPLICATION_PHOTO_LIMIT - PHOTO_RESERVATION },
        },
        { $inc: { reservedBytes: PHOTO_RESERVATION } },
        { session },
      ).then((r) => r.modifiedCount))
    )
      throw new AuthError(
        "PHOTO_STORAGE_FULL",
        409,
        "Photo storage is currently full.",
      );
    const bucket = Math.floor(now.getTime() / (15 * 60 * 1000));
    const rateId = createHash("sha256")
      .update(
        config.scope + ":" + a.weddingId + ":" + a.principalKey + ":" + bucket,
      )
      .digest("hex");
    await Rate.updateOne(
      { _id: rateId },
      {
        $setOnInsert: {
          count: 0,
          expiresAt: new Date((bucket + 1) * 15 * 60 * 1000),
        },
      },
      { session, upsert: true },
    );
    if (
      !(await Rate.updateOne(
        { _id: rateId, count: { $lt: 20 } },
        { $inc: { count: 1 } },
        { session },
      ).then((r) => r.modifiedCount))
    )
      throw new AuthError(
        "RATE_LIMITED",
        429,
        "Too many uploads. Please try again in 15 minutes.",
      );
    const [created] = await Photo.create(
      [
        {
          _id: photoId,
          weddingId: a.weddingId,
          requestKey: parsed.requestKey,
          payloadHash: hash,
          principalKey: a.principalKey,
          filename: parsed.filename,
          uploadedBy: p.kind === "couple" ? "Couple" : "Guest",
          state: "pending",
          publicId: config.prefix + "/" + a.weddingId + "/" + photoId,
          storageScope: config.scope,
          signedAt,
          cleanupAfter: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          cleaned: false,
        },
      ],
      { session },
    );
    return created.toObject();
  });
  if (row.state === "ready")
    return { id: row._id.toString(), ready: true as const };
  // Cloudinary signatures have a provider-defined one-hour validity. Never extend a retry's timestamp.
  if (now.getTime() >= (row.signedAt + 55 * 60) * 1000)
    throw new AuthError(
      "UPLOAD_EXPIRED",
      409,
      "This upload expired. Select the photo again.",
    );
  return {
    id: row._id.toString(),
    ready: false as const,
    ...signPhotoUpload(row.publicId, row.signedAt),
  };
}
export async function completePhotoUpload(
  p: PhotoPrincipal,
  id: string,
  now = new Date(),
) {
  photoIdSchema.parse(id);
  const c = await database(),
    config = photoConfig(),
    lease = randomUUID();
  const row = await c.transaction(async (session) => {
    const a = await access(c, p, session, true, now),
      { Photo } = photoModels(c);
    const current = await Photo.findOne({
      _id: id,
      weddingId: a.weddingId,
      storageScope: config.scope,
      principalKey: a.principalKey,
    })
      .session(session)
      .lean();
    if (!current) throw missing();
    if (current.state === "ready") return current;
    if (current.state !== "pending" || current.cleanupAfter <= now)
      throw new AuthError(
        "UPLOAD_EXPIRED",
        409,
        "This upload expired. Select the photo again.",
      );
    if (current.leaseUntil && current.leaseUntil > now)
      throw new AuthError(
        "UPLOAD_BUSY",
        409,
        "This photo is being checked. Please retry shortly.",
      );
    await Photo.updateOne(
      { _id: id, state: "pending" },
      {
        $set: { leaseKey: lease, leaseUntil: new Date(now.getTime() + 60000) },
      },
      { session },
    );
    return current;
  });
  if (row.state === "ready") return dto(row);
  try {
    const details = await photoProvider.inspect(row.publicId);
    return await c.transaction(async (session) => {
      const a = await access(c, p, session, true),
        result = await photoModels(c)
          .Photo.findOneAndUpdate(
            {
              _id: id,
              weddingId: a.weddingId,
              state: "pending",
              leaseKey: lease,
            },
            {
              $set: { state: "ready", ...details },
              $unset: { leaseKey: 1, leaseUntil: 1 },
            },
            { session, returnDocument: "after" },
          )
          .lean();
      if (!result)
        throw new AuthError(
          "UPLOAD_BUSY",
          409,
          "Refresh the gallery before retrying this upload.",
        );
      return dto(result);
    });
  } finally {
    await photoModels(c).Photo.updateOne(
      { _id: id, state: "pending", leaseKey: lease },
      { $unset: { leaseKey: 1, leaseUntil: 1 } },
    );
  }
}
export async function photoImage(
  p: PhotoPrincipal,
  id: string,
  large: boolean,
) {
  photoIdSchema.parse(id);
  const c = await database(),
    config = photoConfig();
  const row = await c.transaction(async (session) => {
    const a = await access(c, p, session);
    const r = await photoModels(c)
      .Photo.findOne({
        _id: id,
        weddingId: a.weddingId,
        state: "ready",
        storageScope: config.scope,
      })
      .session(session)
      .lean();
    if (!r) throw missing();
    return r;
  });
  return photoProvider.image(row.publicId, row.providerVersion!, large);
}
async function finalizeDeletion(
  c: Connection,
  id: Types.ObjectId,
  scope: string,
  cleaned: boolean,
) {
  await c.transaction(async (session) => {
    const { Photo, Gallery, Usage } = photoModels(c);
    const row = await Photo.findOne({ _id: id, storageScope: scope })
      .session(session)
      .lean();
    if (!row) return;
    if (row.state !== "deleted") {
      await Gallery.updateOne(
        { _id: row.weddingId },
        { $inc: { reservedBytes: -PHOTO_RESERVATION, revision: 1 } },
        { session },
      );
      await Usage.updateOne(
        { _id: scope },
        { $inc: { reservedBytes: -PHOTO_RESERVATION } },
        { session },
      );
    }
    await Photo.updateOne(
      { _id: id },
      {
        $set: { state: "deleted", cleaned },
        $unset: { leaseUntil: 1, leaseKey: 1 },
      },
      { session },
    );
  });
}
export async function deletePhoto(
  p: PhotoPrincipal,
  id: string,
  now = new Date(),
) {
  if (p.kind !== "couple")
    throw new AuthError("FORBIDDEN", 403, "Only the couple can delete photos.");
  photoIdSchema.parse(id);
  const c = await database(),
    config = photoConfig();
  const row = await c.transaction(async (session) => {
    const a = await access(c, p, session, true);
    const r = await photoModels(c)
      .Photo.findOne({
        _id: id,
        weddingId: a.weddingId,
        storageScope: config.scope,
      })
      .session(session)
      .lean();
    if (!r) throw missing();
    await photoModels(c).Photo.updateOne(
      { _id: id },
      { $set: { state: r.state === "deleted" ? "deleted" : "deleting" } },
      { session },
    );
    return r;
  });
  await photoProvider.remove(row.publicId);
  await finalizeDeletion(c, row._id, config.scope, row.cleanupAfter <= now);
}
// Explicit operator command only. No photo TTL: ready photos are never automatically removed.
export async function cleanupPhotoUploads(now = new Date()) {
  const c = await database(),
    config = photoConfig();
  let cleaned = 0;
  const rows = await photoModels(c)
    .Photo.find({
      storageScope: config.scope,
      state: { $in: ["pending", "deleting", "deleted"] },
      cleaned: false,
      cleanupAfter: { $lte: now },
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
    })
    .sort({ _id: 1 })
    .limit(100)
    .lean();
  for (const row of rows) {
    const claimed = await photoModels(c)
      .Photo.findOneAndUpdate(
        {
          _id: row._id,
          state: row.state,
          $or: [
            { leaseUntil: { $exists: false } },
            { leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            state: row.state === "deleted" ? "deleted" : "deleting",
            leaseUntil: new Date(now.getTime() + 60000),
          },
        },
      )
      .lean();
    if (!claimed) continue;
    try {
      await photoProvider.remove(row.publicId);
      await finalizeDeletion(c, row._id, config.scope, true);
      cleaned++;
    } catch {
      await photoModels(c).Photo.updateOne(
        { _id: row._id },
        { $unset: { leaseUntil: 1 } },
      );
    }
  }
  return { cleaned, examined: rows.length };
}

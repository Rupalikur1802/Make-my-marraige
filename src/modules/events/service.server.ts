import "server-only";
import { familyModels } from "@/modules/families/model.server";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { getWedding } from "@/modules/wedding/service.server";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { AuthError } from "@/modules/auth/errors";
import {
  eventModel,
  requireCreationIndex,
  type EventRecord,
} from "./model.server";
import {
  eventPatchSchema,
  eventCreateSchema,
  creationKeySchema,
  compareCeremonies,
  type EventDTO,
} from "./validation";
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
function dto(record: EventRecord & { _id: { toString(): string } }): EventDTO {
  return {
    id: record._id.toString(),
    name: record.name,
    presetKey: record.presetKey ?? null,
    status: record.status,
    startsAt: record.startsAt?.toISOString() ?? null,
    venue: record.venue ?? null,
    mapsUrl: null,
    youtubeVideoId: null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
async function weddingFor(actor: Actor) {
  const wedding = await getWedding(actor);
  if (wedding.setupStatus !== "complete")
    throw new AuthError(
      "SETUP_REQUIRED",
      409,
      "Complete wedding setup before managing ceremonies.",
    );
  return wedding;
}
function validId(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id))
    throw new AuthError("NOT_FOUND", 404, "Ceremony not found.");
}
export async function listCeremonies(actor: Actor) {
  const wedding = await weddingFor(actor);
  const records = await eventModel(await connectDatabase())
    .find({ weddingId: wedding.id })
    .lean();
  return records.map(dto).sort(compareCeremonies);
}
export async function getCeremony(actor: Actor, id: string) {
  validId(id);
  const wedding = await weddingFor(actor);
  const record = await eventModel(await connectDatabase())
    .findOne({ _id: id, weddingId: wedding.id })
    .lean();
  if (!record) throw new AuthError("NOT_FOUND", 404, "Ceremony not found.");
  return dto(record);
}
export async function updateCeremony(actor: Actor, id: string, input: unknown) {
  const patch = eventPatchSchema.parse(input);
  const current = await getCeremony(actor, id);
  if (patch.expectedVersion !== current.version)
    throw new AuthError(
      "VERSION_CONFLICT",
      409,
      "Your partner or another device updated this ceremony. Load the latest details before saving again.",
    );
  const name = patch.name ?? current.name;
  const status = patch.status ?? current.status;
  const startsAt =
    patch.startsAt === undefined ? current.startsAt : patch.startsAt;
  const venue = patch.venue === undefined ? current.venue : patch.venue || null;
  if (status === "published" && (!name || !startsAt || !venue))
    throw new AuthError(
      "PUBLICATION_INCOMPLETE",
      400,
      "A name, date, time, and venue are required to publish. Save incomplete details as a draft.",
    );
  const saved = await eventModel(await connectDatabase())
    .findOneAndUpdate(
      {
        _id: current.id,
        weddingId: actor.weddingId,
        version: patch.expectedVersion,
      },
      {
        $set: {
          name,
          status,
          ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
          ...(venue ? { venue } : {}),
        },
        $unset: {
          ...(!startsAt ? { startsAt: 1 } : {}),
          ...(!venue ? { venue: 1 } : {}),
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after", runValidators: true },
    )
    .lean();
  if (!saved)
    throw new AuthError(
      "VERSION_CONFLICT",
      409,
      "Your partner or another device updated this ceremony. Load the latest details before saving again.",
    );
  return dto(saved);
}

export async function createCeremony(
  actor: Actor,
  input: unknown,
  key: unknown,
) {
  const parsed = eventCreateSchema.parse(input);
  const createKeyHash = createHash("sha256")
    .update(creationKeySchema.parse(key))
    .digest("hex");
  const payload = {
    name: parsed.name,
    startsAt: parsed.startsAt ? new Date(parsed.startsAt).toISOString() : null,
    venue: parsed.venue || null,
  };
  const createPayloadHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const wedding = await weddingFor(actor);
  const connection = await connectDatabase();
  await requireCreationIndex(connection);
  const Event = eventModel(connection);
  const replay = async () => {
    const existing = await Event.findOne({
      weddingId: wedding.id,
      createKeyHash,
    })
      .select("+createPayloadHash")
      .lean();
    if (!existing) return null;
    if (existing.createPayloadHash !== createPayloadHash)
      throw new AuthError(
        "CREATE_CONFLICT",
        409,
        "This creation attempt was already used with different details. Start a new ceremony to use new details.",
      );
    return dto(existing);
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    const record = await Event.create({
      weddingId: wedding.id,
      name: payload.name,
      status: "draft",
      version: 0,
      ...(payload.startsAt ? { startsAt: new Date(payload.startsAt) } : {}),
      ...(payload.venue ? { venue: payload.venue } : {}),
      createKeyHash,
      createPayloadHash,
    });
    return dto(record.toObject());
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const repeated = await replay();
      if (repeated) return repeated;
    }
    throw error;
  }
}
export async function deleteCeremony(
  actor: Actor,
  id: string,
  expectedVersion: number,
) {
  validId(id);
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    expectedVersion >= Number.MAX_SAFE_INTEGER
  )
    throw new AuthError(
      "VALIDATION_ERROR",
      400,
      "Provide a valid saved ceremony version.",
    );
  const wedding = await weddingFor(actor);
  const connection = await connectDatabase();
  const Event = eventModel(connection);
  const tenant = new Types.ObjectId(wedding.id),
    eventId = new Types.ObjectId(id);
  await connection.transaction(async (session) => {
    // This write lock coordinates with edits and future event-reference writers.
    const locked = await Event.findOneAndUpdate(
      { _id: eventId, weddingId: tenant, version: expectedVersion },
      { $inc: { version: 1 } },
      { session, returnDocument: "after" },
    ).lean();
    if (!locked) {
      const exists = await Event.findOne({ _id: eventId, weddingId: tenant })
        .session(session)
        .lean();
      throw exists
        ? new AuthError(
            "VERSION_CONFLICT",
            409,
            "Your partner or another device changed this ceremony. Load the latest details before trying again.",
          )
        : new AuthError(
            "NOT_FOUND",
            404,
            "This ceremony is no longer available.",
          );
    }
    const db = connection.db!;
    const { Family, Invitation } = familyModels(connection);
    const assignments = await Invitation.find({ weddingId: tenant, eventId })
      .select("familyId")
      .session(session)
      .lean();
    await Family.updateMany(
      {
        weddingId: tenant,
        _id: { $in: assignments.map((row) => row.familyId) },
      },
      { $inc: { revision: 1 } },
      { session },
    );
    await Invitation.deleteMany({ weddingId: tenant, eventId }, { session });
    // Narrow cleanup boundaries, not speculative feature models or APIs.
    for (const collection of ["tasks", "expenses"]) {
      await db.collection(collection).updateMany(
        { weddingId: tenant, eventId },
        {
          $unset: { eventId: "" },
          $inc: { version: 1 },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
    }
    await Event.deleteOne(
      { _id: eventId, weddingId: tenant, version: expectedVersion + 1 },
      { session },
    );
  });
}

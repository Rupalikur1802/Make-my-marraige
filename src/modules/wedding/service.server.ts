import "server-only";
import { connectDatabase } from "@/lib/db.server";
import { weddingModel, type WeddingRecord } from "./model.server";
import { eventModel, requirePresetIndex } from "@/modules/events/model.server";
import { ceremonyPresets } from "./presets";
import {
  weddingPatchSchema,
  photoCutoff,
  type WeddingDTO,
  type CeremonyDTO,
} from "./validation";
import { AuthError } from "@/modules/auth/errors";
import { resolveCoupleSession } from "@/modules/auth/service.server";

type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
type Record = WeddingRecord & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};
function dto(wedding: Record): WeddingDTO {
  return {
    id: wedding._id.toString(),
    setupStatus: wedding.setupStatus,
    groomName: wedding.groomName ?? null,
    brideName: wedding.brideName ?? null,
    weddingDate: wedding.weddingDate ?? null,
    venue: wedding.venue ?? null,
    timezone: wedding.timezone,
    version: wedding.version,
    mapsUrl: null,
    oneDriveFolderUrl: null,
    templateKey: null,
    coverAssetKey: null,
    photoVisibleUntil: wedding.photoVisibleUntil?.toISOString() ?? null,
    createdAt: wedding.createdAt.toISOString(),
    updatedAt: wedding.updatedAt.toISOString(),
  };
}
export async function getWedding(actor: Actor) {
  const wedding = await weddingModel(await connectDatabase())
    .findOne({ _id: actor.weddingId, ownerAccountId: actor.account.id })
    .lean();
  if (!wedding) throw new AuthError("NOT_FOUND", 404, "Wedding not found.");
  return dto(wedding);
}
export async function getSetupCeremonies(actor: Actor): Promise<CeremonyDTO[]> {
  // Authorize reciprocal ownership before querying any event records.
  const wedding = await getWedding(actor);
  if (wedding.setupStatus !== "complete") return [];
  const records = await eventModel(await connectDatabase())
    .find({ weddingId: wedding.id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return records
    .map((event) => ({
      id: event._id.toString(),
      presetKey: event.presetKey ?? null,
      name: event.name,
      status: event.status,
      startsAt: event.startsAt?.toISOString() ?? null,
      venue: event.venue ?? null,
    }))
    .sort((a, b) => {
      const rank = (key: string | null) => {
        const index = ceremonyPresets.findIndex((p) => p.key === key);
        return index < 0 ? ceremonyPresets.length : index;
      };
      return rank(a.presetKey) - rank(b.presetKey);
    });
}
export async function updateWedding(actor: Actor, input: unknown) {
  const patch = weddingPatchSchema.parse(input);
  const connection = await connectDatabase();
  const Wedding = weddingModel(connection);
  const Event = eventModel(connection);
  if (patch.setupStatus === "complete") await requirePresetIndex(connection);
  return connection.transaction(async (session) => {
    const current = await Wedding.findOne({
      _id: actor.weddingId,
      ownerAccountId: actor.account.id,
    })
      .session(session)
      .lean();
    if (!current) throw new AuthError("NOT_FOUND", 404, "Wedding not found.");
    if (current.version !== patch.expectedVersion)
      throw new AuthError(
        "VERSION_CONFLICT",
        409,
        "Your partner or another device updated this wedding. Load the latest details before saving.",
      );
    if (current.setupStatus === "complete" && patch.setupStatus === "draft")
      throw new AuthError(
        "INVALID_TRANSITION",
        400,
        "Completed setup cannot return to draft.",
      );
    const values = {
      groomName: patch.groomName ?? current.groomName,
      brideName: patch.brideName ?? current.brideName,
      weddingDate: patch.weddingDate ?? current.weddingDate,
      venue: patch.venue ?? current.venue,
    };
    const status = patch.setupStatus ?? current.setupStatus;
    if (status === "complete" && Object.values(values).some((value) => !value))
      throw new AuthError(
        "SETUP_INCOMPLETE",
        400,
        "Both names, a valid wedding date, and venue are required to complete setup.",
      );
    const set: { [key: string]: unknown } = { setupStatus: status };
    const unset: { [key: string]: 1 } = {};
    for (const [key, value] of Object.entries(values)) {
      if (value) set[key] = value;
      else unset[key] = 1;
    }
    if (values.weddingDate)
      set.photoVisibleUntil = photoCutoff(values.weddingDate);
    else unset.photoVisibleUntil = 1;
    const seed = status === "complete" && !current.presetsSeededAt;
    if (seed) {
      await requirePresetIndex(connection);
      set.presetsSeededAt = new Date();
    }
    const saved = await Wedding.findOneAndUpdate(
      {
        _id: current._id,
        ownerAccountId: actor.account.id,
        version: patch.expectedVersion,
      },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $inc: { version: 1 },
      },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!saved)
      throw new AuthError(
        "VERSION_CONFLICT",
        409,
        "Wedding details changed. Load the latest details.",
      );
    if (seed) {
      await Event.insertMany(
        ceremonyPresets.map((preset) => ({
          weddingId: current._id,
          name: preset.name,
          presetKey: preset.key,
          status: "draft",
          version: 0,
        })),
        { session },
      );
    }
    return dto(saved);
  });
}

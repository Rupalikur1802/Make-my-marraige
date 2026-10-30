import "server-only";
import { invitationModels } from "@/modules/invitations/model.server";
import { Types, type ClientSession } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { getWedding } from "@/modules/wedding/service.server";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { AuthError } from "@/modules/auth/errors";
import { eventModel } from "@/modules/events/model.server";
import {
  familyModels,
  requireFamilyIndexes,
  type FamilyRecord,
} from "./model.server";
import {
  familyCreateSchema,
  familyPatchSchema,
  assignmentSchema,
  familyQuerySchema,
  revisionSchema,
  type FamilyDTO,
  type FamilyDetail,
  type FamilyList,
} from "./validation";
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
const oid = (id: string) => new Types.ObjectId(id);
function validId(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id))
    throw new AuthError("NOT_FOUND", 404, "Family not found.");
}
const missing = () =>
  new AuthError("NOT_FOUND", 404, "This family is no longer available.");
const conflict = () =>
  new AuthError(
    "VERSION_CONFLICT",
    409,
    "This family changed on another device. Load the latest details before trying again.",
  );
async function tenant(actor: Actor) {
  const wedding = await getWedding(actor);
  if (wedding.setupStatus !== "complete")
    throw new AuthError(
      "SETUP_REQUIRED",
      409,
      "Complete wedding setup before managing families.",
    );
  return oid(wedding.id);
}
function dto(f: FamilyRecord & { _id: Types.ObjectId }): FamilyDTO {
  return {
    id: f._id.toString(),
    name: f.name,
    email: f.email ?? null,
    invitationAcceptedAt: f.invitationAcceptedAt?.toISOString() ?? null,
    invitedCount: f.invitedCount,
    hasInvitationLink: !!f.tokenHash,
    tokenVersion: f.tokenVersion,
    revision: f.revision,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}
async function detail(
  weddingId: Types.ObjectId,
  id: string,
  session: ClientSession,
): Promise<FamilyDetail> {
  const c = await connectDatabase();
  const { Family, Invitation } = familyModels(c);
  const f = await Family.findOne({ _id: id, weddingId })
    .select("+tokenHash")
    .session(session)
    .lean();
  if (!f) throw missing();
  const rows = await Invitation.find({ weddingId, familyId: f._id })
    .session(session)
    .sort({ eventId: 1 })
    .lean();
  const events = await eventModel(c)
    .find({ weddingId, _id: { $in: rows.map((r) => r.eventId) } })
    .session(session)
    .lean();
  return {
    ...dto(f),
    eventAssignments: rows.flatMap((r) => {
      const e = events.find((e) => e._id.equals(r.eventId));
      return e
        ? [
            {
              eventId: e._id.toString(),
              eventName: e.name,
              eventStatus: e.status,
              invitationId: r._id.toString(),
              status: r.status,
              attendingCount: r.attendingCount,
              respondedAt: r.respondedAt?.toISOString() ?? null,
              version: r.version,
            },
          ]
        : [];
    }),
  };
}
export async function getFamily(actor: Actor, id: string) {
  validId(id);
  const weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction((session) => detail(weddingId, id, session));
}
export async function listFamilies(
  actor: Actor,
  input: unknown = {},
): Promise<FamilyList> {
  const q = familyQuerySchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const { Family, Invitation } = familyModels(c);
    let assignedIds: Types.ObjectId[] | undefined;
    if (q.eventId) {
      const event = await eventModel(c)
        .exists({ _id: q.eventId, weddingId })
        .session(session);
      if (!event)
        throw new AuthError(
          "EVENT_UNAVAILABLE",
          404,
          "This ceremony is no longer available. Clear the ceremony filter.",
        );
      const rows = await Invitation.find({ weddingId, eventId: q.eventId })
        .select("familyId")
        .session(session)
        .lean();
      assignedIds = rows.map((r) => r.familyId);
    }
    const literal = q.q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = {
      weddingId,
      ...(assignedIds ? { _id: { $in: assignedIds } } : {}),
      ...(literal
        ? {
            $or: [
              { searchName: { $regex: literal } },
              { email: { $regex: literal } },
            ],
          }
        : {}),
    };
    const total = await Family.countDocuments(filter).session(session);
    const records = await Family.find(filter)
      .select("+tokenHash")
      .sort({ searchName: 1, _id: 1 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .session(session)
      .lean();
    const rows = await Invitation.find({
      weddingId,
      familyId: { $in: records.map((f) => f._id) },
    })
      .session(session)
      .lean();
    const events = await eventModel(c)
      .find({ weddingId, _id: { $in: rows.map((r) => r.eventId) } })
      .session(session)
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const summary = await Family.aggregate<{
      families: number;
      invitedMembers: number;
    }>([
      { $match: { weddingId } },
      {
        $group: {
          _id: null,
          families: { $sum: 1 },
          invitedMembers: { $sum: "$invitedCount" },
        },
      },
    ]).session(session);
    return {
      families: records.map((f) => ({
        ...dto(f),
        assignedEvents: events
          .filter((e) =>
            rows.some(
              (r) => r.familyId.equals(f._id) && r.eventId.equals(e._id),
            ),
          )
          .map((e) => ({
            id: e._id.toString(),
            name: e.name,
            status: e.status,
            response: rows.find(
              (r) => r.familyId.equals(f._id) && r.eventId.equals(e._id),
            )!.status,
            attendingCount: rows.find(
              (r) => r.familyId.equals(f._id) && r.eventId.equals(e._id),
            )!.attendingCount,
          })),
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      summary: {
        families: summary[0]?.families ?? 0,
        invitedMembers: summary[0]?.invitedMembers ?? 0,
      },
    };
  });
}
// Assignment writers take event write locks in a stable order, coordinating with deletion.
async function lockEvents(
  weddingId: Types.ObjectId,
  ids: string[],
  session: ClientSession,
) {
  const Event = eventModel(await connectDatabase());
  for (const id of [...ids].sort()) {
    const locked = await Event.findOneAndUpdate(
      { _id: id, weddingId },
      { $inc: { version: 1 } },
      { session },
    ).lean();
    if (!locked)
      throw new AuthError(
        "EVENT_UNAVAILABLE",
        409,
        "A selected ceremony was deleted. Reload the latest ceremonies and review your selections.",
      );
  }
}
export async function createFamily(actor: Actor, input: unknown) {
  const parsed = familyCreateSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  await requireFamilyIndexes(c);
  return c.transaction(async (session) => {
    await lockEvents(weddingId, parsed.eventIds, session);
    const { Family, Invitation } = familyModels(c);
    const [f] = await Family.create(
      [
        {
          weddingId,
          name: parsed.name,
          searchName: parsed.name.toLowerCase(),
          email: parsed.email,
          invitedCount: parsed.invitedCount,
        },
      ],
      { session },
    );
    if (!f) throw new Error("Family creation failed.");
    if (parsed.eventIds.length)
      await Invitation.insertMany(
        parsed.eventIds.map((eventId) => ({
          weddingId,
          familyId: f._id,
          eventId,
          status: "pending",
          attendingCount: 0,
          version: 0,
        })),
        { session },
      );
    return detail(weddingId, f.id, session);
  });
}
export async function updateFamily(actor: Actor, id: string, input: unknown) {
  validId(id);
  const parsed = familyPatchSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const { Family, Invitation } = familyModels(c);
    const f = await Family.findOne({ _id: id, weddingId })
      .session(session)
      .lean();
    if (!f) throw missing();
    if (f.revision !== parsed.expectedRevision) throw conflict();
    const conflictingResponse =
      parsed.invitedCount !== undefined
        ? await Invitation.findOne({
            weddingId,
            familyId: id,
            status: "attending",
            attendingCount: { $gt: parsed.invitedCount },
          })
            .sort({ attendingCount: -1 })
            .select("attendingCount")
            .session(session)
            .lean()
        : null;
    if (conflictingResponse)
      throw new AuthError(
        "INVITED_COUNT_CONFLICT",
        409,
        `The invited count is below an existing confirmed response. Keep at least ${conflictingResponse.attendingCount} invited members.`,
      );
    const { expectedRevision, ...changes } = parsed;
    const saved = await Family.findOneAndUpdate(
      { _id: id, weddingId, revision: expectedRevision },
      {
        $set: {
          ...changes,
          ...(changes.name ? { searchName: changes.name.toLowerCase() } : {}),
        },
        $inc: { revision: 1 },
      },
      { session, runValidators: true },
    ).lean();
    if (!saved) throw conflict();
    return detail(weddingId, id, session);
  });
}
export async function replaceAssignments(
  actor: Actor,
  id: string,
  input: unknown,
) {
  validId(id);
  const parsed = assignmentSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  await requireFamilyIndexes(c);
  return c.transaction(async (session) => {
    const { Family, Invitation } = familyModels(c);
    const f = await Family.findOneAndUpdate(
      { _id: id, weddingId, revision: parsed.expectedRevision },
      { $inc: { revision: 1 } },
      { session },
    ).lean();
    if (!f) {
      if (await Family.exists({ _id: id, weddingId }).session(session))
        throw conflict();
      throw missing();
    }
    await lockEvents(weddingId, parsed.eventIds, session);
    const current = await Invitation.find({ weddingId, familyId: id })
      .session(session)
      .lean();
    const removed = current.filter(
      (r) => !parsed.eventIds.includes(r.eventId.toString()),
    );
    if (
      removed.some((r) => r.status !== "pending" || r.respondedAt) &&
      !parsed.confirmResponseRemoval
    )
      throw new AuthError(
        "RESPONSE_REMOVAL_CONFIRMATION_REQUIRED",
        409,
        "Removing these ceremony assignments also deletes their saved responses. Confirm removal before continuing.",
      );
    await Invitation.deleteMany(
      { weddingId, familyId: id, _id: { $in: removed.map((r) => r._id) } },
      { session },
    );
    const added = parsed.eventIds.filter(
      (e) => !current.some((r) => r.eventId.toString() === e),
    );
    if (added.length)
      await Invitation.insertMany(
        added.map((eventId) => ({
          weddingId,
          familyId: id,
          eventId,
          status: "pending",
          attendingCount: 0,
          version: 0,
        })),
        { session },
      );
    return detail(weddingId, id, session);
  });
}
export async function deleteFamily(
  actor: Actor,
  id: string,
  expectedRevision: number,
) {
  validId(id);
  revisionSchema.parse(expectedRevision);
  const weddingId = await tenant(actor),
    c = await connectDatabase();
  await c.transaction(async (session) => {
    const { Family, Invitation } = familyModels(c);
    const f = await Family.findOneAndUpdate(
      { _id: id, weddingId, revision: expectedRevision },
      { $inc: { revision: 1 } },
      { session },
    ).lean();
    if (!f) {
      if (await Family.exists({ _id: id, weddingId }).session(session))
        throw conflict();
      throw missing();
    }
    await Invitation.deleteMany({ weddingId, familyId: id }, { session });
    await invitationModels(c).EmailAttempt.deleteMany(
      { weddingId, familyId: id },
      { session },
    );
    await c
      .db!.collection("sessions")
      .deleteMany({ kind: "guest", weddingId, familyId: oid(id) }, { session });
    await Family.deleteOne(
      { _id: id, weddingId, revision: expectedRevision + 1 },
      { session },
    );
  });
}

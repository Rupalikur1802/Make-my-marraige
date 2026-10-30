import "server-only";
import { Types } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { AuthError } from "@/modules/auth/errors";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import {
  familyModels,
  requireFamilyIndexes,
} from "@/modules/families/model.server";
import { eventModel } from "@/modules/events/model.server";
import { weddingModel } from "@/modules/wedding/model.server";
import { requireInvitationIndexes } from "@/modules/invitations/model.server";
import { resolveGuestSession } from "@/modules/invitations/service.server";
import { objectIdSchema } from "@/modules/families/validation";
import { invitationTokenSchema } from "@/modules/invitations/validation";
import {
  attendanceQuerySchema,
  rsvpSchema,
  type RsvpResponse,
} from "./validation";

const unavailable = () =>
  new AuthError(
    "INVITATION_UNAVAILABLE",
    404,
    "This ceremony is no longer available in your invitation. Refresh the invitation or contact the couple.",
  );
export async function saveRsvp(
  token: string | undefined,
  invitationId: string,
  input: unknown,
  now = new Date(),
): Promise<RsvpResponse> {
  if (!token || !invitationTokenSchema.safeParse(token).success)
    throw new AuthError(
      "UNAUTHENTICATED",
      401,
      "Reopen your invitation link to continue.",
    );
  const id = objectIdSchema.parse(invitationId),
    parsed = rsvpSchema.parse(input),
    c = await connectDatabase();
  await requireInvitationIndexes(c);
  await requireFamilyIndexes(c);
  return c.transaction(async (session) => {
    const guest = await resolveGuestSession(token, session, now);
    const { Family, Invitation } = familyModels(c);
    // Lock family first, then event: coordinates counts, assignments, rotation and deletion.
    const family = await Family.findOneAndUpdate(
      {
        _id: guest.familyId,
        weddingId: guest.weddingId,
        tokenVersion: guest.tokenVersion,
        tokenHash: { $type: "string" },
      },
      { $inc: { revision: 1 } },
      { session, returnDocument: "after" },
    ).lean();
    if (
      !family ||
      !(await weddingModel(c)
        .exists({ _id: guest.weddingId, setupStatus: "complete" })
        .session(session))
    )
      throw unavailable();
    const row = await Invitation.findOne({
      _id: id,
      weddingId: guest.weddingId,
      familyId: guest.familyId,
    })
      .session(session)
      .lean();
    if (!row) throw unavailable();
    const event = await eventModel(c)
      .findOneAndUpdate(
        { _id: row.eventId, weddingId: guest.weddingId, status: "published" },
        { $inc: { version: 1 } },
        { session, returnDocument: "after" },
      )
      .lean();
    if (!event) throw unavailable();
    if (parsed.attendingCount > family.invitedCount)
      throw new AuthError(
        "ATTENDING_COUNT_EXCEEDED",
        400,
        `Choose no more than ${family.invitedCount} attending members.`,
      );
    if (row.version !== parsed.expectedVersion)
      throw new AuthError(
        "VERSION_CONFLICT",
        409,
        "Your response changed on another device. Load the latest response before saving again.",
      );
    const updated = await Invitation.findOneAndUpdate(
      {
        _id: row._id,
        weddingId: guest.weddingId,
        familyId: guest.familyId,
        version: parsed.expectedVersion,
      },
      {
        $set: {
          status: parsed.status,
          attendingCount: parsed.attendingCount,
          respondedAt: now,
        },
        $inc: { version: 1 },
      },
      { session, returnDocument: "after" },
    ).lean();
    if (!updated)
      throw new AuthError(
        "VERSION_CONFLICT",
        409,
        "Load the latest response before saving again.",
      );
    return {
      invitationId: updated._id.toString(),
      status: updated.status,
      attendingCount: updated.attendingCount,
      respondedAt: updated.respondedAt!.toISOString(),
      version: updated.version,
    };
  });
}

type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
export type AttendanceRow = RsvpResponse & {
  familyId: string;
  familyName: string;
  invitedCount: number;
  invitationAcceptedAt: string | null;
};
export async function attendanceSummary(actor: Actor, input: unknown = {}) {
  const query = attendanceQuerySchema.parse(input),
    c = await connectDatabase(),
    weddingId = new Types.ObjectId(actor.weddingId);
  await requireFamilyIndexes(c);
  return c.transaction(async (session) => {
    const wedding = await weddingModel(c)
      .findOne({
        _id: weddingId,
        ownerAccountId: actor.account.id,
        setupStatus: "complete",
      })
      .session(session)
      .lean();
    if (!wedding)
      throw new AuthError(
        "SETUP_REQUIRED",
        409,
        "Complete wedding setup before viewing attendance.",
      );
    const events = await eventModel(c)
      .find({ weddingId, status: "published" })
      .sort({ startsAt: 1, _id: 1 })
      .session(session)
      .lean();
    const ceremonies = events.map((e) => ({
      id: e._id.toString(),
      name: e.name,
      startsAt: e.startsAt?.toISOString() ?? null,
      venue: e.venue ?? null,
    }));
    const selected = query.eventId
      ? ceremonies.find((e) => e.id === query.eventId)
      : ceremonies[0];
    if (query.eventId && !selected)
      throw new AuthError(
        "EVENT_UNAVAILABLE",
        404,
        "This published ceremony is no longer available. Choose another ceremony.",
      );
    const empty = {
      confirmedGuests: 0,
      attendingFamilies: 0,
      notAttendingFamilies: 0,
      pendingFamilies: 0,
      assignedFamilies: 0,
    };
    if (!selected)
      return {
        ceremonies,
        selected: null,
        rows: [] as AttendanceRow[],
        summary: empty,
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    const literal = query.q
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(literal ? { "family.searchName": { $regex: literal } } : {}),
    };
    const [result] = await familyModels(c)
      .Invitation.aggregate<{
        summary: (typeof empty)[];
        total: { count: number }[];
        rows: {
          _id: Types.ObjectId;
          family: {
            _id: Types.ObjectId;
            name: string;
            invitedCount: number;
            invitationAcceptedAt?: Date;
          };
          status: RsvpResponse["status"];
          attendingCount: number;
          respondedAt?: Date;
          version: number;
        }[];
      }>([
        { $match: { weddingId, eventId: new Types.ObjectId(selected.id) } },
        {
          $lookup: {
            from: "families",
            localField: "familyId",
            foreignField: "_id",
            pipeline: [{ $match: { weddingId } }],
            as: "family",
          },
        },
        { $unwind: "$family" },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  assignedFamilies: { $sum: 1 },
                  confirmedGuests: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "attending"] },
                        "$attendingCount",
                        0,
                      ],
                    },
                  },
                  attendingFamilies: {
                    $sum: { $cond: [{ $eq: ["$status", "attending"] }, 1, 0] },
                  },
                  notAttendingFamilies: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "notAttending"] }, 1, 0],
                    },
                  },
                  pendingFamilies: {
                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                  },
                },
              },
            ],
            total: [{ $match: filters }, { $count: "count" }],
            rows: [
              { $match: filters },
              { $sort: { "family.searchName": 1, "family._id": 1 } },
              { $skip: (query.page - 1) * query.pageSize },
              { $limit: query.pageSize },
            ],
          },
        },
      ])
      .session(session);
    const summary = result?.summary[0];
    return {
      ceremonies,
      selected,
      rows: (result?.rows ?? []).map((row) => ({
        invitationId: row._id.toString(),
        familyId: row.family._id.toString(),
        familyName: row.family.name,
        invitedCount: row.family.invitedCount,
        invitationAcceptedAt:
          row.family.invitationAcceptedAt?.toISOString() ?? null,
        status: row.status,
        attendingCount: row.attendingCount,
        respondedAt: row.respondedAt?.toISOString() ?? null,
        version: row.version,
      })),
      summary: summary
        ? {
            confirmedGuests: summary.confirmedGuests,
            attendingFamilies: summary.attendingFamilies,
            notAttendingFamilies: summary.notAttendingFamilies,
            pendingFamilies: summary.pendingFamilies,
            assignedFamilies: summary.assignedFamilies,
          }
        : empty,
      total: result?.total[0]?.count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  });
}

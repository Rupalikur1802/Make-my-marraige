import "server-only";
import { expenseOverview } from "@/modules/expenses/service.server";
import { taskOverview } from "@/modules/tasks/service.server";
import { Types } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { AuthError } from "@/modules/auth/errors";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { weddingModel } from "@/modules/wedding/model.server";
import { eventModel } from "@/modules/events/model.server";
import { familyModels } from "@/modules/families/model.server";
import { daysUntilWedding } from "./date";

type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
type AttendanceTotals = {
  _id: Types.ObjectId;
  pendingFamilies: number;
  attendingFamilies: number;
  notAttendingFamilies: number;
  attendingMembers: number;
  assignedFamilies: number;
  pendingFamilyIds: (Types.ObjectId | null)[];
};
export async function dashboard(actor: Actor, now = new Date()) {
  const c = await connectDatabase(),
    weddingId = new Types.ObjectId(actor.weddingId);
  return c.transaction(async (session) => {
    const wedding = await weddingModel(c)
      .findOne({ _id: weddingId, ownerAccountId: actor.account.id })
      .session(session)
      .lean();
    if (!wedding || wedding.setupStatus !== "complete" || !wedding.weddingDate)
      throw new AuthError(
        "SETUP_REQUIRED",
        409,
        "Complete your wedding details to open the dashboard.",
      );
    const { Family, Invitation } = familyModels(c);
    const [familyTotals] = await Family.aggregate<{
      families: number;
      invitedMembers: number;
      accepted: number;
    }>([
      { $match: { weddingId } },
      {
        $group: {
          _id: null,
          families: { $sum: 1 },
          invitedMembers: { $sum: "$invitedCount" },
          accepted: {
            $sum: {
              $cond: [
                { $eq: [{ $type: "$invitationAcceptedAt" }, "date"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).session(session);
    const events = await eventModel(c)
      .find({ weddingId, status: "published" })
      .sort({ startsAt: 1, _id: 1 })
      .session(session)
      .lean();
    const attendance = await Invitation.aggregate<AttendanceTotals>([
      {
        $match: {
          weddingId,
          eventId: { $in: events.map((event) => event._id) },
        },
      },
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
        $group: {
          _id: "$eventId",
          assignedFamilies: { $sum: 1 },
          pendingFamilies: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          attendingFamilies: {
            $sum: { $cond: [{ $eq: ["$status", "attending"] }, 1, 0] },
          },
          notAttendingFamilies: {
            $sum: { $cond: [{ $eq: ["$status", "notAttending"] }, 1, 0] },
          },
          attendingMembers: {
            $sum: {
              $cond: [{ $eq: ["$status", "attending"] }, "$attendingCount", 0],
            },
          },
          pendingFamilyIds: {
            $addToSet: {
              $cond: [{ $eq: ["$status", "pending"] }, "$familyId", null],
            },
          },
        },
      },
    ]).session(session);
    const pendingFamilies = new Set(
      attendance.flatMap((row) =>
        row.pendingFamilyIds.filter(Boolean).map((id) => id!.toString()),
      ),
    );
    const totals = new Map(attendance.map((row) => [row._id.toString(), row]));
    const eventAttendance = events.map((event) => {
      const row = totals.get(event._id.toString());
      return {
        eventId: event._id.toString(),
        eventName: event.name,
        startsAt: event.startsAt?.toISOString() ?? null,
        venue: event.venue ?? null,
        assignedFamilies: row?.assignedFamilies ?? 0,
        pendingFamilies: row?.pendingFamilies ?? 0,
        attendingFamilies: row?.attendingFamilies ?? 0,
        notAttendingFamilies: row?.notAttendingFamilies ?? 0,
        attendingMembers: row?.attendingMembers ?? 0,
      };
    });
    const taskData = await taskOverview(c, weddingId, session, now);
    const spending = await expenseOverview(c, weddingId, session);
    return {
      expenses: spending,
      tasks: taskData.summary,
      tasksNeedingAttention: taskData.attention,
      wedding: {
        groomName: wedding.groomName ?? "",
        brideName: wedding.brideName ?? "",
        weddingDate: wedding.weddingDate,
        venue: wedding.venue ?? "",
        daysUntilWedding: daysUntilWedding(wedding.weddingDate, now),
      },
      guests: {
        families: familyTotals?.families ?? 0,
        invitedMembers: familyTotals?.invitedMembers ?? 0,
        familiesWithPendingRsvp: pendingFamilies.size,
      },
      invitationAcceptance: {
        acceptedFamilies: familyTotals?.accepted ?? 0,
        awaitingAcceptanceFamilies:
          (familyTotals?.families ?? 0) - (familyTotals?.accepted ?? 0),
      },
      eventAttendance,
      upcomingEvents: eventAttendance
        .filter((event) => event.startsAt && new Date(event.startsAt) > now)
        .slice(0, 6),
      serverNow: now.toISOString(),
    };
  });
}

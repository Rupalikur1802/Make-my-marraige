import "server-only";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { getWedding } from "@/modules/wedding/service.server";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { AuthError } from "@/modules/auth/errors";
import { familyModels } from "@/modules/families/model.server";
import { invitationModels } from "./model.server";

const querySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    emailStatus: z
      .enum(["all", "notSent", "sending", "submitted", "failed", "uncertain"])
      .default("all"),
    acceptance: z.enum(["all", "accepted", "awaiting"]).default("all"),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
type Row = {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  invitationAcceptedAt?: Date;
  emailStatus: string;
  submittedAt?: Date;
  attemptedAt?: Date;
  previousLink: boolean;
};
export async function invitationDirectory(
  actor: Actor,
  input: unknown = {},
  now = new Date(),
) {
  const query = querySchema.parse(input),
    wedding = await getWedding(actor);
  if (wedding.setupStatus !== "complete")
    throw new AuthError("SETUP_REQUIRED", 409, "Complete wedding setup first.");
  const c = await connectDatabase(),
    weddingId = new Types.ObjectId(wedding.id),
    { Family } = familyModels(c);
  const { EmailAttempt } = invitationModels(c);
  const literal = query.q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return c.transaction(async (session) => {
    const [result] = await Family.aggregate<{
      rows: Row[];
      count: { total: number }[];
      summary: { total: number; accepted: number }[];
    }>([
      { $match: { weddingId } },
      {
        $lookup: {
          from: EmailAttempt.collection.name,
          let: { attempt: "$emailAttemptId", family: "$_id" },
          pipeline: [
            {
              $match: {
                weddingId,
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$attempt"] },
                    { $eq: ["$familyId", "$$family"] },
                  ],
                },
              },
            },
            {
              $project: {
                status: 1,
                acceptedAt: 1,
                createdAt: 1,
                leaseUntil: 1,
                tokenVersion: 1,
              },
            },
          ],
          as: "attempts",
        },
      },
      { $set: { attempt: { $arrayElemAt: ["$attempts", 0] } } },
      {
        $set: {
          emailStatus: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$attempt.status", "accepted"] },
                  then: "submitted",
                },
                {
                  case: { $eq: ["$attempt.status", "failed"] },
                  then: "failed",
                },
                {
                  case: { $eq: ["$attempt.status", "uncertain"] },
                  then: "uncertain",
                },
                {
                  case: { $eq: ["$attempt.status", "sending"] },
                  then: {
                    $cond: [
                      { $gt: ["$attempt.leaseUntil", now] },
                      "sending",
                      "uncertain",
                    ],
                  },
                },
              ],
              default: "notSent",
            },
          },
          previousLink: {
            $cond: [
              { $ifNull: ["$attempt", false] },
              { $ne: ["$attempt.tokenVersion", "$tokenVersion"] },
              false,
            ],
          },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
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
          ],
          rows: [
            {
              $match: {
                ...(literal
                  ? {
                      $or: [
                        { searchName: { $regex: literal } },
                        { email: { $regex: literal } },
                      ],
                    }
                  : {}),
                ...(query.emailStatus !== "all"
                  ? { emailStatus: query.emailStatus }
                  : {}),
                ...(query.acceptance === "accepted"
                  ? { invitationAcceptedAt: { $type: "date" } }
                  : query.acceptance === "awaiting"
                    ? { invitationAcceptedAt: null }
                    : {}),
              },
            },
            { $sort: { searchName: 1, _id: 1 } },
            { $skip: (query.page - 1) * query.pageSize },
            { $limit: query.pageSize },
            {
              $project: {
                name: 1,
                email: 1,
                invitationAcceptedAt: 1,
                emailStatus: 1,
                previousLink: 1,
                submittedAt: "$attempt.acceptedAt",
                attemptedAt: "$attempt.createdAt",
              },
            },
          ],
          count: [
            {
              $match: {
                ...(literal
                  ? {
                      $or: [
                        { searchName: { $regex: literal } },
                        { email: { $regex: literal } },
                      ],
                    }
                  : {}),
                ...(query.emailStatus !== "all"
                  ? { emailStatus: query.emailStatus }
                  : {}),
                ...(query.acceptance === "accepted"
                  ? { invitationAcceptedAt: { $type: "date" } }
                  : query.acceptance === "awaiting"
                    ? { invitationAcceptedAt: null }
                    : {}),
              },
            },
            { $count: "total" },
          ],
        },
      },
    ]).session(session);
    return {
      rows: (result?.rows ?? []).map((row) => ({
        id: row._id.toString(),
        name: row.name,
        email: row.email ?? null,
        emailStatus: row.emailStatus,
        invitationAcceptedAt: row.invitationAcceptedAt?.toISOString() ?? null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        attemptedAt: row.attemptedAt?.toISOString() ?? null,
        previousLink: row.previousLink,
      })),
      total: result?.count[0]?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        families: result?.summary[0]?.total ?? 0,
        accepted: result?.summary[0]?.accepted ?? 0,
      },
    };
  });
}

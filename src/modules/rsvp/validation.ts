import { z } from "zod";
import { objectIdSchema, revisionSchema } from "@/modules/families/validation";

export const rsvpStatusSchema = z.enum([
  "pending",
  "attending",
  "notAttending",
]);
export const rsvpSchema = z
  .object({
    expectedVersion: revisionSchema,
    status: z.enum(["attending", "notAttending"]),
    attendingCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.status === "attending"
        ? value.attendingCount < 1
        : value.attendingCount !== 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["attendingCount"],
        message:
          "Choose at least one member when attending, or zero when not attending.",
      });
  });
export const attendanceQuerySchema = z
  .object({
    eventId: objectIdSchema.optional(),
    status: rsvpStatusSchema.optional(),
    q: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type RsvpResponse = {
  invitationId: string;
  status: z.infer<typeof rsvpStatusSchema>;
  attendingCount: number;
  respondedAt: string | null;
  version: number;
};
export const responseLabel = (status: RsvpResponse["status"]) =>
  status === "attending"
    ? "Attending"
    : status === "notAttending"
      ? "Not attending"
      : "Pending";
export function responseTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value)) + " IST"
    : "No response yet";
}

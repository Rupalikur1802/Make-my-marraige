import { z } from "zod";
import { objectIdSchema, revisionSchema } from "@/modules/families/validation";
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Use the current family invitation link.");
export const linkSchema = z
  .object({
    expectedRevision: revisionSchema,
    replace: z.boolean().default(false),
  })
  .strict();
export const prepareSchema = z
  .object({
    expectedRevision: revisionSchema,
    token: invitationTokenSchema,
    requestKey: z.string().uuid(),
    confirmResend: z.boolean().default(false),
    confirmUncertainResend: z.boolean().default(false),
  })
  .strict();
export const sendSchema = z
  .object({ attemptId: objectIdSchema, token: invitationTokenSchema })
  .strict();
export const guestExchangeSchema = z
  .object({ token: invitationTokenSchema })
  .strict();
export const guestInvitationSchema = z.object({
  wedding: z.object({
    groomName: z.string(),
    brideName: z.string(),
    weddingDate: z.string(),
    venue: z.string(),
  }),
  family: z.object({
    name: z.string(),
    invitedCount: z.number().int().positive(),
    invitationAcceptedAt: z.string().nullable().optional(),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      startsAt: z.string(),
      venue: z.string(),
      invitation: z
        .object({
          id: z.string(),
          status: z.enum(["pending", "attending", "notAttending"]),
          attendingCount: z.number().int().min(0),
          respondedAt: z.string().nullable(),
          version: z.number().int().min(0),
        })
        .optional(),
    }),
  ),
});
export type GuestInvitation = z.infer<typeof guestInvitationSchema>;
export type EmailPreview = {
  sender: string | null;
  recipient: string;
  subject: string;
  invitation: GuestInvitation;
};
export type EmailAttemptDTO = {
  id: string;
  status: "ready" | "sending" | "accepted" | "failed" | "uncertain";
  preview: EmailPreview;
  createdAt: string;
  acceptedAt: string | null;
  retryUntil: string;
};

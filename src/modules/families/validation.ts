import { z } from "zod";
export const revisionSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Choose a valid ceremony.")
  .transform((id) => id.toLowerCase());
const eventIds = z
  .array(objectIdSchema)
  .max(500)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each ceremony only once.",
  );
const fields = {
  name: z.string().trim().min(1, "Enter a family name.").max(150),
  email: z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim().toLowerCase() || null : value,
    z.email("Enter a valid invitation email address.").max(254).nullable(),
  ),
  invitedCount: z
    .number()
    .int()
    .min(1, "Enter at least one invited member.")
    .max(Number.MAX_SAFE_INTEGER),
};
export const familyCreateSchema = z
  .object({
    ...fields,
    email: fields.email.optional(),
    eventIds: eventIds.default([]),
  })
  .strict();
export const familyPatchSchema = z
  .object({
    expectedRevision: revisionSchema,
    name: fields.name.optional(),
    email: fields.email.optional(),
    invitedCount: fields.invitedCount.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.name !== undefined ||
      v.email !== undefined ||
      v.invitedCount !== undefined,
    "Provide details to update.",
  );
export const assignmentSchema = z
  .object({
    expectedRevision: revisionSchema,
    eventIds,
    confirmResponseRemoval: z.boolean().optional(),
  })
  .strict();
export const familyDeleteSchema = z
  .object({
    expectedRevision: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .transform(Number)
      .pipe(revisionSchema),
  })
  .strict();
export const familyQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    eventId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type FamilyDTO = {
  id: string;
  name: string;
  email: string | null;
  invitedCount: number;
  hasInvitationLink: boolean;
  tokenVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type AssignmentDTO = {
  eventId: string;
  eventName: string;
  eventStatus: "draft" | "published";
  invitationId: string;
  status: "pending" | "attending" | "notAttending";
  attendingCount: number;
  respondedAt: string | null;
  version: number;
};
export type FamilyDetail = FamilyDTO & { eventAssignments: AssignmentDTO[] };
export type FamilyList = {
  families: (FamilyDTO & {
    assignedEvents: {
      id: string;
      name: string;
      status: "draft" | "published";
    }[];
  })[];
  total: number;
  page: number;
  pageSize: number;
  summary: { families: number; invitedMembers: number };
};

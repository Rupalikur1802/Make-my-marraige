import { z } from "zod";
import { isCalendarDate } from "@/modules/wedding/validation";
export const taskStatuses = ["pending", "inProgress", "completed"] as const;
export const responsibilities = ["Groom", "Bride", "Family"] as const;
export const versionSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
const eventId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/)
  .transform((v) => v.toLowerCase());
const fields = {
  title: z.string().trim().min(1, "Enter a task title.").max(200),
  assigneeName: z.enum(responsibilities),
  notes: z.string().trim().max(2000),
  dueDate: z
    .string()
    .refine(isCalendarDate, "Enter a real calendar date.")
    .nullable(),
  eventId: eventId.nullable(),
  status: z.enum(taskStatuses),
};
export const taskCreateSchema = z
  .object({
    ...fields,
    notes: fields.notes.default(""),
    dueDate: fields.dueDate.default(null),
    eventId: fields.eventId.default(null),
    status: fields.status.default("pending"),
  })
  .strict();
export const taskPatchSchema = z
  .object({
    title: fields.title.optional(),
    notes: fields.notes.optional(),
    assigneeName: fields.assigneeName.optional(),
    dueDate: fields.dueDate.optional(),
    eventId: fields.eventId.optional(),
    status: fields.status.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine(
    (v) => Object.keys(v).some((k) => k !== "expectedVersion"),
    "Provide task details to update.",
  );
export const taskQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    assigneeName: z.enum(["all", ...responsibilities]).default("all"),
    eventId: z
      .union([eventId, z.literal("unassigned"), z.literal("all")])
      .default("all"),
    status: z.enum(["all", ...taskStatuses, "overdue"]).default("all"),
    overdue: z.enum(["true", "false"]).default("false"),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const taskDeleteSchema = z
  .object({
    expectedVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .transform(Number)
      .pipe(versionSchema),
  })
  .strict();
export const taskKeySchema = z.uuid();
export function todayIst(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export type TaskDTO = {
  id: string;
  title: string;
  notes: string;
  assigneeName: (typeof responsibilities)[number];
  dueDate: string | null;
  eventId: string | null;
  eventName: string | null;
  status: (typeof taskStatuses)[number];
  completedAt: string | null;
  isOverdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

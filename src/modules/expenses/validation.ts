import { z } from "zod";
import { isCalendarDate } from "@/modules/wedding/validation";
import { todayIst } from "@/modules/tasks/validation";
export { todayIst };
export const payers = ["Groom", "Bride", "Family"] as const;
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
  description: z
    .string()
    .trim()
    .min(1, "Enter an expense description.")
    .max(300),
  amountPaise: z
    .number()
    .int()
    .min(1, "Enter a positive amount paid.")
    .max(Number.MAX_SAFE_INTEGER),
  spentOn: z.string().refine(isCalendarDate, "Enter a real calendar date."),
  payerName: z.enum(payers),
  eventId: eventId.nullable(),
};
export const expenseCreateSchema = z
  .object({ ...fields, eventId: fields.eventId.default(null) })
  .strict();
export const expensePatchSchema = z
  .object({
    description: fields.description.optional(),
    amountPaise: fields.amountPaise.optional(),
    spentOn: fields.spentOn.optional(),
    payerName: fields.payerName.optional(),
    eventId: fields.eventId.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine(
    (v) => Object.keys(v).some((k) => k !== "expectedVersion"),
    "Provide expense details to update.",
  );
export const expenseQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    payerKey: z.enum(["all", "groom", "bride", "family"]).default("all"),
    eventId: z
      .union([eventId, z.literal("unassigned"), z.literal("all")])
      .default("all"),
    from: fields.spentOn.optional(),
    to: fields.spentOn.optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "From date must be on or before To date.",
  );
export const expenseSummaryQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    payerKey: z.enum(["all", "groom", "bride", "family"]).default("all"),
    eventId: z
      .union([eventId, z.literal("unassigned"), z.literal("all")])
      .default("all"),
    from: fields.spentOn.optional(),
    to: fields.spentOn.optional(),
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "From date must be on or before To date.",
  );
export const expenseDeleteSchema = z
  .object({
    expectedVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .transform(Number)
      .pipe(versionSchema),
  })
  .strict();
export const expenseKeySchema = z.uuid();
export function parseRupees(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(clean) || clean.length > 25) return null;
  const [whole, fraction = ""] = clean.split(".");
  const paise = BigInt(whole!) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return paise > BigInt(0) && paise <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(paise)
    : null;
}
export function rupeeInput(amountPaise: number) {
  const value = BigInt(amountPaise);
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}
export function formatRupees(amountPaise: number) {
  const value = BigInt(amountPaise);
  return (
    "₹" +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      value / BigInt(100),
    ) +
    "." +
    (value % BigInt(100)).toString().padStart(2, "0")
  );
}
export type ExpenseDTO = {
  id: string;
  description: string;
  amountPaise: number;
  currency: "INR";
  spentOn: string;
  payerName: (typeof payers)[number];
  payerKey: string;
  eventId: string | null;
  eventName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

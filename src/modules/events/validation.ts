import { z } from "zod";
import { ceremonyPresets } from "@/modules/wedding/presets";
import { isCalendarDate } from "@/modules/wedding/validation";
export const eventPatchSchema = z
  .object({
    expectedVersion: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    name: z
      .string()
      .trim()
      .min(1, "Enter a ceremony name.")
      .max(100)
      .optional(),
    status: z.enum(["draft", "published"]).optional(),
    startsAt: z
      .string()
      .datetime({ offset: true })
      .refine(
        (value) =>
          isCalendarDate(value.slice(0, 10)) &&
          Number.isFinite(Date.parse(value)),
        "Enter a valid date and time.",
      )
      .nullable()
      .optional(),
    venue: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
    "Provide ceremony details to save.",
  );
export type EventDTO = {
  id: string;
  name: string;
  presetKey: string | null;
  status: "draft" | "published";
  startsAt: string | null;
  venue: string | null;
  mapsUrl: null;
  youtubeVideoId: null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export function istInputs(startsAt: string | null) {
  if (!startsAt) return { date: "", time: "" };
  const shifted = new Date(
    Date.parse(startsAt) + 330 * 60 * 1000,
  ).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
export function istInstant(date: string, time: string) {
  if (!isCalendarDate(date) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))
    return null;
  const parsed = new Date(date + "T" + time + ":00+05:30");
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
export function ceremonyTiming(startsAt: string | null) {
  if (!startsAt) return "Date & time: Not configured";
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(startsAt)) + " IST"
  );
}

export const eventCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a ceremony name.").max(100),
    startsAt: z
      .string()
      .datetime({ offset: true })
      .refine(
        (value) =>
          isCalendarDate(value.slice(0, 10)) &&
          Number.isFinite(Date.parse(value)),
        "Enter a valid date and time.",
      )
      .nullable()
      .optional(),
    venue: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export const creationKeySchema = z.string().uuid();
export const deleteQuerySchema = z
  .object({
    expectedVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(0)
          .max(Number.MAX_SAFE_INTEGER - 1),
      ),
  })
  .strict();
export function compareCeremonies(
  a: Pick<EventDTO, "id" | "presetKey" | "createdAt">,
  b: Pick<EventDTO, "id" | "presetKey" | "createdAt">,
) {
  const rank = (key: string | null) => {
    const index = ceremonyPresets.findIndex((preset) => preset.key === key);
    return index < 0 ? ceremonyPresets.length : index;
  };
  return (
    rank(a.presetKey) - rank(b.presetKey) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

import { z } from "zod";
export function isCalendarDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export const weddingPatchSchema = z
  .object({
    expectedVersion: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    setupStatus: z.enum(["draft", "complete"]).optional(),
    groomName: z.string().trim().max(100).optional(),
    brideName: z.string().trim().max(100).optional(),
    weddingDate: z
      .string()
      .refine(
        (value) => value === "" || isCalendarDate(value),
        "Enter a real calendar date in YYYY-MM-DD format.",
      )
      .optional(),
    venue: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
    "Provide wedding details to save.",
  );
export function photoCutoff(value: string) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + 7);
  return new Date(date.getTime() - 330 * 60 * 1000);
}
export type WeddingDTO = {
  id: string;
  setupStatus: "draft" | "complete";
  groomName: string | null;
  brideName: string | null;
  weddingDate: string | null;
  venue: string | null;
  timezone: "Asia/Kolkata";
  version: number;
  mapsUrl: null;
  oneDriveFolderUrl: null;
  templateKey: null;
  coverAssetKey: null;
  photoVisibleUntil: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CeremonyDTO = {
  id: string;
  presetKey: string | null;
  name: string;
  status: "draft" | "published";
  startsAt: string | null;
  venue: string | null;
};

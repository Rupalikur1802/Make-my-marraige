import { z } from "zod";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_RESERVATION = 12 * 1024 * 1024;
export const WEDDING_PHOTO_LIMIT = 3 * 1024 * 1024 * 1024;
export const APPLICATION_PHOTO_LIMIT = 6 * 1024 * 1024 * 1024;
export const uploadSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine((v) => !/[\u0000-\u001f\/\\]/.test(v), "Use a valid filename."),
    size: z.number().int().positive().max(MAX_PHOTO_BYTES),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    requestKey: z.string().uuid(),
  })
  .strict();
export const photoIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const settingsSchema = z
  .object({
    guestAccess: z.boolean(),
    expectedVersion: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict();
export const galleryQuerySchema = z
  .object({ before: photoIdSchema.optional() })
  .strict();
export type PhotoDTO = {
  id: string;
  filename: string;
  uploadedBy: "Couple" | "Guest";
  createdAt: string;
  width: number;
  height: number;
};
export type GalleryDTO = {
  photos: PhotoDTO[];
  nextCursor: string | null;
  guestAccess: boolean;
  settingsVersion: number;
};

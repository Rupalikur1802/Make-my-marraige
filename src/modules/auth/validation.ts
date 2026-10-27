import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

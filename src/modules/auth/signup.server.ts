import "server-only";
import { z } from "zod";
import { emailSchema, passwordSchema } from "./validation";
import { connectDatabase } from "@/lib/db.server";
import { requireAuthIndexes } from "./indexes.server";
import { throttleLogin } from "./rate-limit.server";
import { provisionCouple } from "./provision.server";
import { AuthError } from "./errors";

const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export async function signupCouple(input: unknown, network: string) {
  const data = signupSchema.parse(input);
  const connection = await connectDatabase();
  await requireAuthIndexes(connection);
  await throttleLogin(connection, data.email, network, new Date(), "signup");
  try {
    await provisionCouple(data.email, data.password);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    )
      throw new AuthError(
        "ACCOUNT_UNAVAILABLE",
        409,
        "An account could not be created with these details. Try signing in.",
      );
    throw error;
  }
}

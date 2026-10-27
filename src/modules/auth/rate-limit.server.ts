import "server-only";
import { createHmac } from "node:crypto";
import type { Connection } from "mongoose";
import { rateLimitSecret } from "@/lib/config.server";
import { authModels } from "./models.server";
import { AuthError } from "./errors";

const WINDOW_MS = 15 * 60 * 1000;
export async function throttleLogin(
  connection: Connection,
  email: string,
  network: string,
  now = new Date(),
  purpose: "login" | "signup" = "login",
) {
  const secret = rateLimitSecret();
  const { RateLimit } = authModels(connection);
  const bucket = Math.floor(now.getTime() / WINDOW_MS);
  const end = new Date((bucket + 1) * WINDOW_MS);
  // Bound guessing against one account and aggregate expensive hashing by network.
  for (const [identity, limit] of [
    [`account:${email}`, 10],
    [`network:${network}`, 50],
  ] as const) {
    const keyHash = createHmac("sha256", secret)
      .update(`${purpose}:${bucket}:${identity}`)
      .digest("hex");
    try {
      await RateLimit.updateOne(
        { keyHash },
        { $setOnInsert: { count: 0, windowEndsAt: end } },
        { upsert: true },
      );
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ))
        throw error;
    }
    // Conditional increment is bounded and atomic even across instances.
    const counter = await RateLimit.findOneAndUpdate(
      { keyHash, count: { $lt: limit }, windowEndsAt: { $gt: now } },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    ).lean();
    if (!counter)
      throw new AuthError(
        "RATE_LIMITED",
        429,
        "Too many sign-in attempts. Please try again later.",
        Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000)),
      );
  }
}

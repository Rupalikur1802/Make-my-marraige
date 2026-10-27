import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { passwordSchema } from "./validation";

const options = {
  algorithm: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
let dummyHash: Promise<string> | undefined;
export function hashPassword(password: string) {
  return hash(passwordSchema.parse(password), options);
}
export async function verifyPassword(
  encoded: string | undefined,
  password: string,
) {
  // An unknown account still performs the same expensive password verification.
  const candidate =
    encoded ??
    (await (dummyHash ??= hash(randomBytes(32).toString("hex"), options)));
  const valid = await verify(candidate, password);
  return Boolean(encoded) && valid;
}

import "server-only";
import { Types } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { authModels } from "./models.server";
import { weddingModel } from "@/modules/wedding/model.server";
import { hashPassword } from "./password.server";
import { emailSchema } from "./validation";
import { requireAuthIndexes } from "./indexes.server";

export async function ensureAuthIndexes() {
  const connection = await connectDatabase();
  const { Account, Session, RateLimit } = authModels(connection);
  const Wedding = weddingModel(connection);
  for (const model of [Account, Wedding, Session, RateLimit])
    await model.createIndexes();
}
export async function provisionCouple(email: string, password: string) {
  const normalizedEmail = emailSchema.parse(email);
  const passwordHash = await hashPassword(password);
  const connection = await connectDatabase();
  await requireAuthIndexes(connection);
  const { Account } = authModels(connection);
  const Wedding = weddingModel(connection);
  const accountId = new Types.ObjectId();
  const weddingId = new Types.ObjectId();
  await connection.transaction(async (session) => {
    await Account.create(
      [
        {
          _id: accountId,
          emailNormalized: normalizedEmail,
          passwordHash,
          weddingId,
          authVersion: 0,
        },
      ],
      { session },
    );
    await Wedding.create(
      [
        {
          _id: weddingId,
          ownerAccountId: accountId,
          setupStatus: "draft",
          timezone: "Asia/Kolkata",
          version: 0,
        },
      ],
      { session },
    );
  });
  return { accountId: accountId.toString(), weddingId: weddingId.toString() };
}

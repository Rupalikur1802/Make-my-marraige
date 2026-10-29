import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { connectDatabase } from "@/lib/db.server";
import { appOrigin, rateLimitSecret } from "@/lib/config.server";
import { authModels } from "./models.server";
import { weddingModel } from "@/modules/wedding/model.server";
import { verifyPassword } from "./password.server";
import { throttleLogin } from "./rate-limit.server";
import { loginSchema, SESSION_SECONDS } from "./validation";
import { AuthError } from "./errors";
import { requireAuthIndexes } from "./indexes.server";
import { loginDependency } from "./diagnostics.server";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function loginCouple(input: unknown, network: string) {
  appOrigin();
  rateLimitSecret();
  const { email, password } = loginSchema.parse(input);
  const connection = await loginDependency(
    "database_connection",
    connectDatabase,
  );
  await loginDependency("authentication_indexes", () =>
    requireAuthIndexes(connection),
  );
  await loginDependency("rate_limit", () =>
    throttleLogin(connection, email, network),
  );
  const { Account, Session } = authModels(connection);
  const account = await loginDependency("account_lookup", async () =>
    Account.findOne({ emailNormalized: email }).select("+passwordHash").lean(),
  );
  if (
    !(await loginDependency("password_verification", () =>
      verifyPassword(account?.passwordHash, password),
    )) ||
    !account
  ) {
    throw new AuthError(
      "INVALID_CREDENTIALS",
      401,
      "The email or password is incorrect.",
    );
  }
  const wedding = await loginDependency("wedding_lookup", async () =>
    weddingModel(connection)
      .findOne({ _id: account.weddingId, ownerAccountId: account._id })
      .lean(),
  );
  if (!wedding)
    throw new AuthError(
      "INVALID_CREDENTIALS",
      401,
      "The email or password is incorrect.",
    );
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await loginDependency("session_creation", async () =>
    Session.create({
      kind: "couple",
      tokenHash: tokenDigest(token),
      accountId: account._id,
      weddingId: wedding._id,
      authVersion: account.authVersion,
      expiresAt,
    }),
  );
  return {
    token,
    data: {
      account: { id: account._id.toString(), email: account.emailNormalized },
      weddingId: wedding._id.toString(),
      setupStatus: wedding.setupStatus,
      expiresAt: expiresAt.toISOString(),
    },
  };
}
export async function resolveCoupleSession(
  token: string | undefined,
  now = new Date(),
) {
  if (!token || !tokenPattern.test(token)) return null;
  const connection = await connectDatabase();
  await requireAuthIndexes(connection);
  const { Session, Account } = authModels(connection);
  const session = await Session.findOne({
    kind: "couple",
    tokenHash: tokenDigest(token),
    expiresAt: { $gt: now },
  }).lean();
  if (!session) return null;
  const account = await Account.findOne({
    _id: session.accountId,
    weddingId: session.weddingId,
    authVersion: session.authVersion,
  }).lean();
  if (!account) return null;
  const wedding = await weddingModel(connection)
    .findOne({ _id: session.weddingId, ownerAccountId: account._id })
    .lean();
  if (!wedding) return null;
  return {
    account: { id: account._id.toString(), email: account.emailNormalized },
    weddingId: wedding._id.toString(),
    setupStatus: wedding.setupStatus,
    expiresAt: session.expiresAt.toISOString(),
  };
}
export async function logoutCouple(token: string | undefined) {
  if (!token || !tokenPattern.test(token)) return;
  const { Session } = authModels(await connectDatabase());
  await Session.deleteOne({ kind: "couple", tokenHash: tokenDigest(token) });
}

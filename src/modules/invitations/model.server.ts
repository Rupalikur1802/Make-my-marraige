import "server-only";
import { familyModels } from "@/modules/families/model.server";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
const options = {
  timestamps: true as const,
  versionKey: false as const,
  strict: "throw" as const,
  autoIndex: false,
  autoCreate: false,
};
const guestSchema = new Schema(
  {
    kind: { type: String, enum: ["guest"], required: true },
    weddingId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  options,
);
guestSchema.index({ tokenHash: 1 }, { unique: true });
guestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
guestSchema.index({ weddingId: 1, familyId: 1 });
const emailSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: Schema.Types.ObjectId, required: true },
    keyHash: { type: String, required: true },
    payloadHash: { type: String, required: true },
    tokenVersion: { type: Number, required: true },
    familyRevision: { type: Number, required: true },
    snapshot: { type: String, required: true, select: false },
    origin: { type: String, required: true },
    status: {
      type: String,
      enum: ["ready", "sending", "accepted", "failed", "uncertain"],
      required: true,
      default: "ready",
    },
    leaseUntil: Date,
    acceptedAt: Date,
    providerId: { type: String, select: false },
  },
  options,
);
emailSchema.index({ weddingId: 1, familyId: 1, keyHash: 1 }, { unique: true });
emailSchema.index({ weddingId: 1, familyId: 1, createdAt: -1 });
export type EmailAttemptRecord = InferSchemaType<typeof emailSchema>;
export function invitationModels(c: Connection) {
  if (process.env.NODE_ENV !== "production")
    for (const [name, schema] of [
      ["GuestSession", guestSchema],
      ["InvitationEmail", emailSchema],
    ] as const)
      if (c.models[name] && c.models[name]!.schema !== schema)
        c.deleteModel(name);
  return {
    GuestSession:
      (c.models.GuestSession as
        Model<InferSchemaType<typeof guestSchema>> | undefined) ??
      c.model<InferSchemaType<typeof guestSchema>>(
        "GuestSession",
        guestSchema,
        "sessions",
      ),
    EmailAttempt:
      (c.models.InvitationEmail as Model<EmailAttemptRecord> | undefined) ??
      c.model<EmailAttemptRecord>(
        "InvitationEmail",
        emailSchema,
        "invitationEmails",
      ),
  };
}
export async function requireInvitationIndexes(c: Connection) {
  const familyIndexes = await familyModels(c)
    .Family.collection.listIndexes()
    .toArray();
  if (
    !familyIndexes.some(
      (i) =>
        i.key.tokenHash === 1 &&
        Object.keys(i.key).length === 1 &&
        i.unique === true &&
        i.partialFilterExpression?.tokenHash?.$type === "string",
    )
  )
    throw new Error("Invitation token index is not installed.");
  const { GuestSession, EmailAttempt } = invitationModels(c);
  for (const [model, key, ttl] of [
    [GuestSession, { tokenHash: 1 }, undefined],
    [GuestSession, { expiresAt: 1 }, 0],
    [EmailAttempt, { weddingId: 1, familyId: 1, keyHash: 1 }, undefined],
  ] as const) {
    const indexes = await model.collection.listIndexes().toArray();
    if (
      !indexes.some(
        (i) =>
          JSON.stringify(i.key) === JSON.stringify(key) &&
          (ttl === undefined
            ? i.unique === true
            : i.expireAfterSeconds === ttl),
      )
    )
      throw new Error("Invitation indexes are not installed.");
  }
}

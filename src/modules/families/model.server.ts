import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
const options = {
  timestamps: true as const,
  strict: "throw" as const,
  versionKey: false as const,
  autoIndex: false,
  autoCreate: false,
};
const integer = {
  type: Number,
  required: true,
  default: 0,
  min: 0,
  validate: Number.isSafeInteger,
};
const familySchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, maxlength: 150 },
    searchName: { type: String, required: true },
    email: { type: String, maxlength: 254 },
    invitedCount: { ...integer, min: 1 },
    tokenHash: { type: String, select: false, match: /^[a-f0-9]{64}$/ },
    tokenVersion: integer,
    revision: integer,
    emailAttemptId: { type: Schema.Types.ObjectId, select: false },
  },
  options,
);
familySchema.index({ weddingId: 1, searchName: 1, _id: 1 });
familySchema.index(
  { tokenHash: 1 },
  { unique: true, partialFilterExpression: { tokenHash: { $type: "string" } } },
);
const invitationSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: Schema.Types.ObjectId, required: true },
    eventId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ["pending", "attending", "notAttending"],
      required: true,
      default: "pending",
    },
    attendingCount: integer,
    respondedAt: Date,
    version: integer,
  },
  options,
);
invitationSchema.index(
  { weddingId: 1, familyId: 1, eventId: 1 },
  { unique: true },
);
invitationSchema.index({ weddingId: 1, eventId: 1, status: 1 });
export type FamilyRecord = InferSchemaType<typeof familySchema>;
export function familyModels(c: Connection) {
  // The connection survives Next.js development reloads; compiled schemas do too.
  // Recompile changed source schemas without touching stored records or indexes.
  const cached = c.models.Family;
  if (
    process.env.NODE_ENV !== "production" &&
    cached &&
    cached.schema !== familySchema
  )
    c.deleteModel("Family");
  return {
    Family:
      (c.models.Family as Model<FamilyRecord> | undefined) ??
      c.model<FamilyRecord>("Family", familySchema, "families"),
    Invitation:
      (c.models.EventInvitation as
        Model<InferSchemaType<typeof invitationSchema>> | undefined) ??
      c.model<InferSchemaType<typeof invitationSchema>>(
        "EventInvitation",
        invitationSchema,
        "eventInvitations",
      ),
  };
}
export async function requireFamilyIndexes(c: Connection) {
  const indexes = await familyModels(c)
    .Invitation.collection.listIndexes()
    .toArray();
  if (
    !indexes.some(
      (i) =>
        i.unique === true &&
        i.key.weddingId === 1 &&
        i.key.familyId === 1 &&
        i.key.eventId === 1 &&
        Object.keys(i.key).length === 3 &&
        !i.partialFilterExpression,
    )
  )
    throw new Error("Family assignment index is not installed.");
}

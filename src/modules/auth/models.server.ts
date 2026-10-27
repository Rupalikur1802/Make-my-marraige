import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
const options = {
  timestamps: true,
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
const accountSchema = new Schema(
  {
    emailNormalized: { type: String, required: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    weddingId: { type: Schema.Types.ObjectId, required: true },
    authVersion: integer,
  },
  options,
);
accountSchema.index({ emailNormalized: 1 }, { unique: true });
accountSchema.index({ weddingId: 1 }, { unique: true });

const sessionSchema = new Schema(
  {
    kind: { type: String, enum: ["couple"], required: true },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      match: /^[a-f0-9]{64}$/,
    },
    accountId: { type: Schema.Types.ObjectId, required: true },
    weddingId: { type: Schema.Types.ObjectId, required: true },
    authVersion: integer,
    expiresAt: { type: Date, required: true },
  },
  options,
);
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ accountId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const rateLimitSchema = new Schema(
  {
    keyHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    count: integer,
    windowEndsAt: { type: Date, required: true },
  },
  options,
);
rateLimitSchema.index({ keyHash: 1 }, { unique: true });
rateLimitSchema.index({ windowEndsAt: 1 }, { expireAfterSeconds: 0 });

function model<T>(
  connection: Connection,
  name: string,
  schema: Schema<T>,
  collection: string,
): Model<T> {
  return (
    (connection.models[name] as Model<T> | undefined) ??
    connection.model<T>(name, schema, collection)
  );
}
export function authModels(connection: Connection) {
  return {
    Account: model<InferSchemaType<typeof accountSchema>>(
      connection,
      "Account",
      accountSchema,
      "accounts",
    ),
    Session: model<InferSchemaType<typeof sessionSchema>>(
      connection,
      "CoupleSession",
      sessionSchema,
      "sessions",
    ),
    RateLimit: model<InferSchemaType<typeof rateLimitSchema>>(
      connection,
      "RateLimit",
      rateLimitSchema,
      "rateLimits",
    ),
  };
}

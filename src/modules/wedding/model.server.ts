import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";

// Only the ownership shell needed by login. Setup fields arrive with wedding setup.
const weddingSchema = new Schema(
  {
    ownerAccountId: { type: Schema.Types.ObjectId, required: true },
    setupStatus: {
      type: String,
      enum: ["draft", "complete"],
      required: true,
      default: "draft",
    },
    timezone: {
      type: String,
      enum: ["Asia/Kolkata"],
      default: "Asia/Kolkata",
      required: true,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      validate: Number.isSafeInteger,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
    autoIndex: false,
    autoCreate: false,
  },
);
weddingSchema.index({ ownerAccountId: 1 }, { unique: true });
type WeddingRecord = InferSchemaType<typeof weddingSchema>;
export function weddingModel(connection: Connection): Model<WeddingRecord> {
  return (
    (connection.models.Wedding as
      Model<InferSchemaType<typeof weddingSchema>> | undefined) ??
    connection.model<WeddingRecord>("Wedding", weddingSchema, "weddings")
  );
}

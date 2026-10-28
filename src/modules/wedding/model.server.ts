import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";

// Wedding ownership and the authorized setup fields.
const weddingSchema = new Schema(
  {
    ownerAccountId: { type: Schema.Types.ObjectId, required: true },
    setupStatus: {
      type: String,
      enum: ["draft", "complete"],
      required: true,
      default: "draft",
    },
    groomName: { type: String, trim: true, maxlength: 100 },
    brideName: { type: String, trim: true, maxlength: 100 },
    weddingDate: { type: String },
    venue: { type: String, trim: true, maxlength: 500 },
    photoVisibleUntil: { type: Date },
    presetsSeededAt: { type: Date },
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
export type WeddingRecord = InferSchemaType<typeof weddingSchema>;
export function weddingModel(connection: Connection): Model<WeddingRecord> {
  return (
    (connection.models.Wedding as
      Model<InferSchemaType<typeof weddingSchema>> | undefined) ??
    connection.model<WeddingRecord>("Wedding", weddingSchema, "weddings")
  );
}

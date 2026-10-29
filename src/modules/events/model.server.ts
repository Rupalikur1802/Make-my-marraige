import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";

// Preset and custom ceremonies; external link settings remain deferred.
const eventSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    presetKey: {
      type: String,
      enum: [
        "engagement",
        "haldi",
        "mehendi",
        "sangeet",
        "wedding",
        "reception",
      ],
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      required: true,
    },
    createKeyHash: { type: String, select: false },
    createPayloadHash: { type: String, select: false },
    startsAt: { type: Date },
    venue: { type: String, maxlength: 500 },
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
eventSchema.index(
  { weddingId: 1, presetKey: 1 },
  {
    unique: true,
    partialFilterExpression: { presetKey: { $type: "string" } },
  },
);
eventSchema.index(
  { weddingId: 1, createKeyHash: 1 },
  {
    unique: true,
    partialFilterExpression: { createKeyHash: { $type: "string" } },
  },
);
export async function requireCreationIndex(connection: Connection) {
  const indexes = await eventModel(connection)
    .collection.listIndexes()
    .toArray();
  if (
    !indexes.some(
      (index) =>
        index.key.weddingId === 1 &&
        index.key.createKeyHash === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.createKeyHash?.$type === "string",
    )
  )
    throw new Error("Ceremony creation index is not installed.");
}
export type EventRecord = InferSchemaType<typeof eventSchema>;
export function eventModel(connection: Connection): Model<EventRecord> {
  return (
    (connection.models.Event as Model<EventRecord> | undefined) ??
    connection.model<EventRecord>("Event", eventSchema, "events")
  );
}
export async function requirePresetIndex(connection: Connection) {
  const indexes = await eventModel(connection)
    .collection.listIndexes()
    .toArray();
  if (
    !indexes.some(
      (index) =>
        index.key.weddingId === 1 &&
        index.key.presetKey === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.presetKey?.$type === "string",
    )
  )
    throw new Error("Wedding setup indexes are not installed.");
}

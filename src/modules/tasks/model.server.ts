import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { responsibilities, taskStatuses } from "./validation";
const schema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 200 },
    notes: { type: String, default: "", maxlength: 2000 },
    assigneeName: { type: String, enum: responsibilities, required: true },
    dueDate: String,
    eventId: Schema.Types.ObjectId,
    status: {
      type: String,
      enum: taskStatuses,
      default: "pending",
      required: true,
    },
    completedAt: Date,
    version: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    createKeyHash: { type: String, select: false },
    createPayloadHash: { type: String, select: false },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
    autoIndex: false,
    autoCreate: false,
  },
);
schema.index({ weddingId: 1, status: 1, dueDate: 1 });
schema.index(
  { weddingId: 1, createKeyHash: 1 },
  {
    unique: true,
    partialFilterExpression: { createKeyHash: { $type: "string" } },
  },
);
export type TaskRecord = InferSchemaType<typeof schema>;
export function taskModel(c: Connection): Model<TaskRecord> {
  return (
    (c.models.Task as Model<TaskRecord> | undefined) ??
    c.model<TaskRecord>("Task", schema, "tasks")
  );
}
export async function requireTaskIndex(c: Connection) {
  const indexes = await taskModel(c).collection.listIndexes().toArray();
  if (
    !indexes.some(
      (i) =>
        i.unique === true &&
        i.key.weddingId === 1 &&
        i.key.createKeyHash === 1 &&
        Object.keys(i.key).length === 2 &&
        i.partialFilterExpression?.createKeyHash?.$type === "string",
    )
  )
    throw new Error("Task creation index is not installed.");
}

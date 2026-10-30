import "server-only";
import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import { payers } from "./validation";
import { AuthError } from "@/modules/auth/errors";
const schema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, required: true, maxlength: 300 },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
    spentOn: { type: String, required: true },
    payerName: { type: String, enum: payers, required: true },
    payerKey: {
      type: String,
      required: true,
      enum: ["groom", "bride", "family"],
    },
    eventId: Schema.Types.ObjectId,
    idempotencyKey: { type: String, required: true, select: false },
    createPayloadHash: { type: String, required: true, select: false },
    version: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
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
schema.index({ weddingId: 1, spentOn: -1, _id: -1 });
schema.index({ weddingId: 1, idempotencyKey: 1 }, { unique: true });
export type ExpenseRecord = InferSchemaType<typeof schema>;
export function expenseModel(c: Connection): Model<ExpenseRecord> {
  return (
    (c.models.Expense as Model<ExpenseRecord> | undefined) ??
    c.model<ExpenseRecord>("Expense", schema, "expenses")
  );
}
export async function requireExpenseIndex(c: Connection) {
  let indexes;
  try {
    indexes = await expenseModel(c).collection.listIndexes().toArray();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 26
    )
      throw new AuthError(
        "EXPENSE_SETUP_REQUIRED",
        503,
        "Expense storage needs setup. Ask the app administrator to install the expense indexes.",
      );
    throw error;
  }
  if (
    !indexes.some(
      (i) =>
        i.unique === true &&
        i.key.weddingId === 1 &&
        i.key.idempotencyKey === 1 &&
        Object.keys(i.key).length === 2 &&
        !i.partialFilterExpression,
    )
  )
    throw new AuthError(
      "EXPENSE_SETUP_REQUIRED",
      503,
      "Expense storage needs setup. Ask the app administrator to install the expense indexes.",
    );
}

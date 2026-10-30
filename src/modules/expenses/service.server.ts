import "server-only";
import { createHash } from "node:crypto";
import { Types, type ClientSession, type Connection } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { AuthError } from "@/modules/auth/errors";
import { getWedding } from "@/modules/wedding/service.server";
import { eventModel } from "@/modules/events/model.server";
import {
  expenseModel,
  requireExpenseIndex,
  type ExpenseRecord,
} from "./model.server";
import {
  expenseCreateSchema,
  expensePatchSchema,
  expenseQuerySchema,
  expenseSummaryQuerySchema,
  expenseKeySchema,
  versionSchema,
  payers,
  todayIst,
  type ExpenseDTO,
} from "./validation";
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
type RecordWithId = ExpenseRecord & { _id: Types.ObjectId };
const payerKeyFor = (name: (typeof payers)[number]) =>
  (({ Groom: "groom", Bride: "bride", Family: "family" }) as const)[name];
const missing = () =>
  new AuthError("NOT_FOUND", 404, "This expense is no longer available.");
const conflict = () =>
  new AuthError(
    "VERSION_CONFLICT",
    409,
    "This expense changed on another device. Load the latest expense before saving again.",
  );
function validId(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) throw missing();
}
async function tenant(actor: Actor) {
  const wedding = await getWedding(actor);
  if (wedding.setupStatus !== "complete")
    throw new AuthError(
      "SETUP_REQUIRED",
      409,
      "Complete wedding setup before managing expenses.",
    );
  return new Types.ObjectId(wedding.id);
}
function assertPastDate(value: string, now: Date) {
  if (value > todayIst(now))
    throw new AuthError(
      "FUTURE_PAYMENT_DATE",
      400,
      "Date paid cannot be in the future. Record payments already made.",
    );
}
async function namesFor(
  c: Connection,
  weddingId: Types.ObjectId,
  session: ClientSession,
) {
  const records = await eventModel(c)
    .find({ weddingId })
    .select("name")
    .session(session)
    .lean();
  return new Map(records.map((e) => [e._id.toString(), e.name]));
}
function dto(r: RecordWithId, names: Map<string, string>): ExpenseDTO {
  return {
    id: r._id.toString(),
    description: r.description,
    amountPaise: r.amountPaise,
    currency: "INR",
    spentOn: r.spentOn,
    payerName: r.payerName,
    payerKey: r.payerKey,
    eventId: r.eventId?.toString() ?? null,
    eventName: r.eventId ? (names.get(r.eventId.toString()) ?? null) : null,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
async function lockEvents(
  c: Connection,
  weddingId: Types.ObjectId,
  ids: string[],
  session: ClientSession,
) {
  for (const id of [...new Set(ids)].sort()) {
    if (
      !(await eventModel(c).findOneAndUpdate(
        { _id: id, weddingId },
        { $inc: { version: 1 } },
        { session },
      ))
    )
      throw new AuthError(
        "EVENT_UNAVAILABLE",
        409,
        "This ceremony is no longer available. Choose Wedding-wide or reload the ceremony list.",
      );
  }
}
function sum(records: RecordWithId[]) {
  const value = records.reduce(
    (total, r) => total + BigInt(r.amountPaise),
    BigInt(0),
  );
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AuthError(
      "TOTAL_TOO_LARGE",
      409,
      "Recorded spending exceeds the supported exact total. Contact the app administrator.",
    );
  return Number(value);
}
function summaryFor(records: RecordWithId[], names: Map<string, string>) {
  const ids = [
    ...new Set(records.map((r) => r.eventId?.toString() ?? "")),
  ].sort();
  return {
    currency: "INR" as const,
    totalPaise: sum(records),
    count: records.length,
    byPayer: payers.map((payerName) => ({
      payerName,
      payerKey: payerKeyFor(payerName),
      totalPaise: sum(records.filter((r) => r.payerName === payerName)),
    })),
    byEvent: ids.map((id) => ({
      eventId: id || null,
      eventName: id
        ? (names.get(id) ?? "Unavailable ceremony")
        : "Wedding-wide",
      totalPaise: sum(
        records.filter((r) => (r.eventId?.toString() ?? "") === id),
      ),
    })),
  };
}
function queryFilter(
  weddingId: Types.ObjectId,
  q: {
    q: string;
    payerKey: "all" | "groom" | "bride" | "family";
    eventId: string;
    from?: string;
    to?: string;
  },
) {
  const literal = q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    weddingId,
    ...(literal ? { description: { $regex: literal, $options: "i" } } : {}),
    ...(q.payerKey !== "all" ? { payerKey: q.payerKey } : {}),
    ...(q.eventId === "unassigned"
      ? { eventId: null }
      : q.eventId !== "all"
        ? { eventId: new Types.ObjectId(q.eventId) }
        : {}),
    ...(q.from || q.to
      ? {
          spentOn: {
            ...(q.from ? { $gte: q.from } : {}),
            ...(q.to ? { $lte: q.to } : {}),
          },
        }
      : {}),
  };
}
export async function expenseOverview(
  c: Connection,
  weddingId: Types.ObjectId,
  session: ClientSession,
) {
  const records = await expenseModel(c)
      .find({ weddingId })
      .sort({ spentOn: -1, _id: -1 })
      .session(session)
      .lean(),
    names = await namesFor(c, weddingId, session);
  return {
    ...summaryFor(records, names),
    recent: records.slice(0, 3).map((r) => dto(r, names)),
  };
}
export async function listExpenses(actor: Actor, input: unknown = {}) {
  const q = expenseQuerySchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const Expense = expenseModel(c),
      filter = queryFilter(weddingId, q),
      total = await Expense.countDocuments(filter).session(session),
      records = await Expense.find(filter)
        .sort({ spentOn: -1, _id: -1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .session(session)
        .lean(),
      names = await namesFor(c, weddingId, session),
      summary = await expenseOverview(c, weddingId, session);
    return {
      expenses: records.map((r) => dto(r, names)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      summary,
    };
  });
}
export async function expenseSummary(actor: Actor, input: unknown = {}) {
  const q = expenseSummaryQuerySchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const records = await expenseModel(c)
      .find(queryFilter(weddingId, q))
      .session(session)
      .lean();
    return summaryFor(records, await namesFor(c, weddingId, session));
  });
}
export async function getExpense(actor: Actor, id: string) {
  validId(id);
  const weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const record = await expenseModel(c)
      .findOne({ _id: id, weddingId })
      .session(session)
      .lean();
    if (!record) throw missing();
    return dto(record, await namesFor(c, weddingId, session));
  });
}
export async function createExpense(
  actor: Actor,
  input: unknown,
  key: unknown,
  now = new Date(),
) {
  const data = expenseCreateSchema.parse(input),
    idempotencyKey = expenseKeySchema.parse(key),
    weddingId = await tenant(actor),
    c = await connectDatabase(),
    Expense = expenseModel(c);
  assertPastDate(data.spentOn, now);
  await requireExpenseIndex(c);
  const createPayloadHash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  const replay = async () => {
    const existing = await Expense.findOne({ weddingId, idempotencyKey })
      .select("+createPayloadHash")
      .lean();
    if (!existing) return null;
    if (existing.createPayloadHash !== createPayloadHash)
      throw new AuthError(
        "IDEMPOTENCY_CONFLICT",
        409,
        "This creation attempt used different expense details. Start a fresh entry to record a different payment.",
      );
    return {
      expense: await getExpense(actor, existing._id.toString()),
      replayed: true,
    };
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    return await c.transaction(async (session) => {
      if (data.eventId) await lockEvents(c, weddingId, [data.eventId], session);
      const [record] = await Expense.create(
        [
          {
            ...data,
            eventId: data.eventId
              ? new Types.ObjectId(data.eventId)
              : undefined,
            weddingId,
            payerKey: payerKeyFor(data.payerName),
            idempotencyKey,
            createPayloadHash,
          },
        ],
        { session },
      );
      return {
        expense: dto(record!.toObject(), await namesFor(c, weddingId, session)),
        replayed: false,
      };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const repeated = await replay();
      if (repeated) return repeated;
    }
    throw error;
  }
}
export async function updateExpense(
  actor: Actor,
  id: string,
  input: unknown,
  now = new Date(),
) {
  validId(id);
  const patch = expensePatchSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase(),
    Expense = expenseModel(c);
  if (patch.spentOn) assertPastDate(patch.spentOn, now);
  return c.transaction(async (session) => {
    const current = await Expense.findOne({ _id: id, weddingId })
      .session(session)
      .lean();
    if (!current) throw missing();
    if (current.version !== patch.expectedVersion) throw conflict();
    const nextEvent =
      patch.eventId === undefined ? current.eventId?.toString() : patch.eventId;
    await lockEvents(
      c,
      weddingId,
      [current.eventId?.toString(), nextEvent].filter((v): v is string => !!v),
      session,
    );
    const { expectedVersion, ...changes } = patch;
    const set = {
      ...changes,
      ...(patch.eventId ? { eventId: new Types.ObjectId(patch.eventId) } : {}),
      ...(patch.payerName ? { payerKey: payerKeyFor(patch.payerName) } : {}),
    };
    if (patch.eventId === null) delete set.eventId;
    const saved = await Expense.findOneAndUpdate(
      { _id: id, weddingId, version: expectedVersion },
      {
        $set: set,
        ...(patch.eventId === null ? { $unset: { eventId: 1 } } : {}),
        $inc: { version: 1 },
      },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!saved) throw conflict();
    return dto(saved, await namesFor(c, weddingId, session));
  });
}
export async function deleteExpense(
  actor: Actor,
  id: string,
  expectedVersion: number,
) {
  validId(id);
  versionSchema.parse(expectedVersion);
  const weddingId = await tenant(actor),
    Expense = expenseModel(await connectDatabase());
  const result = await Expense.deleteOne({
    _id: id,
    weddingId,
    version: expectedVersion,
  });
  if (!result.deletedCount) {
    if (await Expense.exists({ _id: id, weddingId })) throw conflict();
    throw missing();
  }
}

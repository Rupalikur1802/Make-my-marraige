import "server-only";
import { createHash } from "node:crypto";
import { Types, type ClientSession, type Connection } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import type { resolveCoupleSession } from "@/modules/auth/service.server";
import { AuthError } from "@/modules/auth/errors";
import { getWedding } from "@/modules/wedding/service.server";
import { eventModel } from "@/modules/events/model.server";
import { taskModel, requireTaskIndex, type TaskRecord } from "./model.server";
import {
  taskCreateSchema,
  taskPatchSchema,
  taskQuerySchema,
  taskKeySchema,
  versionSchema,
  todayIst,
  type TaskDTO,
} from "./validation";
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
const missing = () =>
  new AuthError("NOT_FOUND", 404, "This task is no longer available.");
const conflict = () =>
  new AuthError(
    "VERSION_CONFLICT",
    409,
    "This task changed on another device. Load the latest task before saving again.",
  );
const oid = (id: string) => new Types.ObjectId(id);
function validId(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) throw missing();
}
async function tenant(actor: Actor) {
  const w = await getWedding(actor);
  if (w.setupStatus !== "complete")
    throw new AuthError(
      "SETUP_REQUIRED",
      409,
      "Complete wedding setup before managing tasks.",
    );
  return oid(w.id);
}
function dto(
  r: TaskRecord & { _id: Types.ObjectId },
  names: Map<string, string>,
  now: Date,
): TaskDTO {
  return {
    id: r._id.toString(),
    title: r.title,
    notes: r.notes ?? "",
    assigneeName: r.assigneeName,
    dueDate: r.dueDate ?? null,
    eventId: r.eventId?.toString() ?? null,
    eventName: r.eventId ? (names.get(r.eventId.toString()) ?? null) : null,
    status: r.status,
    completedAt: r.completedAt?.toISOString() ?? null,
    isOverdue:
      r.status !== "completed" && !!r.dueDate && r.dueDate < todayIst(now),
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
async function namesFor(
  c: Connection,
  weddingId: Types.ObjectId,
  session: ClientSession,
) {
  const events = await eventModel(c)
    .find({ weddingId })
    .select("name")
    .session(session)
    .lean();
  return new Map(events.map((e) => [e._id.toString(), e.name]));
}
async function lockEvents(
  c: Connection,
  weddingId: Types.ObjectId,
  ids: string[],
  session: ClientSession,
) {
  for (const id of [...new Set(ids)].sort()) {
    const locked = await eventModel(c).findOneAndUpdate(
      { _id: id, weddingId },
      { $inc: { version: 1 } },
      { session },
    );
    if (!locked)
      throw new AuthError(
        "EVENT_UNAVAILABLE",
        409,
        "This ceremony is no longer available. Choose Wedding-wide or reload the ceremony list.",
      );
  }
}
export async function getTask(actor: Actor, id: string, now = new Date()) {
  validId(id);
  const weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const record = await taskModel(c)
      .findOne({ _id: id, weddingId })
      .session(session)
      .lean();
    if (!record) throw missing();
    return dto(record, await namesFor(c, weddingId, session), now);
  });
}
// Source-derived totals are shared by the list and dashboard snapshot.
export async function taskOverview(
  c: Connection,
  weddingId: Types.ObjectId,
  session: ClientSession,
  now: Date,
) {
  const Task = taskModel(c),
    today = todayIst(now);
  const records = await Task.find({ weddingId }).session(session).lean();
  const summary = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    total: records.length,
  };
  for (const r of records) {
    summary[r.status]++;
    if (r.status !== "completed" && r.dueDate && r.dueDate < today)
      summary.overdue++;
  }
  const incomplete = records
    .filter((r) => r.status !== "completed")
    .sort(
      (a, b) =>
        (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99") ||
        a._id.toString().localeCompare(b._id.toString()),
    );
  const names = await namesFor(c, weddingId, session);
  return {
    summary,
    attention: incomplete.slice(0, 5).map((r) => dto(r, names, now)),
  };
}
export async function listTasks(
  actor: Actor,
  input: unknown = {},
  now = new Date(),
) {
  const q = taskQuerySchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase();
  return c.transaction(async (session) => {
    const literal = q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = {
      weddingId,
      ...(literal ? { title: { $regex: literal, $options: "i" } } : {}),
      ...(q.assigneeName !== "all" ? { assigneeName: q.assigneeName } : {}),
      ...(q.eventId === "unassigned"
        ? { eventId: null }
        : q.eventId !== "all"
          ? { eventId: oid(q.eventId) }
          : {}),
      ...(q.status !== "all" && q.status !== "overdue"
        ? { status: q.status }
        : {}),
      ...(q.status === "overdue" || q.overdue === "true"
        ? {
            ...(q.status === "all" || q.status === "overdue"
              ? { status: { $ne: "completed" as const } }
              : {}),
            dueDate: { $lt: todayIst(now), $type: "string" as const },
          }
        : {}),
    };
    // A completed + overdue filter is always empty.
    const Task = taskModel(c),
      empty = q.status === "completed" && q.overdue === "true";
    const total = empty
      ? 0
      : await Task.countDocuments(filter).session(session);
    const records = empty
      ? []
      : await Task.aggregate<TaskRecord & { _id: Types.ObjectId }>([
          { $match: filter },
          { $set: { dueSort: { $ifNull: ["$dueDate", "9999-99-99"] } } },
          { $sort: { dueSort: 1, _id: 1 } },
          { $skip: (q.page - 1) * q.pageSize },
          { $limit: q.pageSize },
        ]).session(session);
    const names = await namesFor(c, weddingId, session),
      overview = await taskOverview(c, weddingId, session, now);
    return {
      tasks: records.map((r) => dto(r, names, now)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      summary: overview.summary,
    };
  });
}
export async function createTask(
  actor: Actor,
  input: unknown,
  key: unknown,
  now = new Date(),
) {
  const data = taskCreateSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase(),
    Task = taskModel(c);
  const createKeyHash = createHash("sha256")
      .update(taskKeySchema.parse(key))
      .digest("hex"),
    createPayloadHash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
  await requireTaskIndex(c);
  const replay = async () => {
    const row = await Task.findOne({ weddingId, createKeyHash })
      .select("+createPayloadHash")
      .lean();
    if (!row) return null;
    if (row.createPayloadHash !== createPayloadHash)
      throw new AuthError(
        "CREATE_CONFLICT",
        409,
        "This creation attempt used different details. Start a new task to use new details.",
      );
    return getTask(actor, row._id.toString(), now);
  };
  const existing = await replay();
  if (existing) return existing;
  try {
    return await c.transaction(async (session) => {
      if (data.eventId) await lockEvents(c, weddingId, [data.eventId], session);
      const [r] = await Task.create(
        [
          {
            ...data,
            dueDate: data.dueDate ?? undefined,
            eventId: data.eventId ? oid(data.eventId) : undefined,
            weddingId,
            createKeyHash,
            createPayloadHash,
            ...(data.status === "completed" ? { completedAt: now } : {}),
          },
        ],
        { session },
      );
      return dto(r!.toObject(), await namesFor(c, weddingId, session), now);
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
export async function updateTask(
  actor: Actor,
  id: string,
  input: unknown,
  now = new Date(),
) {
  validId(id);
  const patch = taskPatchSchema.parse(input),
    weddingId = await tenant(actor),
    c = await connectDatabase(),
    Task = taskModel(c);
  return c.transaction(async (session) => {
    const current = await Task.findOne({ _id: id, weddingId })
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
    const status = patch.status ?? current.status;
    const completedAt =
      status === "completed"
        ? current.status === "completed"
          ? current.completedAt
          : now
        : undefined;
    const { expectedVersion, ...changes } = patch;
    const set = {
      ...changes,
      ...(patch.eventId ? { eventId: oid(patch.eventId) } : {}),
      ...(completedAt ? { completedAt } : {}),
    };
    const unset = {
      ...(patch.eventId === null ? { eventId: 1 } : {}),
      ...(patch.dueDate === null ? { dueDate: 1 } : {}),
      ...(!completedAt ? { completedAt: 1 } : {}),
    };
    if (patch.eventId === null) delete set.eventId;
    if (patch.dueDate === null) delete set.dueDate;
    const saved = await Task.findOneAndUpdate(
      { _id: id, weddingId, version: expectedVersion },
      { $set: set, $unset: unset, $inc: { version: 1 } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!saved) throw conflict();
    return dto(saved, await namesFor(c, weddingId, session), now);
  });
}
export async function deleteTask(
  actor: Actor,
  id: string,
  expectedVersion: number,
) {
  validId(id);
  versionSchema.parse(expectedVersion);
  const weddingId = await tenant(actor),
    Task = taskModel(await connectDatabase());
  const result = await Task.deleteOne({
    _id: id,
    weddingId,
    version: expectedVersion,
  });
  if (!result.deletedCount) {
    if (await Task.exists({ _id: id, weddingId })) throw conflict();
    throw missing();
  }
}

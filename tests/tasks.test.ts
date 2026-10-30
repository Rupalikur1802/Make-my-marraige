import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { NextRequest } from "next/server";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.server";
import {
  ensureAuthIndexes,
  provisionCouple,
} from "../src/modules/auth/provision.server";
import { loginCouple } from "../src/modules/auth/service.server";
import { updateWedding } from "../src/modules/wedding/service.server";
import {
  listCeremonies,
  getCeremony,
  deleteCeremony,
} from "../src/modules/events/service.server";
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  deleteTask,
} from "../src/modules/tasks/service.server";
import { taskModel } from "../src/modules/tasks/model.server";
import { taskCreateSchema, todayIst } from "../src/modules/tasks/validation";
import { dashboard } from "../src/modules/dashboard/service.server";
import { GET as list, POST } from "../src/app/api/tasks/route";
import { GET, PATCH, DELETE } from "../src/app/api/tasks/[id]/route";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const now = new Date("2026-10-29T12:00:00Z"),
  origin = "https://tasks.example.test";
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "tasks-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_tasks";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "test-only-task-secret-at-least-32-characters";
    process.env.INVITATION_EMAIL_ENABLED = "false";
    await ensureAuthIndexes();
  },
  { timeout: 600000 },
);
after(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});
async function actor(complete = true) {
  const email = `tasks-${++sequence}@example.test`,
    password = "test-only-task-password";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "tasks-test");
  if (complete)
    await updateWedding(auth.data, {
      expectedVersion: 0,
      setupStatus: "complete",
      groomName: "Arjun",
      brideName: "Priya",
      weddingDate: "2026-12-10",
      venue: "Hall",
    });
  return auth;
}
const input = {
  title: "Confirm priest timing",
  assigneeName: "Groom",
  notes: "Call before noon",
  dueDate: "2026-10-28",
  status: "pending",
};
const create = (a: Awaited<ReturnType<typeof actor>>, data: unknown = input) =>
  createTask(a.data, data, randomUUID(), now);
test("strict fields, real dates and fixed responsibility categories", () => {
  assert.equal(todayIst(new Date("2026-10-29T18:29:59Z")), "2026-10-29");
  assert.equal(todayIst(new Date("2026-10-29T18:30:00Z")), "2026-10-30");
  for (const data of [
    { ...input, title: " " },
    { ...input, assigneeName: "Rahul" },
    { ...input, dueDate: "2026-02-30" },
    { ...input, status: "overdue" },
    { ...input, completedAt: now.toISOString() },
    { ...input, weddingId: "other" },
    { ...input, notes: "x".repeat(2001) },
  ])
    assert.equal(taskCreateSchema.safeParse(data).success, false);
  assert.equal(
    taskCreateSchema.safeParse({ ...input, dueDate: "2028-02-29" }).success,
    true,
  );
});
test("create persists a safe tenant DTO; incomplete setup and foreign ceremonies are rejected", async () => {
  const a = await actor(),
    b = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    foreign = (await listCeremonies(b.data))[0]!;
  const task = await create(a, { ...input, eventId: event.id });
  assert.equal(task.eventName, event.name);
  assert.equal(task.isOverdue, true);
  assert.equal(task.completedAt, null);
  assert.equal(task.version, 0);
  assert.doesNotMatch(
    JSON.stringify(task),
    /weddingId|createKeyHash|createPayloadHash/,
  );
  await assert.rejects(create(a, { ...input, eventId: foreign.id }), {
    code: "EVENT_UNAVAILABLE",
  });
  const draft = await actor(false);
  await assert.rejects(create(draft), { code: "SETUP_REQUIRED" });
  assert.equal((await listTasks(b.data)).total, 0);
});
test("same-key concurrent creation is retry-safe even after edits; conflicting payload fails", async () => {
  const a = await actor(),
    key = randomUUID();
  const rows = await Promise.all([
    createTask(a.data, input, key, now),
    createTask(a.data, input, key, now),
  ]);
  assert.equal(rows[0]!.id, rows[1]!.id);
  assert.equal((await listTasks(a.data)).total, 1);
  const edited = await updateTask(
    a.data,
    rows[0]!.id,
    { expectedVersion: 0, title: "Edited title" },
    now,
  );
  assert.equal(edited.notes, input.notes);
  assert.equal(edited.dueDate, input.dueDate);
  assert.equal(
    (await createTask(a.data, input, key, now)).title,
    "Edited title",
  );
  await assert.rejects(
    createTask(a.data, { ...input, title: "Different payload" }, key, now),
    { code: "CREATE_CONFLICT" },
  );
});
test("completion timestamps are stable, reopening clears them, and in-progress past dates are overdue", async () => {
  const a = await actor(),
    task = await create(a);
  const completed = await updateTask(
    a.data,
    task.id,
    { expectedVersion: 0, status: "completed" },
    now,
  );
  assert.equal(completed.completedAt, now.toISOString());
  assert.equal(completed.isOverdue, false);
  const edited = await updateTask(
    a.data,
    task.id,
    { expectedVersion: 1, title: "Completed edit", status: "completed" },
    new Date("2026-10-30T12:00:00Z"),
  );
  assert.equal(edited.completedAt, completed.completedAt);
  const reopened = await updateTask(
    a.data,
    task.id,
    { expectedVersion: 2, status: "inProgress" },
    now,
  );
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.isOverdue, true);
  const cleared = await updateTask(
    a.data,
    task.id,
    { expectedVersion: 3, dueDate: null, notes: "" },
    now,
  );
  assert.equal(cleared.dueDate, null);
  assert.equal(cleared.isOverdue, false);
});
test("due today is not overdue, and midnight IST changes the derived result", async () => {
  const a = await actor(),
    task = await create(a, { ...input, dueDate: "2026-10-29" });
  assert.equal(task.isOverdue, false);
  assert.equal(
    (await getTask(a.data, task.id, new Date("2026-10-29T18:30:00Z")))
      .isOverdue,
    true,
  );
});
test("filters are literal, paginate before DTOs, and summaries cover the whole wedding", async () => {
  const a = await actor(),
    events = await listCeremonies(a.data);
  await create(a);
  await create(a, {
    ...input,
    title: "Mehendi artist",
    assigneeName: "Bride",
    status: "inProgress",
    eventId: events[0]!.id,
  });
  await create(a, {
    ...input,
    title: "Welcome kits",
    assigneeName: "Family",
    dueDate: null,
  });
  await create(a, {
    ...input,
    title: "Completed past task",
    status: "completed",
  });
  const filtered = await listTasks(
    a.data,
    {
      assigneeName: "Bride",
      eventId: events[0]!.id,
      status: "inProgress",
      overdue: "true",
      pageSize: 1,
    },
    now,
  );
  assert.equal(filtered.total, 1);
  assert.equal(filtered.tasks[0]!.title, "Mehendi artist");
  assert.deepEqual(filtered.summary, {
    pending: 2,
    inProgress: 1,
    completed: 1,
    overdue: 2,
    total: 4,
  });
  assert.equal((await listTasks(a.data, { q: ".*" }, now)).total, 0);
  assert.equal(
    (await listTasks(a.data, { status: "completed", overdue: "true" }, now))
      .total,
    0,
  );
  assert.equal(
    (await listTasks(a.data, { eventId: "unassigned" }, now)).total,
    3,
  );
  const first = await listTasks(a.data, { pageSize: 2 }, now),
    second = await listTasks(a.data, { pageSize: 2, page: 2 }, now);
  assert.equal(
    new Set([...first.tasks, ...second.tasks].map((t) => t.id)).size,
    4,
  );
  assert.equal(second.tasks.at(-1)!.dueDate, null);
});
test("optimistic concurrency allows one writer and foreign reads/updates/deletes return safe not-found", async () => {
  const a = await actor(),
    b = await actor(),
    task = await create(a);
  const writes = await Promise.allSettled([
    updateTask(a.data, task.id, { expectedVersion: 0, title: "One" }, now),
    updateTask(a.data, task.id, { expectedVersion: 0, title: "Two" }, now),
  ]);
  assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(deleteTask(a.data, task.id, 0), {
    code: "VERSION_CONFLICT",
  });
  await assert.rejects(getTask(b.data, task.id), { code: "NOT_FOUND" });
  await assert.rejects(
    updateTask(b.data, task.id, { expectedVersion: 1, title: "Foreign" }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(deleteTask(b.data, task.id, 1), { code: "NOT_FOUND" });
  await assert.rejects(getTask(a.data, "invalid"), { code: "NOT_FOUND" });
});
test("event deletion preserves linked tasks, unlinks them and advances their version", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    task = await create(a, { ...input, eventId: event.id });
  await deleteCeremony(
    a.data,
    event.id,
    (await getCeremony(a.data, event.id)).version,
  );
  const preserved = await getTask(a.data, task.id, now);
  assert.equal(preserved.eventId, null);
  assert.equal(preserved.eventName, null);
  assert.equal(preserved.version, 1);
  await assert.rejects(
    updateTask(a.data, task.id, { expectedVersion: 0, title: "Stale" }),
    { code: "VERSION_CONFLICT" },
  );
});
test("task creation racing event deletion never leaves a dangling ceremony reference", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!;
  await Promise.allSettled([
    create(a, { ...input, eventId: event.id }),
    deleteCeremony(a.data, event.id, event.version),
  ]);
  const c = await connectDatabase(),
    rows = await taskModel(c).find({ weddingId: a.data.weddingId }).lean();
  for (const r of rows)
    if (r.eventId) assert.ok(await getCeremony(a.data, r.eventId.toString()));
});
test("failed linked creation rolls back event locks and task insertion", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    Task = taskModel(await connectDatabase());
  const method = mock.method(Task, "create", async () => {
    throw new Error("test-only insertion failure");
  });
  try {
    await assert.rejects(create(a, { ...input, eventId: event.id }));
  } finally {
    method.mock.restore();
  }
  assert.equal((await getCeremony(a.data, event.id)).version, event.version);
  assert.equal((await listTasks(a.data)).total, 0);
});
test("dashboard reflects source counts, overdue order, updates and deletion", async () => {
  const a = await actor(),
    task = await create(a);
  await create(a, { ...input, title: "No date", dueDate: null });
  let data = await dashboard(a.data, now);
  assert.equal(data.tasks.overdue, 1);
  assert.equal(data.tasksNeedingAttention[0]!.id, task.id);
  await updateTask(
    a.data,
    task.id,
    { expectedVersion: 0, status: "completed" },
    now,
  );
  data = await dashboard(a.data, now);
  assert.equal(data.tasks.overdue, 0);
  assert.equal(data.tasks.completed, 1);
  await deleteTask(a.data, task.id, 1);
  assert.equal((await dashboard(a.data, now)).tasks.total, 1);
});
test("HTTP routes require couple session, exact Origin, strict bounded input and versioned bodyless deletion", async () => {
  const a = await actor(),
    cookie = `__Host-couple_session=${a.token}`;
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    new NextRequest(origin + path, {
      method,
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await list(new NextRequest(origin + "/api/tasks"))).status,
    401,
  );
  assert.equal(
    (
      await POST(
        request("/api/tasks", "POST", input, {
          Origin: "https://foreign.test",
        }),
      )
    ).status,
    403,
  );
  assert.equal((await POST(request("/api/tasks", "POST", input))).status, 400);
  const response = await POST(
    request("/api/tasks", "POST", input, { "Idempotency-Key": randomUUID() }),
  );
  assert.equal(response.status, 201);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  const task = (await response.json()).data,
    context = { params: Promise.resolve({ id: task.id }) };
  assert.equal(
    (await GET(request("/api/tasks/" + task.id), context)).status,
    200,
  );
  assert.equal(
    (await list(request("/api/tasks?status=pending&status=completed"))).status,
    400,
  );
  assert.equal(
    (
      await PATCH(
        request("/api/tasks/" + task.id, "PATCH", {
          expectedVersion: 0,
          weddingId: "other",
        }),
        context,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await PATCH(
        request("/api/tasks/" + task.id, "PATCH", {
          expectedVersion: 0,
          status: "inProgress",
        }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await DELETE(
        request("/api/tasks/" + task.id + "?expectedVersion=1", "DELETE", {}),
        context,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await DELETE(
        request("/api/tasks/" + task.id + "?expectedVersion=1", "DELETE"),
        context,
      )
    ).status,
    204,
  );
});

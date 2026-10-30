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
  createExpense,
  getExpense,
  listExpenses,
  expenseSummary,
  updateExpense,
  deleteExpense,
} from "../src/modules/expenses/service.server";
import { expenseModel } from "../src/modules/expenses/model.server";
import {
  parseRupees,
  formatRupees,
  rupeeInput,
  expenseCreateSchema,
} from "../src/modules/expenses/validation";
import { dashboard } from "../src/modules/dashboard/service.server";
import { GET as list, POST } from "../src/app/api/expenses/route";
import { GET, PATCH, DELETE } from "../src/app/api/expenses/[id]/route";
import { GET as summaryGet } from "../src/app/api/expenses/summary/route";
let mongo: MongoMemoryReplSet,
  sequence = 0;
const origin = "https://expenses.example.test",
  now = new Date("2026-10-29T12:00:00Z");
before(
  async () => {
    mkdirSync(".cache", { recursive: true });
    mongo = await MongoMemoryReplSet.create({
      binary: { downloadDir: join(process.cwd(), ".cache", "mongodb") },
      replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
      instanceOpts: [
        { dbPath: mkdtempSync(join(process.cwd(), ".cache", "expenses-db-")) },
      ],
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mmm_test_expenses";
    process.env.APP_ORIGIN = origin;
    process.env.RATE_LIMIT_SECRET =
      "test-only-expenses-secret-at-least-32-characters";
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
  const email = `expenses-${++sequence}@example.test`,
    password = "test-only-expense-password";
  await provisionCouple(email, password);
  const auth = await loginCouple({ email, password }, "expenses-test");
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
  description: "Decoration advance",
  amountPaise: 1250050,
  spentOn: "2026-10-28",
  payerName: "Groom",
};
const create = (
  auth: Awaited<ReturnType<typeof actor>>,
  data: unknown = input,
) => createExpense(auth.data, data, randomUUID(), now);
test("rupee parsing and formatting are exact without floating multiplication", () => {
  for (const [value, paise] of [
    ["0.01", 1],
    ["0.29", 29],
    ["125000.50", 12500050],
    ["1.", 100],
    ["0001.20", 120],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
  ] as const) {
    assert.equal(parseRupees(value), paise);
    assert.equal(parseRupees(rupeeInput(paise)), paise);
  }
  for (const value of [
    "",
    "0",
    "-1",
    "1.001",
    "1e3",
    "NaN",
    "1,000.00",
    "90071992547409.92",
    "Infinity",
  ])
    assert.equal(parseRupees(value), null);
  assert.equal(formatRupees(12500050), "₹1,25,000.50");
  assert.equal(
    formatRupees(Number.MAX_SAFE_INTEGER),
    "₹9,00,71,99,25,47,409.91",
  );
});
test("strict positive integer paise, dates and fixed payer categories", async () => {
  for (const body of [
    { ...input, amountPaise: 0 },
    { ...input, amountPaise: 1.5 },
    { ...input, amountPaise: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, description: " " },
    { ...input, payerName: "Rahul" },
    { ...input, spentOn: "2026-02-30" },
    { ...input, payerKey: "bride" },
    { ...input, currency: "USD" },
    { ...input, weddingId: "other" },
    { ...input, description: "x".repeat(301) },
  ])
    assert.equal(expenseCreateSchema.safeParse(body).success, false);
  const auth = await actor();
  await assert.rejects(create(auth, { ...input, spentOn: "2026-10-30" }), {
    code: "FUTURE_PAYMENT_DATE",
  });
});
test("today is allowed by IST date and a new day begins at 18:30 UTC", async () => {
  const auth = await actor();
  await assert.rejects(
    createExpense(
      auth.data,
      { ...input, spentOn: "2026-10-30" },
      randomUUID(),
      new Date("2026-10-29T18:29:59Z"),
    ),
    { code: "FUTURE_PAYMENT_DATE" },
  );
  const result = await createExpense(
    auth.data,
    { ...input, spentOn: "2026-10-30" },
    randomUUID(),
    new Date("2026-10-29T18:30:00Z"),
  );
  assert.equal(result.expense.spentOn, "2026-10-30");
});
test("safe DTO and tenant ownership, including incomplete setup and foreign ceremony", async () => {
  const a = await actor(),
    b = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    foreign = (await listCeremonies(b.data))[0]!;
  const { expense } = await create(a, { ...input, eventId: event.id });
  assert.equal(expense.payerKey, "groom");
  assert.equal(expense.currency, "INR");
  assert.equal(expense.eventName, event.name);
  assert.doesNotMatch(
    JSON.stringify(expense),
    /weddingId|idempotencyKey|createPayloadHash/,
  );
  await assert.rejects(getExpense(b.data, expense.id), { code: "NOT_FOUND" });
  await assert.rejects(
    updateExpense(b.data, expense.id, { expectedVersion: 0, amountPaise: 1 }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(deleteExpense(b.data, expense.id, 0), {
    code: "NOT_FOUND",
  });
  await assert.rejects(create(a, { ...input, eventId: foreign.id }), {
    code: "EVENT_UNAVAILABLE",
  });
  const incomplete = await actor(false);
  await assert.rejects(create(incomplete), { code: "SETUP_REQUIRED" });
  assert.equal((await listExpenses(b.data)).total, 0);
});
test("concurrent creation retries create one payment, retain immutable payload after edits and reject key conflicts", async () => {
  const a = await actor(),
    key = randomUUID();
  const results = await Promise.all([
    createExpense(a.data, input, key, now),
    createExpense(a.data, input, key, now),
  ]);
  assert.equal(results[0]!.expense.id, results[1]!.expense.id);
  assert.equal((await listExpenses(a.data)).total, 1);
  assert.equal(results.filter((r) => r.replayed).length, 1);
  await updateExpense(
    a.data,
    results[0]!.expense.id,
    { expectedVersion: 0, description: "Edited payment", amountPaise: 99 },
    now,
  );
  const replay = await createExpense(a.data, input, key, now);
  assert.equal(replay.replayed, true);
  assert.equal(replay.expense.amountPaise, 99);
  await assert.rejects(
    createExpense(a.data, { ...input, amountPaise: 1 }, key, now),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
});
test("filters, inclusive dates, stable pagination and whole-wedding totals", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!;
  await create(a, { ...input, amountPaise: 10, eventId: event.id });
  await create(a, {
    ...input,
    description: "Henna artist",
    amountPaise: 20,
    payerName: "Bride",
    spentOn: "2026-10-27",
    eventId: event.id,
  });
  await create(a, {
    ...input,
    description: "Welcome kits",
    amountPaise: 30,
    payerName: "Family",
    spentOn: "2026-10-26",
  });
  const result = await listExpenses(a.data, {
    q: "henna",
    payerKey: "bride",
    eventId: event.id,
    from: "2026-10-27",
    to: "2026-10-27",
    pageSize: 1,
  });
  assert.equal(result.total, 1);
  assert.equal(result.expenses[0]!.amountPaise, 20);
  assert.equal(result.summary.totalPaise, 60);
  assert.equal(
    result.summary.byPayer.find((p) => p.payerKey === "family")!.totalPaise,
    30,
  );
  assert.equal(
    result.summary.byEvent.find((e) => e.eventId === null)!.totalPaise,
    30,
  );
  assert.equal(
    (await expenseSummary(a.data, { payerKey: "bride" })).totalPaise,
    20,
  );
  assert.equal((await listExpenses(a.data, { q: ".*" })).total, 0);
  assert.equal(
    (await listExpenses(a.data, { eventId: "unassigned" })).total,
    1,
  );
  const first = await listExpenses(a.data, { pageSize: 2 }),
    second = await listExpenses(a.data, { pageSize: 2, page: 2 });
  assert.equal(
    new Set([...first.expenses, ...second.expenses].map((r) => r.id)).size,
    3,
  );
  assert.equal(first.expenses[0]!.spentOn, "2026-10-28");
  await assert.rejects(
    listExpenses(a.data, { from: "2026-10-28", to: "2026-10-01" }),
  );
});
test("versioned edits preserve omitted data, derive payer key and clear ceremony explicitly", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    { expense } = await create(a, { ...input, eventId: event.id });
  const updated = await updateExpense(
    a.data,
    expense.id,
    { expectedVersion: 0, payerName: "Bride", eventId: null },
    now,
  );
  assert.equal(updated.payerKey, "bride");
  assert.equal(updated.eventId, null);
  assert.equal(updated.amountPaise, input.amountPaise);
  assert.equal(updated.spentOn, input.spentOn);
  await assert.rejects(
    updateExpense(
      a.data,
      expense.id,
      { expectedVersion: 1, spentOn: "2099-01-01" },
      now,
    ),
    { code: "FUTURE_PAYMENT_DATE" },
  );
  const writes = await Promise.allSettled([
    updateExpense(
      a.data,
      expense.id,
      { expectedVersion: 1, description: "One" },
      now,
    ),
    updateExpense(
      a.data,
      expense.id,
      { expectedVersion: 1, description: "Two" },
      now,
    ),
  ]);
  assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(deleteExpense(a.data, expense.id, 1), {
    code: "VERSION_CONFLICT",
  });
});
test("deleting a ceremony preserves spending in Wedding-wide and advances the expense version", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    { expense } = await create(a, { ...input, eventId: event.id });
  await deleteCeremony(
    a.data,
    event.id,
    (await getCeremony(a.data, event.id)).version,
  );
  const retained = await getExpense(a.data, expense.id);
  assert.equal(retained.eventId, null);
  assert.equal(retained.version, 1);
  const summary = await expenseSummary(a.data);
  assert.equal(summary.totalPaise, input.amountPaise);
  assert.equal(summary.byEvent[0]!.eventName, "Wedding-wide");
});
test("creation racing ceremony deletion never leaves a dangling reference", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!;
  await Promise.allSettled([
    create(a, { ...input, eventId: event.id }),
    deleteCeremony(a.data, event.id, event.version),
  ]);
  for (const row of (await listExpenses(a.data)).expenses)
    if (row.eventId) assert.ok(await getCeremony(a.data, row.eventId));
});
test("failed creation rolls back the event lock and payment insertion", async () => {
  const a = await actor(),
    event = (await listCeremonies(a.data))[0]!,
    Expense = expenseModel(await connectDatabase());
  const method = mock.method(Expense, "create", async () => {
    throw new Error("test-only insertion failure");
  });
  try {
    await assert.rejects(create(a, { ...input, eventId: event.id }));
  } finally {
    method.mock.restore();
  }
  assert.equal((await getCeremony(a.data, event.id)).version, event.version);
  assert.equal((await listExpenses(a.data)).total, 0);
});
test("totals never silently lose precision beyond safe integer paise", async () => {
  const a = await actor();
  await create(a, { ...input, amountPaise: Number.MAX_SAFE_INTEGER });
  assert.equal(
    (await expenseSummary(a.data)).totalPaise,
    Number.MAX_SAFE_INTEGER,
  );
  await create(a, { ...input, amountPaise: 1 });
  await assert.rejects(expenseSummary(a.data), { code: "TOTAL_TOO_LARGE" });
});
test("dashboard follows recorded payments, edits and deletions", async () => {
  const a = await actor(),
    { expense } = await create(a);
  let data = await dashboard(a.data, now);
  assert.equal(data.expenses.totalPaise, input.amountPaise);
  assert.equal(data.expenses.recent[0]!.id, expense.id);
  await updateExpense(
    a.data,
    expense.id,
    { expectedVersion: 0, amountPaise: 29, payerName: "Family" },
    now,
  );
  data = await dashboard(a.data, now);
  assert.equal(data.expenses.totalPaise, 29);
  assert.equal(
    data.expenses.byPayer.find((p) => p.payerName === "Family")!.totalPaise,
    29,
  );
  await deleteExpense(a.data, expense.id, 1);
  assert.equal((await dashboard(a.data, now)).expenses.totalPaise, 0);
});
test("HTTP protects sessions, Origin, strict fields, replay headers, summary and bodyless deletion", async () => {
  const a = await actor(),
    cookie = `__Host-couple_session=${a.token}`,
    key = randomUUID();
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
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal(
    (await list(new NextRequest(origin + "/api/expenses"))).status,
    401,
  );
  assert.equal(
    (
      await POST(
        request("/api/expenses", "POST", input, {
          Origin: "https://other.test",
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request("/api/expenses", "POST", input))).status,
    400,
  );
  const first = await POST(
    request("/api/expenses", "POST", input, { "Idempotency-Key": key }),
  );
  assert.equal(first.status, 201);
  assert.match(first.headers.get("cache-control")!, /private, no-store/);
  const expense = (await first.json()).data,
    context = { params: Promise.resolve({ id: expense.id }) };
  const replay = await POST(
    request("/api/expenses", "POST", input, { "Idempotency-Key": key }),
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.equal(
    (await GET(request("/api/expenses/" + expense.id), context)).status,
    200,
  );
  assert.equal(
    (await list(request("/api/expenses?from=2026-01-01&from=2026-02-01")))
      .status,
    400,
  );
  assert.equal(
    (await summaryGet(request("/api/expenses/summary?payerKey=groom"))).status,
    200,
  );
  assert.equal(
    (
      await PATCH(
        request("/api/expenses/" + expense.id, "PATCH", {
          expectedVersion: 0,
          payerKey: "family",
        }),
        context,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await PATCH(
        request("/api/expenses/" + expense.id, "PATCH", {
          expectedVersion: 0,
          amountPaise: 1,
        }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await DELETE(
        request(
          "/api/expenses/" + expense.id + "?expectedVersion=1",
          "DELETE",
          {},
        ),
        context,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await DELETE(
        request("/api/expenses/" + expense.id + "?expectedVersion=1", "DELETE"),
        context,
      )
    ).status,
    204,
  );
});
test("missing retry-key index fails closed with actionable setup error", async () => {
  const a = await actor(),
    Expense = expenseModel(await connectDatabase());
  await Expense.collection.dropIndex("weddingId_1_idempotencyKey_1");
  try {
    await assert.rejects(create(a), { code: "EXPENSE_SETUP_REQUIRED" });
  } finally {
    await Expense.createIndexes();
  }
  assert.equal((await listExpenses(a.data)).total, 0);
});

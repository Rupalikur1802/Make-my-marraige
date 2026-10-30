import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { expenseFailure, expenseQuery } from "@/modules/expenses/http.server";
import { createExpense, listExpenses } from "@/modules/expenses/service.server";
import { AuthError } from "@/modules/auth/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = newRequestId();
  try {
    return authJson(
      await listExpenses(await requireCouple(request), expenseQuery(request)),
      id,
    );
  } catch (error) {
    return expenseFailure(error, id);
  }
}
export async function POST(request: NextRequest) {
  const id = newRequestId();
  try {
    requireOrigin(request);
    const actor = await requireCouple(request);
    if (request.nextUrl.search)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Unexpected query parameters.",
      );
    const result = await createExpense(
      actor,
      await readLoginBody(request),
      request.headers.get("Idempotency-Key"),
    );
    const response = authJson(result.expense, id, result.replayed ? 200 : 201);
    response.headers.set("Location", "/api/expenses/" + result.expense.id);
    if (result.replayed) response.headers.set("Idempotency-Replayed", "true");
    return response;
  } catch (error) {
    return expenseFailure(error, id);
  }
}

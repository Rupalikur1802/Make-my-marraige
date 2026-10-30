import type { NextRequest } from "next/server";
import { authJson, newRequestId } from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { expenseFailure, expenseQuery } from "@/modules/expenses/http.server";
import { expenseSummary } from "@/modules/expenses/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = newRequestId();
  try {
    return authJson(
      await expenseSummary(await requireCouple(request), expenseQuery(request)),
      id,
    );
  } catch (error) {
    return expenseFailure(error, id);
  }
}

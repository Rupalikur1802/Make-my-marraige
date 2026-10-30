import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { taskFailure, taskQuery } from "@/modules/tasks/http.server";
import { createTask, listTasks } from "@/modules/tasks/service.server";
import { AuthError } from "@/modules/auth/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = newRequestId();
  try {
    return authJson(
      await listTasks(await requireCouple(request), taskQuery(request)),
      id,
    );
  } catch (error) {
    return taskFailure(error, id);
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
    const data = await createTask(
      actor,
      await readLoginBody(request),
      request.headers.get("Idempotency-Key"),
    );
    const response = authJson(data, id, 201);
    response.headers.set("Location", "/api/tasks/" + data.id);
    return response;
  } catch (error) {
    return taskFailure(error, id);
  }
}

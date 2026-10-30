import { NextResponse, type NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { AuthError } from "@/modules/auth/errors";
import {
  taskFailure,
  taskQuery,
  taskHeaders,
} from "@/modules/tasks/http.server";
import {
  getTask,
  updateTask,
  deleteTask,
} from "@/modules/tasks/service.server";
import { taskDeleteSchema } from "@/modules/tasks/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const id = newRequestId();
  try {
    const actor = await requireCouple(request);
    if (request.nextUrl.search)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Unexpected query parameters.",
      );
    return authJson(await getTask(actor, (await context.params).id), id);
  } catch (error) {
    return taskFailure(error, id);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
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
    return authJson(
      await updateTask(
        actor,
        (await context.params).id,
        await readLoginBody(request),
      ),
      id,
    );
  } catch (error) {
    return taskFailure(error, id);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  const id = newRequestId();
  try {
    requireOrigin(request);
    const actor = await requireCouple(request);
    if (request.body) {
      const reader = request.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (chunk.value.byteLength) {
            await reader.cancel();
            throw new AuthError(
              "VALIDATION_ERROR",
              400,
              "Delete requests must not contain a body.",
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    const { expectedVersion } = taskDeleteSchema.parse(taskQuery(request));
    await deleteTask(actor, (await context.params).id, expectedVersion);
    return new NextResponse(null, { status: 204, headers: taskHeaders });
  } catch (error) {
    return taskFailure(error, id);
  }
}

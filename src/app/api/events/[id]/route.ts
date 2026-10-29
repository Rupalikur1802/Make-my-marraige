import { NextResponse, type NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { eventFailure } from "@/modules/events/http.server";
import {
  getCeremony,
  updateCeremony,
  deleteCeremony,
} from "@/modules/events/service.server";
import { deleteQuerySchema } from "@/modules/events/validation";
import { AuthError } from "@/modules/auth/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    return authJson(
      await getCeremony(
        await requireCouple(request),
        (await context.params).id,
      ),
      requestId,
    );
  } catch (error) {
    return eventFailure(error, requestId);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    return authJson(
      await updateCeremony(
        await requireCouple(request),
        (await context.params).id,
        await readLoginBody(request),
      ),
      requestId,
    );
  } catch (error) {
    return eventFailure(error, requestId);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const actor = await requireCouple(request);
    let hasContent = false;
    if (request.body) {
      const reader = request.body.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (chunk.value.byteLength) {
            hasContent = true;
            await reader.cancel();
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    if (hasContent)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Delete requests must not contain a body.",
      );
    const query: { [key: string]: string } = {};
    for (const [key, value] of request.nextUrl.searchParams) {
      if (key in query)
        throw new AuthError(
          "VALIDATION_ERROR",
          400,
          "Duplicate query parameters are not allowed.",
        );
      query[key] = value;
    }
    const { expectedVersion } = deleteQuerySchema.parse(query);
    await deleteCeremony(actor, (await context.params).id, expectedVersion);
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return eventFailure(error, requestId);
  }
}

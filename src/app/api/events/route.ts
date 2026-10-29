import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { eventFailure } from "@/modules/events/http.server";
import {
  listCeremonies,
  createCeremony,
} from "@/modules/events/service.server";
import { AuthError } from "@/modules/auth/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  try {
    if (request.nextUrl.search)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Query filters are not supported in this ceremony milestone.",
      );
    const records = await listCeremonies(await requireCouple(request));
    return authJson(records, requestId);
  } catch (error) {
    return eventFailure(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const data = await createCeremony(
      await requireCouple(request),
      await readLoginBody(request),
      request.headers.get("Idempotency-Key"),
    );
    const response = authJson(data, requestId, 201);
    response.headers.set("Location", "/api/events/" + data.id);
    return response;
  } catch (error) {
    return eventFailure(error, requestId);
  }
}

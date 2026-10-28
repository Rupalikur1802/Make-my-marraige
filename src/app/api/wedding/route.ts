import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple, weddingFailure } from "@/modules/wedding/http.server";
import { getWedding, updateWedding } from "@/modules/wedding/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  try {
    return authJson(await getWedding(await requireCouple(request)), requestId);
  } catch (error) {
    return weddingFailure(error, requestId);
  }
}
export async function PATCH(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const actor = await requireCouple(request);
    return authJson(
      await updateWedding(actor, await readLoginBody(request)),
      requestId,
    );
  } catch (error) {
    return weddingFailure(error, requestId);
  }
}

import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { replaceAssignments } from "@/modules/families/service.server";
import { familyFailure } from "@/modules/families/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    return authJson(
      await replaceAssignments(
        await requireCouple(request),
        (await context.params).id,
        await readLoginBody(request),
      ),
      requestId,
    );
  } catch (error) {
    return familyFailure(error, requestId);
  }
}

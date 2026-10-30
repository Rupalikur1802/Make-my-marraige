import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authJson, newRequestId } from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { AuthError } from "@/modules/auth/errors";
import { dashboard } from "@/modules/dashboard/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  try {
    const actor = await requireCouple(request);
    if (request.nextUrl.search)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "The dashboard does not accept filters.",
      );
    return authJson(await dashboard(actor), requestId);
  } catch (error) {
    const known = error instanceof AuthError;
    if (!known)
      console.error(
        JSON.stringify({
          requestId,
          operation: "dashboard",
          code: "SERVICE_UNAVAILABLE",
        }),
      );
    return NextResponse.json(
      {
        error: {
          code: known ? error.code : "SERVICE_UNAVAILABLE",
          message: known
            ? error.message
            : "The dashboard is temporarily unavailable. Please retry.",
        },
        meta: { requestId },
      },
      {
        status: known ? error.status : 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
}

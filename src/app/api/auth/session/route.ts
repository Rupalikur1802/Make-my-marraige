import { NextRequest } from "next/server";
import { coupleCookie } from "@/lib/config.server";
import { AuthError } from "@/modules/auth/errors";
import {
  authFailure,
  authJson,
  newRequestId,
} from "@/modules/auth/http.server";
import { resolveCoupleSession } from "@/modules/auth/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  try {
    const session = await resolveCoupleSession(
      request.cookies.get(coupleCookie().name)?.value,
    );
    if (!session)
      throw new AuthError(
        "UNAUTHENTICATED",
        401,
        "Please sign in to continue.",
      );
    return authJson(session, requestId);
  } catch (error) {
    return authFailure(error, requestId);
  }
}

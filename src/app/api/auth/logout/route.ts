import { NextRequest } from "next/server";
import { coupleCookie } from "@/lib/config.server";
import {
  authFailure,
  logoutResponse,
  newRequestId,
  requireOrigin,
  setCoupleCookie,
} from "@/modules/auth/http.server";
import { logoutCouple } from "@/modules/auth/service.server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    // Bodyless logout intentionally does not require a JSON content type.
    await logoutCouple(request.cookies.get(coupleCookie().name)?.value);
    const response = logoutResponse();
    setCoupleCookie(response, "", true);
    return response;
  } catch (error) {
    return authFailure(error, requestId);
  }
}

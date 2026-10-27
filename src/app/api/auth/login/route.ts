import { NextRequest } from "next/server";
import {
  authFailure,
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
  setCoupleCookie,
} from "@/modules/auth/http.server";
import { loginCouple } from "@/modules/auth/service.server";
import { coupleCookie, networkIdentity } from "@/lib/config.server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const { token, data } = await loginCouple(
      await readLoginBody(request),
      networkIdentity(request.headers),
    );
    // Replace the caller's old session only after credentials were accepted.
    // Other devices retain independent sessions.
    const previous = request.cookies.get(coupleCookie().name)?.value;
    if (previous) {
      const { logoutCouple } = await import("@/modules/auth/service.server");
      await logoutCouple(previous);
    }
    const response = authJson(
      {
        account: data.account,
        weddingId: data.weddingId,
        setupStatus: data.setupStatus,
      },
      requestId,
    );
    setCoupleCookie(response, token);
    return response;
  } catch (error) {
    return authFailure(error, requestId);
  }
}

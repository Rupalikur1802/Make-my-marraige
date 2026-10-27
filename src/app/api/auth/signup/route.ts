import { NextRequest } from "next/server";
import {
  authFailure,
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { networkIdentity } from "@/lib/config.server";
import { signupCouple } from "@/modules/auth/signup.server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    await signupCouple(
      await readLoginBody(request),
      networkIdentity(request.headers),
    );
    return authJson({ created: true }, requestId, 201);
  } catch (error) {
    return authFailure(error, requestId);
  }
}

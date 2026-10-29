import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  requireOrigin,
  readLoginBody,
} from "@/modules/auth/http.server";
import { networkIdentity } from "@/lib/config.server";
import { exchangeInvitation } from "@/modules/invitations/service.server";
import {
  invitationFailure,
  guestCookie,
} from "@/modules/invitations/http.server";
import { guestExchangeSchema } from "@/modules/invitations/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const rid = newRequestId();
  try {
    requireOrigin(request);
    const { token } = guestExchangeSchema.parse(await readLoginBody(request));
    const cookie = guestCookie();
    const result = await exchangeInvitation(
      token,
      networkIdentity(request.headers),
      request.cookies.get(cookie.name)?.value,
    );
    const response = authJson({ redirectTo: "/guest" }, rid);
    response.cookies.set(cookie.name, result.token, {
      ...cookie,
      expires: result.expiresAt,
      maxAge: 7 * 86400,
    });
    return response;
  } catch (e) {
    return invitationFailure(e, rid);
  }
}

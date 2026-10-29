import { NextResponse, type NextRequest } from "next/server";
import { newRequestId, requireOrigin } from "@/modules/auth/http.server";
import { logoutGuest } from "@/modules/invitations/service.server";
import {
  invitationFailure,
  guestCookie,
  privateInvitationHeaders,
} from "@/modules/invitations/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const rid = newRequestId();
  try {
    requireOrigin(request);
    const cookie = guestCookie();
    await logoutGuest(request.cookies.get(cookie.name)?.value);
    const response = new NextResponse(null, {
      status: 204,
      headers: privateInvitationHeaders,
    });
    response.cookies.set(cookie.name, "", { ...cookie, maxAge: 0 });
    return response;
  } catch (e) {
    return invitationFailure(e, rid);
  }
}

import type { NextRequest } from "next/server";
import { authJson, newRequestId } from "@/modules/auth/http.server";
import { guestInvitation } from "@/modules/invitations/service.server";
import {
  invitationFailure,
  guestCookie,
} from "@/modules/invitations/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const rid = newRequestId();
  try {
    return authJson(
      await guestInvitation(request.cookies.get(guestCookie().name)?.value),
      rid,
    );
  } catch (e) {
    return invitationFailure(e, rid);
  }
}

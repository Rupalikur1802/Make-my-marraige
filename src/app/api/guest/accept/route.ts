import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  requireOrigin,
  readLoginBody,
} from "@/modules/auth/http.server";
import { acceptGuestInvitation } from "@/modules/invitations/service.server";
import {
  guestCookie,
  invitationFailure,
} from "@/modules/invitations/http.server";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const rid = newRequestId();
  try {
    requireOrigin(request);
    z.object({})
      .strict()
      .parse(await readLoginBody(request));
    return authJson(
      await acceptGuestInvitation(
        request.cookies.get(guestCookie().name)?.value,
      ),
      rid,
    );
  } catch (error) {
    return invitationFailure(error, rid);
  }
}

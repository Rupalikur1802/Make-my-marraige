import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  requireOrigin,
  readLoginBody,
} from "@/modules/auth/http.server";
import {
  guestCookie,
  invitationFailure,
} from "@/modules/invitations/http.server";
import { saveRsvp } from "@/modules/rsvp/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const rid = newRequestId();
  try {
    requireOrigin(request);
    return authJson(
      await saveRsvp(
        request.cookies.get(guestCookie().name)?.value,
        (await context.params).invitationId,
        await readLoginBody(request),
      ),
      rid,
    );
  } catch (error) {
    return invitationFailure(error, rid);
  }
}

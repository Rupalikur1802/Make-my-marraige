import type { NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  requireOrigin,
  readLoginBody,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { prepareInvitationEmail } from "@/modules/invitations/service.server";
import { invitationFailure } from "@/modules/invitations/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rid = newRequestId();
  try {
    requireOrigin(request);
    return authJson(
      await prepareInvitationEmail(
        await requireCouple(request),
        (await context.params).id,
        await readLoginBody(request),
      ),
      rid,
    );
  } catch (e) {
    return invitationFailure(e, rid);
  }
}

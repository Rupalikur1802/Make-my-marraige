import type { NextRequest } from "next/server";
import { authJson, newRequestId } from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { invitationManagement } from "@/modules/invitations/service.server";
import { invitationFailure } from "@/modules/invitations/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rid = newRequestId();
  try {
    return authJson(
      await invitationManagement(
        await requireCouple(request),
        (await context.params).id,
      ),
      rid,
    );
  } catch (e) {
    return invitationFailure(e, rid);
  }
}

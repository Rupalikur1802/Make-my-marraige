import type { NextRequest } from "next/server";
import { authJson, newRequestId } from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { queryValues } from "@/modules/families/http.server";
import { invitationFailure } from "@/modules/invitations/http.server";
import { attendanceSummary } from "@/modules/rsvp/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const rid = newRequestId();
  try {
    return authJson(
      await attendanceSummary(
        await requireCouple(request),
        queryValues(request.nextUrl),
      ),
      rid,
    );
  } catch (error) {
    return invitationFailure(error, rid);
  }
}

import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/modules/auth/errors";
import { appOrigin } from "@/lib/config.server";
export function invitationFailure(error: unknown, requestId: string) {
  let status = 503,
    code = "SERVICE_UNAVAILABLE",
    message = "Invitations are temporarily unavailable. Please try again.";
  if (error instanceof AuthError) ({ status, code, message } = error);
  else if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the invitation request and try again.";
  }
  if (status === 503)
    console.error(JSON.stringify({ requestId, code, operation: "invitation" }));
  return NextResponse.json(
    { error: { code, message }, meta: { requestId } },
    { status, headers: privateInvitationHeaders },
  );
}
export const privateInvitationHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};
export function guestCookie() {
  const secure = appOrigin().startsWith("https://");
  return {
    name: secure ? "__Host-guest_session" : "mmm_dev_guest_session",
    secure,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

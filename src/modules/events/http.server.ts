import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/modules/auth/errors";
export function eventFailure(error: unknown, requestId: string) {
  let status = 503,
    code = "SERVICE_UNAVAILABLE",
    message = "Ceremonies are temporarily unavailable. Please try again.";
  const fields: { [key: string]: string } = {};
  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the ceremony details and try again.";
    for (const issue of error.issues) {
      const key = issue.path[0];
      if (
        typeof key === "string" &&
        ["name", "venue", "startsAt", "expectedVersion", "status"].includes(key)
      )
        fields[key] = issue.message;
    }
  } else if (error instanceof AuthError) {
    ({ status, code, message } = error);
    if (code === "MALFORMED_JSON") message = "Enter a valid JSON request.";
  }
  if (status === 503)
    console.error(
      JSON.stringify({ requestId, code, operation: "ceremony-management" }),
    );
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(Object.keys(fields).length ? { fields } : {}),
      },
      meta: { requestId },
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/modules/auth/errors";
export function familyFailure(error: unknown, requestId: string) {
  let status = 503,
    code = "SERVICE_UNAVAILABLE",
    message = "Families are temporarily unavailable. Please try again.";
  const fields: Record<string, string> = {};
  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the family details and try again.";
    for (const issue of error.issues) {
      const key = issue.path[0];
      if (
        typeof key === "string" &&
        [
          "name",
          "email",
          "invitedCount",
          "eventIds",
          "expectedRevision",
          "q",
          "page",
          "pageSize",
        ].includes(key)
      )
        fields[key] = issue.message;
    }
  } else if (error instanceof AuthError) {
    ({ status, code, message } = error);
    if (code === "MALFORMED_JSON") message = "Enter a valid JSON request.";
  }
  if (status === 503)
    console.error(
      JSON.stringify({ requestId, code, operation: "family-management" }),
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
export function queryValues(url: URL) {
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(values, key))
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Duplicate query parameters are not allowed.",
      );
    values[key] = value;
  }
  return values;
}
export async function requireEmptyBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength) {
        await reader.cancel();
        throw new AuthError(
          "VALIDATION_ERROR",
          400,
          "Delete requests must not contain a body.",
        );
      }
    }
  } finally {
    reader.releaseLock();
  }
}

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/modules/auth/errors";
export const taskHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};
export function taskQuery(request: NextRequest) {
  const query: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    if (key in query)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Duplicate query parameters are not allowed.",
      );
    query[key] = value;
  }
  return query;
}
export function taskFailure(error: unknown, requestId: string) {
  let status = 503,
    code = "SERVICE_UNAVAILABLE",
    message = "Tasks are temporarily unavailable. Please try again.";
  const fields: Record<string, string> = {};
  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the task details and try again.";
    for (const issue of error.issues) {
      const key = issue.path[0];
      if (
        typeof key === "string" &&
        [
          "title",
          "notes",
          "assigneeName",
          "dueDate",
          "eventId",
          "status",
          "expectedVersion",
        ].includes(key)
      )
        fields[key] = issue.message;
    }
  } else if (error instanceof AuthError) ({ status, code, message } = error);
  if (status === 503)
    console.error(JSON.stringify({ requestId, operation: "tasks", code }));
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(Object.keys(fields).length ? { fields } : {}),
      },
      meta: { requestId },
    },
    { status, headers: taskHeaders },
  );
}

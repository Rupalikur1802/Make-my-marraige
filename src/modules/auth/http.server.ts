import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  appOrigin,
  ConfigurationError,
  coupleCookie,
} from "@/lib/config.server";
import { AuthError } from "./errors";
import { SESSION_SECONDS } from "./validation";
import { LoginDependencyError } from "./diagnostics.server";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};
export function authJson(data: unknown, requestId: string, status = 200) {
  return NextResponse.json(
    { data, meta: { requestId } },
    { status, headers: privateHeaders },
  );
}
export function authFailure(error: unknown, requestId: string) {
  let code = "SERVICE_UNAVAILABLE",
    status = 503,
    message = "Sign-in is temporarily unavailable. Please try again later.";
  let retryAfter: number | undefined;
  if (error instanceof AuthError)
    ({ code, status, message, retryAfter } = error);
  else if (error instanceof ZodError) {
    code = "VALIDATION_ERROR";
    status = 400;
    message = "Enter a valid email address and password.";
  }
  // Never log raw request bodies, paths, errors, database URIs or credentials.
  if (status === 503)
    console.error(
      JSON.stringify({
        requestId,
        code,
        operation: "couple-auth",
        configuration: error instanceof ConfigurationError,
        stage: error instanceof LoginDependencyError ? error.stage : "unknown",
      }),
    );
  return NextResponse.json(
    { error: { code, message }, meta: { requestId } },
    {
      status,
      headers: {
        ...privateHeaders,
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}
export function requireOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new AuthError(
      "ORIGIN_NOT_ALLOWED",
      403,
      "This request is not allowed.",
    );
}
export async function readLoginBody(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  )
    throw new AuthError("UNSUPPORTED_MEDIA_TYPE", 415, "Use a JSON request.");
  const limit = 64 * 1024;
  const reader = request.body?.getReader();
  if (!reader)
    throw new AuthError(
      "MALFORMED_JSON",
      400,
      "Enter a valid sign-in request.",
    );
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new AuthError(
          "PAYLOAD_TOO_LARGE",
          413,
          "The request is too large.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new AuthError(
      "MALFORMED_JSON",
      400,
      "Enter a valid sign-in request.",
    );
  }
}
export function setCoupleCookie(
  response: NextResponse,
  token: string,
  clear = false,
) {
  const { name, secure } = coupleCookie();
  response.cookies.set(name, clear ? "" : token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: clear ? 0 : SESSION_SECONDS,
  });
}
export function logoutResponse() {
  return new NextResponse(null, { status: 204, headers: privateHeaders });
}
export const newRequestId = () => randomUUID();

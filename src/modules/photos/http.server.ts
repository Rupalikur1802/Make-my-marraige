import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/modules/auth/errors";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { guestCookie } from "@/modules/invitations/http.server";
import {
  beginPhotoUpload,
  completePhotoUpload,
  deletePhoto,
  listPhotos,
  photoImage,
  savePhotoSettings,
  type PhotoPrincipal,
} from "./service.server";
export const photoHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};
export function photoFailure(error: unknown, requestId: string) {
  let status = 503,
    code = "SERVICE_UNAVAILABLE",
    message = "Photos are temporarily unavailable. Please try again later.";
  if (error instanceof AuthError) ({ status, code, message } = error);
  else if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Check the photo request and try again.";
  }
  if (status === 503)
    console.error(JSON.stringify({ requestId, operation: "photos", code }));
  return NextResponse.json(
    { error: { code, message }, meta: { requestId } },
    { status, headers: photoHeaders },
  );
}
export function photoQuery(request: NextRequest) {
  const q: Record<string, string> = {};
  for (const [k, v] of request.nextUrl.searchParams) {
    if (k in q)
      throw new AuthError(
        "VALIDATION_ERROR",
        400,
        "Duplicate query parameters are not allowed.",
      );
    q[k] = v;
  }
  return q;
}
export async function photoPrincipal(
  request: NextRequest,
  guest: boolean,
): Promise<PhotoPrincipal> {
  return guest
    ? { kind: "guest", token: request.cookies.get(guestCookie().name)?.value }
    : { kind: "couple", actor: await requireCouple(request) };
}
type Context = { params: Promise<{ id: string }> };
async function requireEmptyBody(request: NextRequest) {
  if (request.nextUrl.search)
    throw new AuthError(
      "VALIDATION_ERROR",
      400,
      "Unexpected query parameters.",
    );
  const reader = request.body?.getReader();
  if (!reader) return;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value.byteLength) {
        await reader.cancel();
        throw new AuthError("VALIDATION_ERROR", 400, "Use a bodyless request.");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
export function photoRoutes(guest: boolean) {
  return {
    async list(request: NextRequest) {
      const rid = newRequestId();
      try {
        return authJson(
          await listPhotos(
            await photoPrincipal(request, guest),
            photoQuery(request),
          ),
          rid,
        );
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
    async begin(request: NextRequest) {
      const rid = newRequestId();
      try {
        requireOrigin(request);
        if (request.nextUrl.search)
          throw new AuthError(
            "VALIDATION_ERROR",
            400,
            "Unexpected query parameters.",
          );
        return authJson(
          await beginPhotoUpload(
            await photoPrincipal(request, guest),
            await readLoginBody(request),
          ),
          rid,
        );
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
    async complete(request: NextRequest, context: Context) {
      const rid = newRequestId();
      try {
        requireOrigin(request);
        await requireEmptyBody(request);
        return authJson(
          await completePhotoUpload(
            await photoPrincipal(request, guest),
            (await context.params).id,
          ),
          rid,
        );
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
    async image(request: NextRequest, context: Context) {
      const rid = newRequestId();
      try {
        const q = photoQuery(request);
        if (
          Object.keys(q).some((k) => k !== "size") ||
          (q.size && !["thumbnail", "large"].includes(q.size))
        )
          throw new AuthError("VALIDATION_ERROR", 400, "Invalid photo size.");
        const upstream = await photoImage(
          await photoPrincipal(request, guest),
          (await context.params).id,
          q.size === "large",
        );
        return new Response(upstream.body, {
          headers: {
            ...photoHeaders,
            "Content-Type": "image/jpeg",
            "Content-Disposition": "inline",
          },
        });
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
    async remove(request: NextRequest, context: Context) {
      const rid = newRequestId();
      try {
        requireOrigin(request);
        await requireEmptyBody(request);
        await deletePhoto(
          await photoPrincipal(request, guest),
          (await context.params).id,
        );
        return new NextResponse(null, { status: 204, headers: photoHeaders });
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
    async settings(request: NextRequest) {
      const rid = newRequestId();
      try {
        requireOrigin(request);
        if (request.nextUrl.search)
          throw new AuthError(
            "VALIDATION_ERROR",
            400,
            "Unexpected query parameters.",
          );
        return authJson(
          await savePhotoSettings(
            await photoPrincipal(request, guest),
            await readLoginBody(request),
          ),
          rid,
        );
      } catch (e) {
        return photoFailure(e, rid);
      }
    },
  };
}

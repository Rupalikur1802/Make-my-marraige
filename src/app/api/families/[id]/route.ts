import { NextResponse, type NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import {
  getFamily,
  updateFamily,
  deleteFamily,
} from "@/modules/families/service.server";
import {
  familyFailure,
  queryValues,
  requireEmptyBody,
} from "@/modules/families/http.server";
import { familyDeleteSchema } from "@/modules/families/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    return authJson(
      await getFamily(await requireCouple(request), (await context.params).id),
      requestId,
    );
  } catch (error) {
    return familyFailure(error, requestId);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    return authJson(
      await updateFamily(
        await requireCouple(request),
        (await context.params).id,
        await readLoginBody(request),
      ),
      requestId,
    );
  } catch (error) {
    return familyFailure(error, requestId);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const actor = await requireCouple(request);
    await requireEmptyBody(request);
    const { expectedRevision } = familyDeleteSchema.parse(
      queryValues(request.nextUrl),
    );
    await deleteFamily(actor, (await context.params).id, expectedRevision);
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return familyFailure(error, requestId);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import {
  authJson,
  newRequestId,
  readLoginBody,
  requireOrigin,
} from "@/modules/auth/http.server";
import { requireCouple } from "@/modules/wedding/http.server";
import { createFamily, listFamilies } from "@/modules/families/service.server";
import { familyFailure, queryValues } from "@/modules/families/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  try {
    const result = await listFamilies(
      await requireCouple(request),
      queryValues(request.nextUrl),
    );
    return NextResponse.json(
      {
        data: result.families,
        meta: {
          requestId,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          summary: result.summary,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch (error) {
    return familyFailure(error, requestId);
  }
}
export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  try {
    requireOrigin(request);
    const data = await createFamily(
      await requireCouple(request),
      await readLoginBody(request),
    );
    const response = authJson(data, requestId, 201);
    response.headers.set("Location", "/api/families/" + data.id);
    return response;
  } catch (error) {
    return familyFailure(error, requestId);
  }
}

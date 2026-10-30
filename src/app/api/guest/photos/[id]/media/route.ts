import { photoRoutes } from "@/modules/photos/http.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = photoRoutes(true).image;

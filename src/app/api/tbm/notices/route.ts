import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const upstream = new URL("/api/v1/tbm/compat/notices", "http://v3.local");
  const siteId = req.nextUrl.searchParams.get("site_id");
  const date = req.nextUrl.searchParams.get("date");
  const limit = req.nextUrl.searchParams.get("limit");
  if (siteId) upstream.searchParams.set("site_id", siteId);
  if (date) upstream.searchParams.set("date", date);
  if (limit) upstream.searchParams.set("limit", limit);
  return proxyV3Api(req, `${upstream.pathname}${upstream.search}`);
}

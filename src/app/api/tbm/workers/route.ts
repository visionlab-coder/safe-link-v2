import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const upstream = new URL("/api/v1/tbm/compat/workers", "http://v3.local");
  const siteId = req.nextUrl.searchParams.get("site_id");
  if (siteId) upstream.searchParams.set("site_id", siteId);
  return proxyV3Api(req, `${upstream.pathname}${upstream.search}`);
}

import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const upstream = new URL("/api/v1/tbm/compat/acks", "http://v3.local");
  const tbmId = req.nextUrl.searchParams.get("tbmId");
  if (tbmId) upstream.searchParams.set("tbmId", tbmId);
  return proxyV3Api(req, `${upstream.pathname}${upstream.search}`);
}

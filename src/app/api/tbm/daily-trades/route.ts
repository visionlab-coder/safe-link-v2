import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";
import { handleMobilePreflight, withMobileCors } from "@/utils/auth/mobile-cors";
export const runtime = "nodejs";
export async function OPTIONS(req: NextRequest) {
  const res = handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
  if (res.status === 204) res.headers.set("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  return res;
}
function path(req: NextRequest) {
  return `/api/v1/tbm/compat/daily-trades?${new URLSearchParams({ siteId: req.nextUrl.searchParams.get("siteId") ?? "" })}`;
}
export async function GET(req: NextRequest) {
  const res = await proxyV3Api(req, path(req));
  res.headers.set("Cache-Control", "private, no-store");
  return withMobileCors(res, req.headers.get("origin"));
}
export async function PUT(req: NextRequest) {
  const res = await proxyV3Api(req, path(req), { method: "PUT", body: await req.text() });
  return withMobileCors(res, req.headers.get("origin"));
}

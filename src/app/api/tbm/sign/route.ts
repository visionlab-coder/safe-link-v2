import { NextRequest, NextResponse } from "next/server";
import { handleMobilePreflight, withMobileCors } from "@/utils/auth/mobile-cors";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function GET(req: NextRequest) {
  const upstream = new URL("/api/v1/tbm/compat/sign", "http://v3.local");
  const tbmId = req.nextUrl.searchParams.get("tbmId");
  if (tbmId) upstream.searchParams.set("tbmId", tbmId);
  const res = await proxyV3Api(req, `${upstream.pathname}${upstream.search}`);
  return withMobileCors(res, req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const res = await proxyV3Api(req, "/api/v1/tbm/compat/sign", {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: await req.text(),
  });
  return withMobileCors(res, req.headers.get("origin"));
}

import { NextRequest, NextResponse } from "next/server";
import { handleMobilePreflight, withMobileCors } from "@/utils/auth/mobile-cors";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

function todayPath(req: NextRequest): string {
  const upstream = new URL("/api/v1/tbm/compat/today", "http://v3.local");
  const id = req.nextUrl.searchParams.get("id");
  const limit = req.nextUrl.searchParams.get("limit");
  if (id) upstream.searchParams.set("id", id);
  if (limit) upstream.searchParams.set("limit", limit);
  return `${upstream.pathname}${upstream.search}`;
}

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function GET(req: NextRequest) {
  const res = await proxyV3Api(req, todayPath(req));
  return withMobileCors(res, req.headers.get("origin"));
}

import { NextRequest, NextResponse } from "next/server";
import { handleMobilePreflight, withMobileCors } from "@/utils/auth/mobile-cors";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function GET(req: NextRequest) {
  const query = new URLSearchParams();
  for (const key of ["siteId", "cursor", "limit"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const res = await proxyV3Api(req, `/api/v1/tbm/compat/pending?${query}`);
  res.headers.set("Cache-Control", "private, no-store");
  return withMobileCors(res, req.headers.get("origin"));
}

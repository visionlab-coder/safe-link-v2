import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let allowed = false;
  try { allowed = new URL(req.headers.get("origin") || "").host === req.headers.get("host"); } catch { /* fail closed */ }
  if (!allowed) return NextResponse.json({ error: "origin_denied" }, { status: 403 });
  const body = await req.text();
  if (body.length > 1024) return NextResponse.json({ error: "name_too_long" }, { status: 413 });
  return proxyV3Api(req, "/api/v1/auth/romanize-name", { method: "POST", body });
}

import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  // The BFF creates a CSRF token, so reject browser cross-origin enrollment here as well.
  const origin = req.headers.get("origin");
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === req.headers.get("host"); } catch { /* reject malformed origin */ }
  if (!sameOrigin) {
    return NextResponse.json({ error: "origin_denied" }, { status: 403 });
  }
  return proxyV3Api(req, "/api/v1/auth/temporary-worker", { method: "POST", body: await req.text() });
}

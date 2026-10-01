import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode");
  const path = mode === "admin" ? "/api/v1/admin/worker-upgrades" : mode === "sites" ? "/api/v1/worker-upgrade/sites" : "/api/v1/worker-upgrade";
  const response = await proxyV3Api(req, path);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function POST(req: NextRequest) {
  let sameOrigin = false;
  try { sameOrigin = new URL(req.headers.get("origin") || "").host === req.headers.get("host"); } catch { /* deny */ }
  if (!sameOrigin) return NextResponse.json({ error: "origin_denied" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("decision");
  if (id !== null && !/^[1-9][0-9]*$/.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  return proxyV3Api(req, id ? `/api/v1/admin/worker-upgrades/${id}/decision` : "/api/v1/worker-upgrade", { method: "POST", body: await req.text() });
}

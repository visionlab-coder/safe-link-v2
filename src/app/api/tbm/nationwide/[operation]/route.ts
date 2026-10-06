import { NextRequest, NextResponse } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";
export const runtime = "nodejs";
type Context = { params: Promise<{ operation: string }> };
const operations = new Set(["sessions", "speaking", "translations", "draft", "stop", "summary", "broadcast"]);
export async function POST(req: NextRequest, context: Context) {
  const { operation } = await context.params;
  if (!operations.has(operation)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return proxyV3Api(req, `/api/v1/tbm/nationwide/${operation}`, { method: "POST", body: await req.text() });
}
export async function GET(req: NextRequest, context: Context) {
  const { operation } = await context.params;
  if (operation !== "targets") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return proxyV3Api(req, "/api/v1/tbm/nationwide/targets");
}

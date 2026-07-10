import { NextRequest } from "next/server";
import { proxyV3Api } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

function compatMessagesPath(req: NextRequest): string {
  const upstream = new URL("/api/v1/chat/compat/messages", "http://v3.local");
  const peerId = req.nextUrl.searchParams.get("peer_id");
  const limit = req.nextUrl.searchParams.get("limit");
  const before = req.nextUrl.searchParams.get("before");
  if (peerId) upstream.searchParams.set("peer_id", peerId);
  if (limit) upstream.searchParams.set("limit", limit);
  if (before) upstream.searchParams.set("before", before);
  return `${upstream.pathname}${upstream.search}`;
}

export async function GET(req: NextRequest) {
  return proxyV3Api(req, compatMessagesPath(req));
}

export async function POST(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/chat/compat/messages", {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: await req.text(),
  });
}

export async function PATCH(req: NextRequest) {
  return proxyV3Api(req, "/api/v1/chat/compat/messages", {
    method: "PATCH",
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: await req.text(),
  });
}

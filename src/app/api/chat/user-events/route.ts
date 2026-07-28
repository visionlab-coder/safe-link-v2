import { NextRequest, NextResponse } from "next/server";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie") ?? "";
  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/chat/compat/user-events`, {
      headers: { Accept: "text/event-stream", ...(cookie ? { cookie } : {}) },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "v3_api_unreachable" }, { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(await upstream.text().catch(() => ""), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

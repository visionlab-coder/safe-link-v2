import { NextRequest, NextResponse } from "next/server";
import { verifyTravelToken } from "@/lib/travel-auth";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("SAFE_LINK_TRAVEL")?.value;
  if (!verifyTravelToken(token)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const room = request.nextUrl.searchParams.get("room") || "";
  if (!/^[0-9]{4}$/.test(room)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }
  const secret = process.env.TRAVEL_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Travel gateway unavailable" }, { status: 503 });
  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/travel/internal/events?room=${encodeURIComponent(room)}`, {
      headers: {
        Accept: "text/event-stream",
        "X-Safe-Link-Internal-Secret": secret,
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Travel gateway unavailable" }, { status: 503 });
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
    },
  });
}

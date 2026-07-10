import { NextRequest, NextResponse } from "next/server";
import { verifyTravelToken } from "@/lib/travel-auth";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!verifyTravelToken(token)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { room, lang, senderId } = await request.json() as { room?: string; lang?: string; senderId?: string };
  if (!room || !lang || !senderId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  return sendSignal({ room, event: "partner-joined", senderId, payload: { lang } });
}

async function sendSignal(payload: object) {
  const secret = process.env.TRAVEL_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Travel gateway unavailable" }, { status: 503 });
  try {
    const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/travel/internal/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Safe-Link-Internal-Secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Travel gateway unavailable" }, { status: 503 });
  }
}

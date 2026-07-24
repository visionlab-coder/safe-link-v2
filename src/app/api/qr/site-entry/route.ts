import { NextRequest, NextResponse } from "next/server";
import { checkQrEntryLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.SAFE_LINK_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!(await checkQrEntryLimit(ip))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Forwarded-For": ip,
  };
  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.Cookie = cookie;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/qr/site-entry`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.warn("[qr-site-entry] Spring QR entry proxy failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "SPRING_QR_ENTRY_UNAVAILABLE" }, { status: 503 });
  }

  const response = new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}

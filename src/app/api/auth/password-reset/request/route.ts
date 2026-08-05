import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL =
  process.env.SAFE_LINK_INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL ||
  "http://localhost:8080";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}/api/v1/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": req.headers.get("x-forwarded-for") ?? "",
      },
      body: JSON.stringify({ email: String(body.email ?? "").trim() }),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "password_reset_service_unavailable" }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { handleMobilePreflight } from "@/utils/auth/mobile-cors";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "email_password_required" }, { status: 400 });
  }

  const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": req.headers.get("x-forwarded-for") ?? "",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const upstreamText = await upstream.text();
  const setCookie = upstream.headers.get("set-cookie");

  if (!upstream.ok) {
    let upstreamError: string | null = null;
    try {
      const parsed = JSON.parse(upstreamText) as { error?: unknown };
      upstreamError = typeof parsed.error === "string" ? parsed.error : null;
    } catch {
      upstreamError = null;
    }
    const response = NextResponse.json(
      { error: upstreamError ?? `v3_login_failed_${upstream.status}` },
      { status: upstream.status },
    );
    if (setCookie) response.headers.append("set-cookie", setCookie);
    return response;
  }

  const response = new NextResponse(upstreamText, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}

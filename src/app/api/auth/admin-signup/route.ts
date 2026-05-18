import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Company email domains allowed to self-register as admins.
// Anyone outside these domains is rejected server-side before a Supabase account is created.
const ALLOWED_DOMAINS = new Set(["seowonenc.co.kr"]);

// 3 signup attempts per IP per 10 minutes — prevents bulk account creation
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "email_password_required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
  }

  const emailParts = email.split("@");
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  const domain = emailParts[1];
  if (!ALLOWED_DOMAINS.has(domain)) {
    return NextResponse.json({ error: "DOMAIN_NOT_ALLOWED" }, { status: 403 });
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
  }

  const service = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      (error as { code?: string }).code === "email_exists"
    ) {
      return NextResponse.json({ error: "ALREADY_REGISTERED" }, { status: 409 });
    }
    return NextResponse.json({ error: "SIGNUP_FAILED" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

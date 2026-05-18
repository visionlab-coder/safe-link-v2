import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

// 5 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// POST /api/auth/worker-login
// body: { phoneNumber, displayName, lang? }
// Establishes a Supabase session via server-side magic link — no password involved.
//
// Security note: phone number alone identifies the worker (trust-on-first-use).
// This is an accepted design constraint for the fallback manual login path;
// the primary flow uses NFC sticker + HMAC signature (worker-preference route).
// Rate limiting at this endpoint (5 req/min per IP) limits enumeration exposure.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { phoneNumber?: unknown; displayName?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const phoneDigits = String(body.phoneNumber ?? "").replace(/[^0-9]/g, "");

  // C-10 부분 개선: 전화번호 단위 추가 rate limit (IP 우회 시에도 계정 열거 차단)
  if (!checkRateLimit(`phone:${phoneDigits}`)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const displayName = String(body.displayName ?? "").trim().slice(0, 100);
  const lang = /^[a-z]{2,5}$/.test(String(body.lang ?? ""))
    ? String(body.lang)
    : "ko";

  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "DISPLAY_NAME_REQUIRED" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
  }

  const service = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `${phoneDigits}@safe-link.local`;

  // C-06: 전화번호만으로 신규 계정 생성 차단 — 사전 등록된 근로자만 허용.
  // nfc_workers(phone_last4) 또는 profiles(phone_number) 중 하나라도 존재해야 함.
  const [nfcWorkerResult, profileResult] = await Promise.all([
    service.from("nfc_workers").select("id").eq("phone_last4", phoneDigits.slice(-4)).eq("is_active", true).limit(1).maybeSingle(),
    service.from("profiles").select("id").eq("phone_number", phoneDigits).limit(1).maybeSingle(),
  ]);
  if (!nfcWorkerResult.data && !profileResult.data) {
    return NextResponse.json({ error: "WORKER_NOT_REGISTERED" }, { status: 403 });
  }

  // generateLink creates the user if they don't exist yet, or issues a token
  // for an existing user — no password ever required.
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: { phone_number: phoneDigits, display_name: displayName },
    },
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "AUTH_LINK_FAILED" }, { status: 500 });
  }

  const tokenHash = linkData.properties.hashed_token;
  const authUserId = linkData.user?.id ?? null;

  // Exchange the magic-link token for a session server-side.
  // The cookie-aware server client writes sb-access-token / sb-refresh-token
  // into the response automatically via Next.js cookies().
  const serverClient = await createServerClient();
  const { error: otpErr } = await serverClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpErr) {
    return NextResponse.json({ error: "SESSION_EXCHANGE_FAILED" }, { status: 500 });
  }

  // Only set display_name and role on first creation — never overwrite on
  // subsequent logins to prevent an impersonator from stomping the real name.
  if (authUserId) {
    const { data: existingProfile } = await service
      .from("profiles")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle();

    if (existingProfile) {
      await service
        .from("profiles")
        .update({ preferred_lang: lang, phone_number: phoneDigits })
        .eq("id", authUserId);
    } else {
      await service.from("profiles").insert({
        id: authUserId,
        display_name: displayName,
        role: "WORKER",
        preferred_lang: lang,
        phone_number: phoneDigits,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

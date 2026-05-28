import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { checkWorkerLoginLimit, checkWorkerLoginPhoneLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

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

  if (!(await checkWorkerLoginLimit(ip))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { phoneNumber?: unknown; displayName?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const phoneDigits = String(body.phoneNumber ?? "").replace(/[^0-9]/g, "");

  // Validate length before consuming phone-keyed rate limit tokens
  // (prevents Redis key pollution with malformed/empty phone strings)
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
  }

  // C-10: 전화번호 단위 분산 rate limit — 멀티 인스턴스에서도 IP 우회 방지
  if (!(await checkWorkerLoginPhoneLimit(phoneDigits))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const displayName = String(body.displayName ?? "").trim().slice(0, 100);
  const lang = /^[a-z]{2,5}$/.test(String(body.lang ?? ""))
    ? String(body.lang)
    : "ko";
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
  // nfc_workers.phone(전체 번호) 또는 profiles.phone_number(전체 번호) 중 하나라도 존재해야 함.
  // phone_last4(뒤 4자리)는 충돌 공간이 너무 작아 인증 게이트로 사용 불가.
  const [nfcWorkerResult, profileResult] = await Promise.all([
    service.from("nfc_workers").select("id").eq("phone", phoneDigits).eq("is_active", true).limit(1).maybeSingle(),
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
  const verificationType = linkData.properties.verification_type ?? "magiclink";
  const authUserId = linkData.user?.id ?? null;

  // 🚨 P2/P5 박제: @supabase/ssr 의 verifyOtp 가 Workers 에서 apikey 헤더 손상으로
  // SESSION_EXCHANGE_FAILED. GoTrue REST API 에 raw fetch 직접 호출.
  // admin-login route 와 동일 패턴 (apikey URL param + JSON 응답 직접 파싱).
  const verifyRes = await fetch(
    `${supabaseUrl}/auth/v1/verify?apikey=${encodeURIComponent(serviceKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verificationType, token_hash: tokenHash }),
    }
  );

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "SESSION_EXCHANGE_FAILED" }, { status: 500 });
  }

  const session = (await verifyRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: Record<string, unknown>;
  };

  if (!session.access_token) {
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

  // 🚨 P1 박제: @supabase/ssr 표준 쿠키 형식으로 직접 설정.
  // httpOnly:false 필수 — createBrowserClient 가 document.cookie 로 읽기 위해.
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  const maxAge = session.expires_in ?? 3600;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, cookieValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

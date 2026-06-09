import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { checkWorkerLoginLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

// POST /api/auth/worker-quick-login
// body: { name_initials, phone_last4, preferred_lang?, site_id? }
//
// 이니셜 + 휴대전화 뒷 4자리만으로 근로자 로그인. NFC 사전 등록된 워커만 허용.
// 단일 매칭 → 즉시 세션 발급. 복수 사이트 매칭 → 사이트 선택 단계 응답.
//
// 🔐 P5/P7 패턴: GoTrue REST API raw fetch + NextResponse.cookies.set 수동 설정.

function nfcEmail(workerId: string): string {
  return `nfc.${workerId}@safe-link.internal`;
}

function cleanInitials(value: unknown): string | null {
  const initials = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  return initials.length > 0 ? initials : null;
}

function cleanPhoneLast4(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? digits : null;
}

function cleanLang(value: unknown): string {
  const lang = String(value || "").trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(lang) ? lang : "ko";
}

function cleanUuid(value: unknown): string | null {
  const raw = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!(await checkWorkerLoginLimit(ip))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: {
    name_initials?: unknown;
    phone_last4?: unknown;
    preferred_lang?: unknown;
    site_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const initials = cleanInitials(body.name_initials);
  const phoneLast4 = cleanPhoneLast4(body.phone_last4);
  if (!initials) return NextResponse.json({ error: "INITIALS_REQUIRED" }, { status: 400 });
  if (!phoneLast4) return NextResponse.json({ error: "PHONE_LAST4_REQUIRED" }, { status: 400 });

  const preferredLang = cleanLang(body.preferred_lang);
  const requestedSiteId = cleanUuid(body.site_id);

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
  }

  const service = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 매칭 — 이니셜 + last4 (+ 선택적으로 사이트 한정)
  let lookup = service
    .from("nfc_workers")
    .select("id, assigned_site_id, full_name, preferred_lang, auth_user_id, nationality")
    .eq("name_initials", initials)
    .eq("phone_last4", phoneLast4)
    .eq("is_active", true)
    .limit(5);
  if (requestedSiteId) lookup = lookup.eq("assigned_site_id", requestedSiteId);

  const { data: matches, error: lookupErr } = await lookup;
  if (lookupErr) return NextResponse.json({ error: "LOOKUP_FAILED" }, { status: 500 });

  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: "WORKER_NOT_FOUND" }, { status: 404 });
  }

  // 복수 사이트 매칭 — 클라이언트가 사이트 선택 후 재호출
  if (matches.length > 1) {
    const siteIds = Array.from(new Set(matches.map((m) => m.assigned_site_id).filter(Boolean)));
    const { data: sites } = await service
      .from("sites")
      .select("id, name, site_code")
      .in("id", siteIds as string[]);
    return NextResponse.json({
      error: "MULTIPLE_SITES",
      sites: (sites ?? []).map((s) => ({
        site_id: s.id,
        name: s.name,
        site_code: s.site_code,
      })),
    }, { status: 409 });
  }

  const worker = matches[0];

  // 세션 발급 — GoTrue admin generateLink → raw verify (P7 패턴)
  const email = nfcEmail(worker.id);
  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { nfc_worker_id: worker.id } },
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "AUTH_LINK_FAILED" }, { status: 500 });
  }

  const tokenHash = linkData.properties.hashed_token;
  const verifyType = linkData.properties.verification_type ?? "magiclink";
  const authUserId = linkData.user?.id ?? worker.auth_user_id ?? null;

  const ALLOWED_TYPES = ["signup", "magiclink", "email"] as const;
  type AllowedType = typeof ALLOWED_TYPES[number];
  const safeType: AllowedType = (ALLOWED_TYPES as readonly string[]).includes(verifyType)
    ? (verifyType as AllowedType)
    : "magiclink";

  const verifyRes = await fetch(
    `${supabaseUrl}/auth/v1/verify?apikey=${encodeURIComponent(serviceKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: safeType, token_hash: tokenHash }),
    }
  );
  if (!verifyRes.ok) return NextResponse.json({ error: "SESSION_EXCHANGE_FAILED" }, { status: 500 });

  const session = (await verifyRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!session.access_token) {
    return NextResponse.json({ error: "SESSION_EXCHANGE_FAILED" }, { status: 500 });
  }

  // profiles 보강 — site_id 동기화 (NULL 일 때만)
  if (authUserId) {
    const { data: existing } = await service
      .from("profiles")
      .select("id, site_id, role")
      .eq("id", authUserId)
      .maybeSingle();

    if (existing) {
      const upd: Record<string, unknown> = { preferred_lang: preferredLang };
      if (worker.assigned_site_id && !existing.site_id) upd.site_id = worker.assigned_site_id;
      // 🆕 정확한 국기 표시용 — nfc_workers.nationality 동기화
      if (worker.nationality) upd.nationality = worker.nationality;
      await service.from("profiles").update(upd).eq("id", authUserId);
    } else {
      await service.from("profiles").insert({
        id: authUserId,
        display_name: worker.full_name ?? initials,
        role: "WORKER",
        preferred_lang: preferredLang,
        ...(worker.assigned_site_id ? { site_id: worker.assigned_site_id } : {}),
        ...(worker.nationality ? { nationality: worker.nationality } : {}),
      });
    }

    if (!worker.auth_user_id) {
      await service.from("nfc_workers").update({ auth_user_id: authUserId }).eq("id", worker.id);
    }
  }

  // P1 표준 쿠키 형식
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  const maxAge = session.expires_in ?? 3600;

  const response = NextResponse.json({
    ok: true,
    worker: {
      id: worker.id,
      full_name: worker.full_name,
      preferred_lang: worker.preferred_lang,
      assigned_site_id: worker.assigned_site_id,
      nationality: worker.nationality,
    },
  });
  response.cookies.set(cookieName, cookieValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

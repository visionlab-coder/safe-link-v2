import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkQrEntryLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

const COUNTRY_TO_LANG: Record<string, string> = {
  KR: "ko",
  VN: "vi",
  CN: "zh",
  TH: "th",
  ID: "id",
  PH: "ph",
  UZ: "uz",
  RU: "ru",
  JP: "jp",
  MN: "mn",
  MM: "my",
  KH: "km",
  NP: "ne",
  BD: "bn",
  KZ: "kk",
  IN: "hi",
  SA: "ar",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_SELECT = "id, name, code, site_code";

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function cleanCountry(value: unknown): string {
  const code = String(value || "KR").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "KR";
}

function cleanLang(value: unknown, country: string): string {
  const lang = String(value || COUNTRY_TO_LANG[country] || "ko").trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(lang) ? lang : "ko";
}

function cleanInitials(value: unknown): string | null {
  // V2: 최대 6자까지 허용 (NGUYEN/SMITH 등 6자 영문 이름 짤림 방지). 영문/숫자만.
  const initials = String(value || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
  return initials.length > 0 ? initials : null;
}

function cleanPhoneLast4(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? digits : null;
}

function nfcEmail(workerId: string): string {
  return `nfc.${workerId}@safe-link.internal`;
}

function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function resolveSiteByRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>,
  siteRef: string
) {
  const ref = String(siteRef || "").trim();
  if (!ref) return null;

  if (UUID_PATTERN.test(ref)) {
    const { data } = await service.from("sites").select(SITE_SELECT).eq("id", ref).maybeSingle();
    if (data) return data;
  }

  const upperRef = ref.toUpperCase();
  const { data: byCode } = await service.from("sites").select(SITE_SELECT).eq("code", upperRef).maybeSingle();
  if (byCode) return byCode;

  const { data: bySiteCode } = await service.from("sites").select(SITE_SELECT).eq("site_code", upperRef).maybeSingle();
  if (bySiteCode) return bySiteCode;

  const safeRef = ref.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const { data: byName } = await service.from("sites").select(SITE_SELECT).ilike("name", safeRef).limit(1).maybeSingle();
  return byName ?? null;
}

async function isSiteAccessEnabled(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>,
  siteId: string
): Promise<boolean> {
  const { data } = await service
    .from("nfc_site_access_controls")
    .select("is_enabled")
    .eq("site_id", siteId)
    .maybeSingle();
  // QR 경로는 default-allow — 레코드 없어도 입장 가능 (NFC는 별도 strict)
  // 명시적으로 is_enabled=false 설정한 현장만 차단
  return data?.is_enabled !== false;
}

async function recordQrTbmAttendance(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>;
  workerId: string;
  siteId: string;
  preferredLang: string;
}) {
  const { data: session } = await args.service
    .from("nfc_tbm_sessions")
    .select("id, title, status, started_at")
    .eq("site_id", args.siteId)
    .in("status", ["open", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return { action: "no_active_session" as const, session: null };

  const { data: existing } = await args.service
    .from("nfc_tbm_attendance")
    .select("id, is_certified")
    .eq("session_id", session.id)
    .eq("worker_id", args.workerId)
    .maybeSingle();

  if (existing?.is_certified) return { action: "already_certified" as const, session };

  const now = new Date().toISOString();
  if (existing) {
    await args.service
      .from("nfc_tbm_attendance")
      .update({ certified_at: now, is_certified: true })
      .eq("id", existing.id);
    return { action: "certified" as const, session };
  }

  await args.service.from("nfc_tbm_attendance").insert({
    session_id: session.id,
    worker_id: args.workerId,
    tapped_at: now,
    lang_used: args.preferredLang,
    is_certified: false,
    entry_method: "qr",
  });

  return { action: "checked_in" as const, session };
}

export async function POST(req: NextRequest) {
  let body: {
    site_id?: unknown;
    mode?: "info" | "enter";
    name_initials?: unknown;
    phone_last4?: unknown;
    nationality?: unknown;
    preferred_lang?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!(await checkQrEntryLimit(ip))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const service = createService();
  const site = await resolveSiteByRef(service, String(body.site_id || ""));
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });

  if (body.mode === "info") {
    return NextResponse.json({
      ok: true,
      site: { id: site.id, name: site.name, code: site.site_code ?? site.code ?? null },
    });
  }

  const initials = cleanInitials(body.name_initials);
  const phoneLast4 = cleanPhoneLast4(body.phone_last4);
  if (!initials) return NextResponse.json({ error: "initials_required" }, { status: 400 });
  if (!phoneLast4) return NextResponse.json({ error: "phone_last4_required" }, { status: 400 });

  const nationality = cleanCountry(body.nationality);
  const preferredLang = cleanLang(body.preferred_lang, nationality);

  if (!(await isSiteAccessEnabled(service, String(site.id)))) {
    return NextResponse.json({ error: "site_access_disabled" }, { status: 403 });
  }

  const { data: workers, error: workerErr } = await service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id, is_active")
    .eq("assigned_site_id", site.id)
    .eq("name_initials", initials)
    .eq("phone_last4", phoneLast4)
    .eq("is_active", true)
    .limit(2);

  if (workerErr) return NextResponse.json({ error: "worker_lookup_failed" }, { status: 500 });
  if (workers && workers.length > 1) return NextResponse.json({ error: "worker_match_ambiguous" }, { status: 409 });

  // 🟢 V2 정책: 미등록 워커도 사이트 QR 스캔 + 이니셜 + 뒷4자리로 자동 가입 가능.
  //   - 이전 C-9 (사전 등록 필수) 정책 완화.
  //   - 관리자가 NFC 발급하지 않아도 첫 입장 시 nfc_workers 자동 생성.
  //   - 같은 사이트 내 (initials + last4) 중복은 위 limit(2) + length>1 검증으로 차단됨.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any;
  if (!workers || workers.length === 0) {
    const { data: newWorker, error: createErr } = await service
      .from("nfc_workers")
      .insert({
        name_initials: initials,
        phone_last4: phoneLast4,
        full_name: initials,
        nationality,
        preferred_lang: preferredLang,
        trade: "general",
        assigned_site_id: site.id,
        is_active: true,
        consent_signed_at: new Date().toISOString(),
      })
      .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id, is_active")
      .single();
    if (createErr || !newWorker) {
      return NextResponse.json({ error: "worker_auto_enroll_failed", detail: createErr?.message }, { status: 500 });
    }
    worker = newWorker;
  } else {
    worker = workers[0];
  }
  const nowIso = new Date().toISOString();
  const { data: updatedWorker, error: updateErr } = await service
    .from("nfc_workers")
    .update({
      nationality,
      preferred_lang: preferredLang,
      nationality_confirmed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", worker.id)
    .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id")
    .single();

  if (updateErr || !updatedWorker) {
    return NextResponse.json({ error: "preference_update_failed" }, { status: 500 });
  }

  const workDate = todayInSeoul();
  const { data: dailyAccess } = await service
    .from("nfc_worker_daily_access")
    .select("id, status")
    .eq("worker_id", worker.id)
    .eq("work_date", workDate)
    .maybeSingle();

  let accessAction: "checked_in" | "already_checked_in" | "checked_out";
  let accessActive = true;

  if (dailyAccess?.status === "checked_out") {
    accessAction = "checked_out";
    accessActive = false;
  } else if (dailyAccess?.status === "active") {
    // 재스캔 = 퇴근 처리. DB에 checked_out 기록 후 세션 종료.
    await service.from("nfc_worker_daily_access").update({
      status: "checked_out",
      checked_out_at: nowIso,
      last_seen_at: nowIso,
      checkout_location: { source: "site_qr_rescan" },
    }).eq("id", dailyAccess.id);
    accessAction = "checked_out";
    accessActive = false;
  } else {
    const { error: checkinErr } = await service.from("nfc_worker_daily_access").insert({
      worker_id: worker.id,
      site_id: site.id,
      work_date: workDate,
      status: "active",
      checked_in_at: nowIso,
      last_seen_at: nowIso,
      checkin_location: { source: "site_qr" },
    });
    if (checkinErr) {
      // B2: 동시 더블 탭으로 unique 충돌 → already_checked_in으로 처리
      if (checkinErr.code === "23505") {
        accessAction = "already_checked_in";
      } else {
        return NextResponse.json({ error: "checkin_failed" }, { status: 500 });
      }
    } else {
      accessAction = "checked_in";
    }
  }

  const tbm = accessActive
    ? await recordQrTbmAttendance({
        service,
        workerId: worker.id,
        siteId: String(site.id),
        preferredLang,
      })
    : { action: "checked_out" as const, session: null };

  let authUserId: string | null = updatedWorker.auth_user_id ?? null;
  const email = nfcEmail(worker.id);
  let generatedTokenHash: string | null = null;
  let generatedVerificationType: string = "magiclink";

  if (!authUserId) {
    const { data: linkData } = await service.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: { nfc_worker_id: worker.id } },
    });
    authUserId = linkData?.user?.id ?? null;
    generatedTokenHash = linkData?.properties?.hashed_token ?? null;
    // 신규 유저는 "signup", 기존 유저는 "magiclink" — verifyOtp 타입 불일치 방지
    generatedVerificationType = linkData?.properties?.verification_type ?? "magiclink";
  }

  if (authUserId) {
    // B1: 기존 프로필 role 확인 — 관리자 권한을 WORKER로 강등하지 않음
    const { data: existingProfile } = await service
      .from("profiles")
      .select("role")
      .eq("id", authUserId)
      .maybeSingle();
    const resolvedRole =
      existingProfile?.role && existingProfile.role !== "WORKER"
        ? existingProfile.role
        : "WORKER";

    await Promise.all([
      service.from("profiles").upsert(
        {
          id: authUserId,
          role: resolvedRole,
          display_name: updatedWorker.full_name,
          preferred_lang: preferredLang,
          site_id: site.id,
          site_code: site.name ?? null,
          // 🆕 2026-06-09: 정확한 깃발 표시용 — admin/chat 등 UI 가
          // preferred_lang 이 아닌 nationality 기준 국기 사용.
          nationality: nationality,
        },
        { onConflict: "id" }
      ),
      service.from("nfc_workers").update({ auth_user_id: authUserId }).eq("id", worker.id),
    ]);
  }

  const { auth_user_id: _authUserId, ...workerPublic } = updatedWorker;
  const basePayload = {
    ok: true,
    worker: workerPublic,
    site: { id: site.id, name: site.name, code: site.site_code ?? site.code ?? null },
    access: { action: accessAction, active: accessActive, work_date: workDate, site_id: site.id },
    qr_action: tbm.action,
    session: tbm.session ? { id: tbm.session.id, title: tbm.session.title } : null,
  };

  if (!authUserId || !accessActive) return NextResponse.json(basePayload);

  let tokenHash: string | null = generatedTokenHash;
  let verifyType: string = generatedVerificationType;
  if (!tokenHash) {
    const { data: fallbackLink } = await service.auth.admin.generateLink({ type: "magiclink", email });
    tokenHash = fallbackLink?.properties?.hashed_token ?? null;
    verifyType = fallbackLink?.properties?.verification_type ?? "magiclink";
  }

  if (!tokenHash) return NextResponse.json(basePayload);

  const ALLOWED_VERIFY_TYPES = ["signup", "magiclink", "email"] as const;
  type AllowedVerifyType = typeof ALLOWED_VERIFY_TYPES[number];
  const safeVerifyType: AllowedVerifyType = (ALLOWED_VERIFY_TYPES as readonly string[]).includes(verifyType)
    ? verifyType as AllowedVerifyType
    : "magiclink";

  // 🚨 P5/P7 박제: @supabase/ssr 의 verifyOtp + cookieStore.set 이 Cloudflare Workers
  // Route Handler 에서 silent throw → set-cookie 누락 → /worker 진입 시 middleware
  // 가 인증 못 알아보고 /auth 로 redirect (사용자 "전화번호 로그인 화면으로 튕김" 증상).
  // GoTrue REST API 에 raw fetch 직접 호출 + NextResponse.cookies.set 으로 수동 쿠키 설정.
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl || !serviceKey) return NextResponse.json(basePayload);

  const verifyRes = await fetch(
    `${supabaseUrl}/auth/v1/verify?apikey=${encodeURIComponent(serviceKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: safeVerifyType, token_hash: tokenHash }),
    }
  );
  if (!verifyRes.ok) return NextResponse.json(basePayload);

  const session = (await verifyRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: Record<string, unknown>;
  };
  if (!session.access_token) return NextResponse.json(basePayload);

  // P1 박제: @supabase/ssr 표준 쿠키 형식. httpOnly:false 필수 — createBrowserClient
  // 가 document.cookie 로 읽기 위해.
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  const maxAge = session.expires_in ?? 3600;

  const response = NextResponse.json({ ...basePayload, session_established: true });
  response.cookies.set(cookieName, cookieValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

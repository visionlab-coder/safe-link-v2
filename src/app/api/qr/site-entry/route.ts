import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

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
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

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
  const initials = String(value || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
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
  // Rate limit by IP only — including site_id/mode in the key allowed bucket multiplication
  // by rotating arbitrary site_id values, effectively removing the per-IP limit.
  if (!checkRateLimit(ip)) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any;
  if (!workers || workers.length === 0) {
    // 신규교육 게스트: DB에 없는 근로자 최소 레코드 생성
    const guestCode = `QR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const { data: guestWorker, error: guestErr } = await service
      .from("nfc_workers")
      .insert({
        worker_code: guestCode,
        full_name: initials,
        name_initials: initials,
        phone_last4: phoneLast4,
        assigned_site_id: site.id,
        nationality,
        preferred_lang: preferredLang,
        is_active: true,
      })
      .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id, is_active")
      .single();

    if (guestErr) {
      // ADV-010: 동시 요청이 동일 initials+phone_last4+site_id 게스트를 먼저 생성한 경우 (23505 unique 충돌).
      // 유니크 제약이 있다면 충돌 → 기존 레코드로 폴백. 없다면 단순 실패 처리.
      if (guestErr.code === "23505") {
        const { data: racedWorker } = await service
          .from("nfc_workers")
          .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id, is_active")
          .eq("assigned_site_id", site.id)
          .eq("name_initials", initials)
          .eq("phone_last4", phoneLast4)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!racedWorker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
        worker = racedWorker;
      } else {
        return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
      }
    } else if (!guestWorker) {
      return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
    } else {
      worker = guestWorker;
    }
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
    await service.from("nfc_worker_daily_access").update({ last_seen_at: nowIso }).eq("id", dailyAccess.id);
    accessAction = "already_checked_in";
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

  // 게스트 워커(QR-)는 auth.users 계정 생성 금지 — 사전 등록된 근로자만 세션 발급
  const isGuestWorker = String(updatedWorker.worker_code ?? "").startsWith("QR-");
  let authUserId: string | null = isGuestWorker ? null : (updatedWorker.auth_user_id ?? null);
  const email = nfcEmail(worker.id);
  let generatedTokenHash: string | null = null;

  if (!authUserId && !isGuestWorker) {
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nfc_worker_id: worker.id },
    });

    if (!authErr && authData?.user) {
      authUserId = authData.user.id;
    } else {
      const { data: linkData } = await service.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { data: { nfc_worker_id: worker.id } },
      });
      authUserId = linkData?.user?.id ?? null;
      generatedTokenHash = linkData?.properties?.hashed_token ?? null;
    }
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

  const tokenHash = generatedTokenHash ?? (
    await service.auth.admin.generateLink({ type: "magiclink", email })
  ).data?.properties?.hashed_token ?? null;

  if (!tokenHash) return NextResponse.json(basePayload);

  const serverClient = await createServerClient();
  const { error: otpErr } = await serverClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpErr) return NextResponse.json(basePayload);

  return NextResponse.json({ ...basePayload, session_established: true });
}

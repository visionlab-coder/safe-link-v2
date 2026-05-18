import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
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

type VerifyBody = {
  token?: string;
  mode?: "info" | "enter";
  nationality?: unknown;
  preferred_lang?: unknown;
};

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function cleanCountry(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

function cleanLang(value: unknown, country: string): string {
  const lang = String(value || COUNTRY_TO_LANG[country] || "en").trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(lang) ? lang : "en";
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

function verifyToken(token: string): { workerId: string; siteRef: string; expiresAt: number } | null {
  const secret = (process.env.NFC_HMAC_SECRET ?? "").trim();
  if (!secret) return null;

  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split("|");
    if (parts.length !== 4) return null;

    const [workerId, siteRef, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!workerId || !siteRef || !Number.isFinite(expiresAt)) return null;
    if (Date.now() / 1000 > expiresAt) return null;

    const payload = `${workerId}|${siteRef}|${expiresAt}`;
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    return { workerId, siteRef, expiresAt };
  } catch {
    return null;
  }
}

async function resolveSiteByRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>,
  siteRef: string
) {
  const ref = String(siteRef || "").trim();
  if (!ref) return null;

  if (UUID_PATTERN.test(ref)) {
    const { data } = await service
      .from("sites")
      .select(SITE_SELECT)
      .eq("id", ref)
      .maybeSingle();
    if (data) return data;
  }

  const upperRef = ref.toUpperCase();
  const { data: byCode } = await service
    .from("sites")
    .select(SITE_SELECT)
    .eq("code", upperRef)
    .maybeSingle();
  if (byCode) return byCode;

  const { data: bySiteCode } = await service
    .from("sites")
    .select(SITE_SELECT)
    .eq("site_code", upperRef)
    .maybeSingle();
  if (bySiteCode) return bySiteCode;

  const safeRef = ref.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const { data: byName } = await service
    .from("sites")
    .select(SITE_SELECT)
    .ilike("name", safeRef)
    .limit(1)
    .maybeSingle();
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
  const { service, workerId, siteId, preferredLang } = args;
  const { data: session } = await service
    .from("nfc_tbm_sessions")
    .select("id, title, status, started_at")
    .eq("site_id", siteId)
    .in("status", ["open", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { action: "no_active_session" as const, session: null };
  }

  const { data: existing } = await service
    .from("nfc_tbm_attendance")
    .select("id, is_certified")
    .eq("session_id", session.id)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing?.is_certified) {
    return { action: "already_certified" as const, session };
  }

  const now = new Date().toISOString();

  if (existing) {
    await service
      .from("nfc_tbm_attendance")
      .update({ certified_at: now, is_certified: true })
      .eq("id", existing.id);
    return { action: "certified" as const, session };
  }

  await service.from("nfc_tbm_attendance").insert({
    session_id: session.id,
    worker_id: workerId,
    tapped_at: now,
    lang_used: preferredLang,
    is_certified: false,
    entry_method: "qr",
  });

  return { action: "checked_in" as const, session };
}

export async function POST(req: NextRequest) {
  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });

  const verified = verifyToken(token);
  if (!verified) {
    return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
  }

  const service = createService();
  const site = await resolveSiteByRef(service, verified.siteRef);
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });

  const { data: worker } = await service
    .from("nfc_workers")
    .select("id, worker_code, full_name, preferred_lang, nationality, nationality_confirmed_at, auth_user_id, assigned_site_id, is_active")
    .eq("id", verified.workerId)
    .maybeSingle();

  if (!worker || !worker.is_active) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });

  const assignedSite = worker.assigned_site_id
    ? await resolveSiteByRef(service, String(worker.assigned_site_id))
    : null;

  if (assignedSite && String(assignedSite.id) !== String(site.id)) {
    return NextResponse.json({ error: "worker_site_mismatch" }, { status: 403 });
  }

  // assigned_site_id는 최초 1회만 설정 — 이미 다른 현장에 배정된 경우 덮어쓰기 금지
  if (!worker.assigned_site_id) {
    await service
      .from("nfc_workers")
      .update({ assigned_site_id: site.id, updated_at: new Date().toISOString() })
      .eq("id", worker.id);
  }

  if (body.mode === "info") {
    return NextResponse.json({
      ok: true,
      mode: "info",
      worker: {
        id: worker.id,
        full_name: worker.full_name,
        worker_code: worker.worker_code,
        nationality: worker.nationality,
        preferred_lang: worker.preferred_lang,
        nationality_confirmed: Boolean(worker.nationality_confirmed_at),
      },
      site: {
        id: site.id,
        name: site.name,
        code: site.site_code ?? site.code ?? null,
      },
    });
  }

  const nationality = cleanCountry(body.nationality);
  if (!nationality) return NextResponse.json({ error: "nationality_invalid" }, { status: 400 });
  const preferredLang = cleanLang(body.preferred_lang, nationality);

  if (!(await isSiteAccessEnabled(service, String(site.id)))) {
    return NextResponse.json({ error: "site_access_disabled" }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data: updatedWorker, error: updateErr } = await service
    .from("nfc_workers")
    .update({
      nationality,
      preferred_lang: preferredLang,
      nationality_confirmed_at: nowIso,
      assigned_site_id: site.id,
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
    .select("id, status, checked_in_at, checked_out_at")
    .eq("worker_id", worker.id)
    .eq("work_date", workDate)
    .maybeSingle();

  let accessAction: "checked_in" | "already_checked_in" | "checked_out";
  let accessActive = true;

  if (dailyAccess?.status === "checked_out") {
    accessAction = "checked_out";
    accessActive = false;
  } else if (dailyAccess?.status === "active") {
    await service
      .from("nfc_worker_daily_access")
      .update({ last_seen_at: nowIso })
      .eq("id", dailyAccess.id);
    accessAction = "already_checked_in";
  } else {
    const { error: checkinErr } = await service
      .from("nfc_worker_daily_access")
      .insert({
        worker_id: worker.id,
        site_id: site.id,
        work_date: workDate,
        status: "active",
        checked_in_at: nowIso,
        last_seen_at: nowIso,
        checkin_location: { source: "worker_qr" },
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

  if (!authUserId) {
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
    site: {
      id: site.id,
      name: site.name,
      code: site.site_code ?? site.code ?? null,
    },
    access: {
      action: accessAction,
      active: accessActive,
      work_date: workDate,
      site_id: site.id,
    },
    qr_action: tbm.action,
    session: tbm.session ? { id: tbm.session.id, title: tbm.session.title } : null,
  };

  if (!authUserId || !accessActive) {
    return NextResponse.json(basePayload);
  }

  const tokenHash = generatedTokenHash ?? (
    await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    })
  ).data?.properties?.hashed_token ?? null;

  if (!tokenHash) {
    return NextResponse.json(basePayload);
  }

  const serverClient = await createServerClient();
  const { error: otpErr } = await serverClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpErr) {
    return NextResponse.json(basePayload);
  }

  return NextResponse.json({ ...basePayload, session_established: true });
}

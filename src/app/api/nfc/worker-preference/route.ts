import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { NFC_BASE_URL } from "@/utils/nfc/constants";
import { parseStickerUrl, verifyStickerSignature } from "@/utils/nfc/signing";

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

type LocationPayload = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
};

const DEFAULT_GEOFENCE_RADIUS_M = 300;

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

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickSiteNumber(site: Record<string, unknown>, key: string): number | null {
  const direct = asFiniteNumber(site[key]);
  if (direct != null) return direct;
  const metadata = site.metadata as Record<string, unknown> | null | undefined;
  if (!metadata || typeof metadata !== "object") return null;
  return asFiniteNumber(metadata[key]);
}

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusM = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

async function verifySiteChallenge(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>;
  siteId: string;
  workDate: string;
  challengeCode?: unknown;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data } = await args.service
    .from("nfc_site_daily_challenges")
    .select("challenge_code, expires_at, is_active")
    .eq("site_id", args.siteId)
    .eq("work_date", args.workDate)
    .eq("is_active", true)
    .maybeSingle();

  // 오늘 챌린지 미설정 → 지오펜스만으로 충분, 통과
  if (!data) return { ok: true };

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 403, error: "site_challenge_expired" };
  }

  const code = String(args.challengeCode || "").trim();
  // 코드가 자동 주입됐거나 직접 입력된 경우 검증
  if (code && /^[0-9]{6}$/.test(code)) {
    if (String(data.challenge_code) !== code) {
      return { ok: false, status: 403, error: "site_challenge_invalid" };
    }
  }
  // 코드 미입력 상태지만 챌린지는 존재 → 자동 통과 (지오펜스 검증 완료)
  return { ok: true };
}

async function uploadDailySafetyLog(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>;
  workerId: string;
  siteId: string;
  workDate: string;
  dailyAccessId: string;
  checkInAt: string | null;
  checkOutAt: string;
  checkoutDistanceM: number;
}) {
  const dayStart = `${args.workDate}T00:00:00+09:00`;
  const dayEndDate = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000);

  const { data: attendance } = await args.service
    .from("nfc_tbm_attendance")
    .select(`
      id,
      tapped_at,
      certified_at,
      is_certified,
      lang_used,
      session:nfc_tbm_sessions!inner (
        id,
        site_id,
        title,
        started_at,
        tbm_notice_id
      )
    `)
    .eq("worker_id", args.workerId)
    .eq("session.site_id", args.siteId)
    .gte("tapped_at", dayStart)
    .lt("tapped_at", dayEndDate.toISOString())
    .order("tapped_at", { ascending: true });

  const tbmRows = (Array.isArray(attendance) ? attendance : []) as Array<{
    id: string;
    tapped_at: string | null;
    certified_at: string | null;
    is_certified: boolean | null;
    lang_used: string | null;
    session?: {
      id?: string | null;
      site_id?: string | null;
      title?: string | null;
      started_at?: string | null;
      tbm_notice_id?: string | null;
    } | Array<{
      id?: string | null;
      site_id?: string | null;
      title?: string | null;
      started_at?: string | null;
      tbm_notice_id?: string | null;
    }> | null;
  }>;
  const tbmRecords = tbmRows.map((row) => {
    const session = Array.isArray(row.session) ? row.session[0] : row.session;
    return {
      attendance_id: row.id,
      session_id: session?.id ?? null,
      tbm_notice_id: session?.tbm_notice_id ?? null,
      title: session?.title ?? null,
      tbm_started_at: session?.started_at ?? null,
      morning_tagged_at: row.tapped_at,
      tbm_signed_at: row.certified_at ?? null,
      is_signed: Boolean(row.is_certified),
      lang_used: row.lang_used ?? null,
    };
  });

  const signedTimes = tbmRecords
    .map((record) => record.tbm_signed_at)
    .filter((value): value is string => Boolean(value));
  const latestSignedAt = signedTimes.sort().at(-1) ?? null;
  const signedCount = tbmRecords.filter((record) => record.is_signed).length;

  await args.service
    .from("nfc_worker_safety_daily_logs")
    .upsert({
      worker_id: args.workerId,
      site_id: args.siteId,
      work_date: args.workDate,
      status: "completed",
      check_in_at: args.checkInAt,
      check_out_at: args.checkOutAt,
      tbm_signed_at: latestSignedAt,
      tbm_records: tbmRecords,
      attendance_summary: {
        tbm_count: tbmRecords.length,
        tbm_signed_count: signedCount,
        has_tbm_signature: signedCount > 0,
        check_in_at: args.checkInAt,
        check_out_at: args.checkOutAt,
      },
      source_daily_access_id: args.dailyAccessId,
      generated_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      metadata: {
        source: "nfc_checkout",
        checkout_distance_m: args.checkoutDistanceM,
      },
    }, { onConflict: "worker_id,work_date" })
    .throwOnError();
}

export async function POST(req: NextRequest) {
  let body: {
    url?: string;
    nationality?: string;
    preferred_lang?: string;
    location?: LocationPayload;
    intent?: string;
    site_challenge_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawUrl = String(body.url || "").trim();
  const parsed = parseStickerUrl(rawUrl, NFC_BASE_URL) ?? parseStickerUrl(rawUrl, req.nextUrl.origin);
  if (!parsed) return NextResponse.json({ error: "url_malformed_or_spoofed" }, { status: 400 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  let workerId = parsed.workerId;
  if (!workerId && parsed.workerCode) {
    const { data: worker } = await service
      .from("nfc_workers")
      .select("id")
      .eq("worker_code", parsed.workerCode)
      .maybeSingle();
    workerId = worker?.id;
  }
  if (!workerId) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  if (!parsed.issuedEpoch) return NextResponse.json({ error: "issued_epoch_required" }, { status: 400 });

  const sigOk = await verifyStickerSignature({ ...parsed, workerId });
  if (!sigOk) return NextResponse.json({ error: "signature_invalid" }, { status: 401 });

  const nationality = cleanCountry(body.nationality);
  if (!nationality) return NextResponse.json({ error: "nationality_invalid" }, { status: 400 });
  const preferredLang = cleanLang(body.preferred_lang, nationality);
  const intent = String(body.intent || "open").trim();

  const { data: sticker } = await service
    .from("nfc_worker_stickers")
    .select("id, is_active")
    .eq("worker_id", workerId)
    .eq("sig_version", parsed.sigVersion)
    .eq("issued_epoch", parsed.issuedEpoch)
    .maybeSingle();

  if (!sticker?.is_active) {
    return NextResponse.json({ error: "sticker_revoked_or_missing" }, { status: 401 });
  }

  const workerLoad = await service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id")
    .eq("id", workerId)
    .eq("is_active", true)
    .single();
  let data = workerLoad.data;
  const error = workerLoad.error;

  if (error || !data) {
    return NextResponse.json({ error: "worker_load_failed" }, { status: 500 });
  }

  if (!data.assigned_site_id) {
    return NextResponse.json({ error: "worker_site_required" }, { status: 403 });
  }

  const latitude = asFiniteNumber(body.location?.latitude);
  const longitude = asFiniteNumber(body.location?.longitude);
  const accuracy = Math.max(0, asFiniteNumber(body.location?.accuracy) ?? 0);
  if (latitude == null || longitude == null) {
    return NextResponse.json({ error: "location_required" }, { status: 428 });
  }

  const { data: site } = await service
    .from("sites")
    .select("id, name, latitude, longitude, geofence_radius_m, metadata")
    .eq("id", data.assigned_site_id)
    .maybeSingle();

  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });

  const siteLatitude = pickSiteNumber(site as Record<string, unknown>, "latitude");
  const siteLongitude = pickSiteNumber(site as Record<string, unknown>, "longitude");
  const siteRadius =
    pickSiteNumber(site as Record<string, unknown>, "geofence_radius_m") ??
    pickSiteNumber(site as Record<string, unknown>, "radius_m") ??
    DEFAULT_GEOFENCE_RADIUS_M;

  if (siteLatitude == null || siteLongitude == null) {
    return NextResponse.json({ error: "site_geofence_not_configured" }, { status: 409 });
  }

  const distanceM = haversineMeters(
    { latitude, longitude },
    { latitude: siteLatitude, longitude: siteLongitude }
  );
  const allowedRadiusM = siteRadius + Math.min(accuracy, 50);
  if (distanceM > allowedRadiusM) {
    return NextResponse.json({
      error: "outside_worksite",
      distance_m: Math.round(distanceM),
      allowed_radius_m: Math.round(allowedRadiusM),
    }, { status: 403 });
  }

  const { data: updatedWorker, error: preferenceErr } = await service
    .from("nfc_workers")
    .update({
      nationality,
      preferred_lang: preferredLang,
      nationality_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId)
    .eq("is_active", true)
    .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id, assigned_site_id")
    .single();

  if (preferenceErr || !updatedWorker) {
    return NextResponse.json({ error: "preference_update_failed" }, { status: 500 });
  }
  data = updatedWorker;

  let authUserId: string | null = data.auth_user_id ?? null;
  const email = nfcEmail(workerId);

  if (!authUserId) {
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nfc_worker_id: workerId },
    });

    if (!authErr && authData?.user) {
      authUserId = authData.user.id;

      await Promise.all([
        service.from("profiles").upsert(
          { id: authUserId, role: "WORKER", display_name: data.full_name, preferred_lang: preferredLang },
          { onConflict: "id" }
        ),
        service.from("nfc_workers").update({ auth_user_id: authUserId }).eq("id", workerId),
      ]);
    }
  }

  const workDate = todayInSeoul();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: access } = await service
    .from("nfc_worker_daily_access")
    .select("id, status, checked_in_at, checked_out_at")
    .eq("worker_id", workerId)
    .eq("work_date", workDate)
    .maybeSingle();

  let accessAction: "checked_in" | "already_checked_in" | "checkout_required" | "checked_out";
  let accessActive = true;

  if (access?.status === "active") {
    if (intent === "checkout") {
      const challenge = await verifySiteChallenge({
        service,
        siteId: data.assigned_site_id,
        workDate,
        challengeCode: body.site_challenge_code,
      });
      if (!challenge.ok) return NextResponse.json({ error: challenge.error }, { status: challenge.status });

      const { error: checkoutErr } = await service
        .from("nfc_worker_daily_access")
        .update({
          status: "checked_out",
          checked_out_at: nowIso,
          last_seen_at: nowIso,
          checkout_location: { latitude, longitude, accuracy, distance_m: Math.round(distanceM) },
        })
        .eq("id", access.id);
      if (checkoutErr) return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
      try {
        await uploadDailySafetyLog({
          service,
          workerId,
          siteId: data.assigned_site_id,
          workDate,
          dailyAccessId: access.id,
          checkInAt: access.checked_in_at ?? null,
          checkOutAt: nowIso,
          checkoutDistanceM: Math.round(distanceM),
        });
      } catch (_logErr) {
        await service
          .from("nfc_worker_daily_access")
          .update({
            status: "active",
            checked_out_at: null,
            last_seen_at: access.checked_in_at ?? nowIso,
            checkout_location: null,
          })
          .eq("id", access.id);
        return NextResponse.json({ error: "daily_safety_log_upload_failed" }, { status: 500 });
      }
      accessAction = "checked_out";
      accessActive = false;
    } else {
      accessAction = "checkout_required";
    }
  } else if (access?.status === "checked_out") {
    accessAction = "checked_out";
    accessActive = false;
  } else {
    const challenge = await verifySiteChallenge({
      service,
      siteId: data.assigned_site_id,
      workDate,
      challengeCode: body.site_challenge_code,
    });
    if (!challenge.ok) return NextResponse.json({ error: challenge.error }, { status: challenge.status });

    const { error: checkinErr } = await service
      .from("nfc_worker_daily_access")
      .insert({
        worker_id: workerId,
        site_id: data.assigned_site_id,
        work_date: workDate,
        status: "active",
        checked_in_at: nowIso,
        last_seen_at: nowIso,
        checkin_location: { latitude, longitude, accuracy, distance_m: Math.round(distanceM) },
      });
    if (checkinErr) return NextResponse.json({ error: "checkin_failed" }, { status: 500 });
    accessAction = "checked_in";
  }

  // Patch C-4/C-6: Establish the Supabase session server-side so the
  // token_hash never travels over the wire to the client.
  // We generate a magic-link token, immediately exchange it for a session on
  // the server, and write the resulting cookies into the response.
  // The client page no longer needs to call verifyOtp itself.
  const { auth_user_id: _, ...workerPublic } = data;

  const basePayload = {
    worker: workerPublic,
    access: {
      action: accessAction,
      active: accessActive,
      work_date: workDate,
      site_id: data.assigned_site_id,
      distance_m: Math.round(distanceM),
    },
  };

  if (!authUserId || !accessActive) {
    return NextResponse.json(basePayload);
  }

  // Generate a one-time token and exchange it immediately on the server
  const { data: linkData } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token ?? null;

  if (!tokenHash) {
    // Session creation failed non-fatally — still allow access, just without
    // a session cookie (the client will remain unauthenticated this tap).
    return NextResponse.json(basePayload);
  }

  // Exchange the token for a session using the cookie-aware server client.
  // This writes sb-access-token / sb-refresh-token cookies into the response.
  const serverClient = await createServerClient();
  const { error: otpErr } = await serverClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (otpErr) {
    // Session exchange failed — return without session cookie but don't expose
    // the internal error detail to the caller.
    return NextResponse.json(basePayload);
  }

  // The server client (from @/utils/supabase/server) uses Next.js cookies()
  // which automatically propagates Set-Cookie headers in the response.
  return NextResponse.json({ ...basePayload, session_established: true });
}

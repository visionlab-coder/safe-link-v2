import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

function cleanCountry(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

function cleanLang(value: unknown, country: string): string {
  const lang = String(value || COUNTRY_TO_LANG[country] || "en").trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(lang) ? lang : "en";
}

/** NFC 매직링크 이메일 (실제 이메일 아님 — auth 전용 식별자) */
function nfcEmail(workerId: string): string {
  return `nfc.${workerId}@safe-link.internal`;
}

export async function POST(req: NextRequest) {
  let body: { url?: string; nationality?: string; preferred_lang?: string };
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

  const { data, error } = await service
    .from("nfc_workers")
    .update({
      nationality,
      preferred_lang: preferredLang,
      nationality_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId)
    .eq("is_active", true)
    .select("id, worker_code, full_name, nationality, preferred_lang, auth_user_id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "preference_update_failed", detail: error?.message }, { status: 500 });
  }

  // === Auth 계정 lazy 생성 + 매직링크 토큰 발급 ===
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
          { id: authUserId, role: "worker", display_name: data.full_name, preferred_lang: preferredLang },
          { onConflict: "id" }
        ),
        service.from("nfc_workers").update({ auth_user_id: authUserId }).eq("id", workerId),
      ]);
    }
  }

  let tokenHash: string | null = null;
  if (authUserId) {
    const { data: linkData } = await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    tokenHash = linkData?.properties?.hashed_token ?? null;
  }

  const { auth_user_id: _, ...workerPublic } = data;

  return NextResponse.json({
    worker: workerPublic,
    ...(tokenHash && { token_hash: tokenHash }),
  });
}

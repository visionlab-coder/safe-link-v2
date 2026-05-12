import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { NFC_BASE_URL } from "@/utils/nfc/constants";
import { parseStickerUrl, verifyStickerSignature } from "@/utils/nfc/signing";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id: sessionId } = await params;

  const { data: session, error: sessErr } = await ctx.service
    .from("nfc_tbm_sessions")
    .select("id, status, site_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr || !session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (session.status === "closed") return NextResponse.json({ error: "session_closed" }, { status: 409 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ error: "url_required" }, { status: 400 });

  const parsed = parseStickerUrl(rawUrl, NFC_BASE_URL) ?? parseStickerUrl(rawUrl, req.nextUrl.origin);
  if (!parsed) return NextResponse.json({ error: "url_malformed_or_spoofed" }, { status: 400 });

  let { workerId } = parsed;
  const { workerCode, sigVersion, issuedEpoch, sig, identityHint } = parsed;

  if (!workerId && workerCode) {
    const { data: resolvedWorker } = await ctx.service
      .from("nfc_workers")
      .select("id")
      .eq("worker_code", workerCode)
      .maybeSingle();
    workerId = resolvedWorker?.id;
  }
  if (!workerId) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  if (!issuedEpoch) return NextResponse.json({ error: "issued_epoch_required" }, { status: 400 });

  const sigOk = await verifyStickerSignature({ workerId, workerCode, sigVersion, issuedEpoch, sig, identityHint });
  if (!sigOk) return NextResponse.json({ error: "signature_invalid" }, { status: 401 });

  const { data: sticker } = await ctx.service
    .from("nfc_worker_stickers")
    .select("id, is_active")
    .eq("worker_id", workerId)
    .eq("sig_version", sigVersion)
    .eq("issued_epoch", issuedEpoch)
    .maybeSingle();

  if (!sticker || !sticker.is_active) {
    return NextResponse.json({ error: "sticker_revoked_or_missing" }, { status: 401 });
  }

  const { data: worker } = await ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, trade, preferred_lang, assigned_site_id, is_active")
    .eq("id", workerId)
    .maybeSingle();

  if (!worker || !worker.is_active) return NextResponse.json({ error: "worker_inactive" }, { status: 409 });

  const now = new Date().toISOString();

  const { data: existing } = await ctx.service
    .from("nfc_tbm_attendance")
    .select("id, tapped_at, certified_at, is_certified")
    .eq("session_id", sessionId)
    .eq("worker_id", workerId)
    .maybeSingle();

  const workerPayload = {
    id: worker.id,
    worker_code: worker.worker_code,
    full_name: worker.full_name,
    nationality: worker.nationality,
    trade: worker.trade,
  };

  if (existing?.is_certified) {
    return NextResponse.json({
      action: "already_certified",
      worker: workerPayload,
      tapped_at: existing.tapped_at,
      certified_at: existing.certified_at,
      timestamp: now,
    });
  }

  if (existing && !existing.is_certified) {
    const { error: updErr } = await ctx.service
      .from("nfc_tbm_attendance")
      .update({ certified_at: now, is_certified: true })
      .eq("id", existing.id);

    if (updErr) return NextResponse.json({ error: "certification_failed", detail: updErr.message }, { status: 500 });

    return NextResponse.json({
      action: "certified",
      worker: workerPayload,
      tapped_at: existing.tapped_at,
      certified_at: now,
      timestamp: now,
    });
  }

  const { error: insErr } = await ctx.service
    .from("nfc_tbm_attendance")
    .insert({
      session_id: sessionId,
      worker_id: workerId,
      sticker_id: sticker.id,
      tapped_at: now,
      tapped_by: ctx.user.id,
      lang_used: worker.preferred_lang,
      is_certified: false,
    });

  if (insErr) return NextResponse.json({ error: "attendance_insert_failed", detail: insErr.message }, { status: 500 });

  if (session.status === "open") {
    await ctx.service.from("nfc_tbm_sessions").update({ status: "running" }).eq("id", sessionId);
  }

  return NextResponse.json({
    action: "checked_in",
    worker: workerPayload,
    tapped_at: now,
    timestamp: now,
  });
}

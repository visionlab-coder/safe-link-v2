import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { parseStickerUrl, verifyStickerSignature } from "@/utils/nfc/signing";
import { NFC_BASE_URL } from "@/utils/nfc/constants";

/**
 * POST /api/nfc/tbm-session/[id]/tap
 *
 * 관리자 라이브 스캔 화면에서 근로자 NFC 스티커를 감지했을 때 호출.
 * 탭 1회 = TBM 참석 확인 (출퇴근 아님 — 홍채인식이 담당).
 * 같은 세션에 이미 탭한 근로자는 멱등 처리 (already_attended).
 *
 * Body:
 *   { url: string }  ← 스캔된 스티커 URL 전체
 *
 * Returns:
 *   { action: "attended" | "already_attended", worker, timestamp }
 */
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id: sessionId } = await params;

  // 1) 세션 조회
  const { data: session, error: sessErr } = await ctx.service
    .from("nfc_tbm_sessions")
    .select("id, status, site_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr || !session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (session.status === "closed") return NextResponse.json({ error: "session_closed" }, { status: 409 });

  // 2) Body 파싱
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ error: "url_required" }, { status: 400 });

  // 3) URL 파싱 (origin 검증)
  const parsed = parseStickerUrl(rawUrl, NFC_BASE_URL);
  if (!parsed) return NextResponse.json({ error: "url_malformed_or_spoofed" }, { status: 400 });

  const { workerId, sigVersion, issuedEpoch, sig } = parsed;

  // 4) HMAC 검증
  const sigOk = await verifyStickerSignature({ workerId, sigVersion, issuedEpoch, sig });
  if (!sigOk) return NextResponse.json({ error: "signature_invalid" }, { status: 401 });

  // 5) 스티커 활성 확인
  const { data: sticker } = await ctx.service
    .from("nfc_worker_stickers")
    .select("id, is_active")
    .eq("worker_id", workerId)
    .eq("sig_version", sigVersion)
    .eq("issued_epoch", issuedEpoch)
    .maybeSingle();

  if (!sticker || !sticker.is_active) return NextResponse.json({ error: "sticker_revoked_or_missing" }, { status: 401 });

  // 6) 근로자 활성 확인
  const { data: worker } = await ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, trade, preferred_lang, assigned_site_id, is_active")
    .eq("id", workerId)
    .maybeSingle();

  if (!worker || !worker.is_active) return NextResponse.json({ error: "worker_inactive" }, { status: 409 });

  // 7) 참석 기록 (UNIQUE 충돌 = 이미 참석)
  const now = new Date().toISOString();

  const { data: existing } = await ctx.service
    .from("nfc_tbm_attendance")
    .select("id, tapped_at")
    .eq("session_id", sessionId)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      action: "already_attended",
      worker: { id: worker.id, worker_code: worker.worker_code, full_name: worker.full_name, nationality: worker.nationality, trade: worker.trade },
      tapped_at: existing.tapped_at,
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
    });

  if (insErr) return NextResponse.json({ error: "attendance_insert_failed", detail: insErr.message }, { status: 500 });

  // 8) 세션이 open이면 running으로 전이 (첫 탭 감지)
  if (session.status === "open") {
    await ctx.service.from("nfc_tbm_sessions").update({ status: "running" }).eq("id", sessionId);
  }

  return NextResponse.json({
    action: "attended",
    worker: { id: worker.id, worker_code: worker.worker_code, full_name: worker.full_name, nationality: worker.nationality, trade: worker.trade },
    tapped_at: now,
    timestamp: now,
  });
}

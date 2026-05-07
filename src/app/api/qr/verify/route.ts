import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const runtime = "nodejs";

// 청구항 23: QR 토큰 검증 + 진행 중 TBM 세션 자동 매칭 + 참석 처리
// POST /api/qr/verify
// body: { token }

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function verifyToken(token: string): { workerId: string; siteId: string; expiresAt: number } | null {
  const secret = (process.env.NFC_HMAC_SECRET ?? "").trim();
  if (!secret) return null;

  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split("|");
    if (parts.length !== 4) return null;

    const [workerId, siteId, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() / 1000 > expiresAt) return null;

    const payload = `${workerId}|${siteId}|${expiresAt}`;
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
    if (sig !== expectedSig) return null;

    return { workerId, siteId, expiresAt };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { token?: string };
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

  const { workerId, siteId } = verified;
  const service = createService();

  // 근로자 정보 조회
  const { data: worker } = await service
    .from("nfc_workers")
    .select("id, worker_code, full_name, preferred_lang, nationality")
    .eq("id", workerId)
    .maybeSingle();

  if (!worker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });

  // 진행 중인 TBM 세션 자동 매칭
  const { data: session } = await service
    .from("nfc_tbm_sessions")
    .select("id, title, status, started_at")
    .eq("site_id", siteId)
    .in("status", ["open", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({
      ok: true,
      action: "no_active_session",
      worker: { id: worker.id, full_name: worker.full_name, worker_code: worker.worker_code },
      siteId,
    });
  }

  // 기존 참석 기록 확인
  const { data: existing } = await service
    .from("nfc_tbm_attendance")
    .select("id, is_certified, certified_at")
    .eq("session_id", session.id)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing?.is_certified) {
    return NextResponse.json({
      ok: true,
      action: "already_certified",
      session: { id: session.id, title: session.title },
      worker: { id: worker.id, full_name: worker.full_name, worker_code: worker.worker_code },
    });
  }

  const now = new Date().toISOString();

  if (existing && !existing.is_certified) {
    // 2차 탭: 이수 인증
    await service
      .from("nfc_tbm_attendance")
      .update({ certified_at: now, is_certified: true })
      .eq("id", existing.id);

    return NextResponse.json({
      ok: true,
      action: "certified",
      session: { id: session.id, title: session.title },
      worker: { id: worker.id, full_name: worker.full_name, worker_code: worker.worker_code, nationality: worker.nationality },
    });
  }

  // 1차 탭: 참석 대기 등록
  await service.from("nfc_tbm_attendance").insert({
    session_id: session.id,
    worker_id: workerId,
    tapped_at: now,
    lang_used: worker.preferred_lang ?? "ko",
    is_certified: false,
    entry_method: "qr",
  });

  return NextResponse.json({
    ok: true,
    action: "checked_in",
    session: { id: session.id, title: session.title },
    worker: { id: worker.id, full_name: worker.full_name, worker_code: worker.worker_code, nationality: worker.nationality },
  });
}

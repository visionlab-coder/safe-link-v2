import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";
import { createHmac, randomBytes } from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 청구항 23: 근로자별 단기 유효 QR 토큰 생성
// GET /api/nfc/workers/[id]/qr-token?siteId=xxx&ttlMinutes=30
// 토큰 형식: base64url(workerId|siteId|expiresAt|nonce|hmac)
// C-7: nonce 추가 → enter 모드에서 한 번만 사용 가능 (replay 방지)

const QR_TOKEN_VALIDITY_MINUTES = 30;

function createService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function buildToken(workerId: string, siteId: string, expiresAt: number, nonce: string): string {
  const secret = (process.env.NFC_HMAC_SECRET ?? "").trim();
  if (!secret) throw new Error("NFC_HMAC_SECRET not configured");

  const payload = `${workerId}|${siteId}|${expiresAt}|${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const tokenRaw = `${payload}|${sig}`;
  return Buffer.from(tokenRaw).toString("base64url");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id: workerId } = await params;
  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  const parsedTtl = parseInt(req.nextUrl.searchParams.get("ttlMinutes") ?? "", 10);
  const ttlMinutes = Math.min(isNaN(parsedTtl) ? QR_TOKEN_VALIDITY_MINUTES : parsedTtl, 120);

  if (!siteId) return NextResponse.json({ error: "siteId_required" }, { status: 400 });

  const { data: worker } = await guard.ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, preferred_lang, assigned_site_id")
    .eq("id", workerId)
    .maybeSingle();

  if (!worker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });

  // siteId가 근로자의 배정 현장과 일치하는지 검증 (글로벌 관리자는 예외)
  if (siteId !== worker.assigned_site_id) {
    return NextResponse.json({ error: "site_mismatch" }, { status: 403 });
  }
  const denied = requireSameSite(guard.ctx.user, siteId);
  if (denied) return denied;

  let token: string;
  let expiresAt: number;
  try {
    expiresAt = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    const nonce = randomBytes(8).toString("hex");
    token = buildToken(workerId, siteId, expiresAt, nonce);

    // C-7: nonce를 DB에 저장 — verify 시 소각(one-time use)
    // INSERT 실패 시 토큰 발급 중단 (nonce 없는 토큰 발급 시 verify에서 TOKEN_ALREADY_USED 오류)
    const service = createService();
    const { error: nonceErr } = await service.from("qr_token_nonces").insert({
      nonce,
      worker_id: workerId,
      site_id: siteId,
      expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    if (nonceErr) throw new Error(`nonce_insert_failed: ${nonceErr.message}`);
  } catch (err) {
    return NextResponse.json({ error: "token_generation_failed", detail: String(err) }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const qrUrl = `${origin}/qr/${token}`;

  return NextResponse.json({
    token,
    qrUrl,
    workerId,
    siteId,
    expiresInMinutes: ttlMinutes,
    worker: { id: worker.id, worker_code: worker.worker_code, full_name: worker.full_name },
  });
}

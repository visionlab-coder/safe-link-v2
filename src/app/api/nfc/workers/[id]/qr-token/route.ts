import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { createHmac } from "crypto";

export const runtime = "nodejs";

// 청구항 23: 근로자별 단기 유효 QR 토큰 생성
// GET /api/nfc/workers/[id]/qr-token?siteId=xxx&ttlMinutes=30
// 토큰 형식: base64url(workerId|siteId|expiresAt|hmac)

const QR_TOKEN_VALIDITY_MINUTES = 30;

function buildToken(workerId: string, siteId: string, expiresAt: number): string {
  const secret = (process.env.NFC_HMAC_SECRET ?? "").trim();
  if (!secret) throw new Error("NFC_HMAC_SECRET not configured");

  const payload = `${workerId}|${siteId}|${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
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
  const ttlMinutes = Math.min(
    parseInt(req.nextUrl.searchParams.get("ttlMinutes") ?? String(QR_TOKEN_VALIDITY_MINUTES), 10),
    120
  );

  if (!siteId) return NextResponse.json({ error: "siteId_required" }, { status: 400 });

  const { data: worker } = await guard.ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, preferred_lang")
    .eq("id", workerId)
    .maybeSingle();

  if (!worker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });

  let token: string;
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    token = buildToken(workerId, siteId, expiresAt);
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

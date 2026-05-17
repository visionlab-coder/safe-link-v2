import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 12: 퀴즈 고득점 근로자 → 안전장비 지급 기록
// POST /api/incentive/grant
// body: { workerId, quizSessionId?, scorePct?, equipmentType, siteId, note? }
// GET  /api/incentive/grant?quizSessionId=xxx OR ?siteId=xxx

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: {
    workerId?: string;
    quizSessionId?: string;
    scorePct?: number;
    equipmentType?: string;
    siteId?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const workerId = String(body.workerId ?? "").trim();
  const equipmentType = String(body.equipmentType ?? "").trim();
  if (!workerId || !equipmentType) {
    return NextResponse.json({ error: "workerId_equipmentType_required" }, { status: 400 });
  }

  // 비전역 관리자는 자신의 현장에만 지급 가능
  const siteBlock = requireSameSite(guard.ctx.user, body.siteId ?? null);
  if (siteBlock) return siteBlock;

  const quizSessionId = body.quizSessionId ?? null;
  let dupQuery = guard.ctx.service
    .from("safety_equipment_grants")
    .select("id")
    .eq("worker_id", workerId)
    .eq("equipment_type", equipmentType);
  if (quizSessionId !== null) {
    dupQuery = dupQuery.eq("quiz_session_id", quizSessionId);
  } else {
    dupQuery = dupQuery.is("quiz_session_id", null);
  }
  const { data: existing } = await dupQuery.maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "ALREADY_GRANTED", grantId: existing.id }, { status: 409 });
  }

  const { data, error } = await guard.ctx.service
    .from("safety_equipment_grants")
    .insert({
      worker_id: workerId,
      site_id: body.siteId ?? null,
      quiz_session_id: quizSessionId,
      score_pct: body.scorePct ?? null,
      equipment_type: equipmentType,
      granted_by: guard.ctx.user.id,
      note: body.note ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "grant_insert_failed" }, { status: 500 });
  return NextResponse.json({ grantId: data.id, ok: true });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const quizSessionId = req.nextUrl.searchParams.get("quizSessionId");
  const siteId = req.nextUrl.searchParams.get("siteId");

  let query = guard.ctx.service
    .from("safety_equipment_grants")
    .select("id, worker_id, quiz_session_id, score_pct, equipment_type, granted_at, note, nfc_workers(full_name, worker_code)")
    .order("granted_at", { ascending: false })
    .limit(100);

  if (quizSessionId) query = query.eq("quiz_session_id", quizSessionId);
  if (siteId) query = query.eq("site_id", siteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json({ grants: data ?? [] });
}

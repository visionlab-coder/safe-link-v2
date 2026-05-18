import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

type IncentiveBody = {
  workerId?: string;
  siteId?: string;
  quizSessionId?: string;
  scorePct?: number;
  equipmentType?: string;
};

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { service, user } = guard.ctx;

  let body: IncentiveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const workerId = String(body.workerId || "").trim();
  const siteId = String(body.siteId || "").trim();
  const scorePct = Number(body.scorePct);
  const equipmentType = String(body.equipmentType || "general").trim() || "general";

  if (!workerId || !siteId || !Number.isInteger(scorePct) || scorePct < 0 || scorePct > 100) {
    return NextResponse.json({ error: "workerId_siteId_scorePct_required" }, { status: 400 });
  }

  if (scorePct < 80) {
    return NextResponse.json({ granted: false });
  }

  const { data, error } = await service
    .from("safety_equipment_grants")
    .insert({
      worker_id: workerId,
      site_id: siteId,
      quiz_session_id: body.quizSessionId ?? null,
      score_pct: scorePct,
      equipment_type: equipmentType,
      granted_by: user.id,
    })
    .select("id, equipment_type, score_pct")
    .single();

  if (error) return NextResponse.json({ error: "grant_insert_failed" }, { status: 500 });

  return NextResponse.json({ granted: true, grant: data });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId_required" }, { status: 400 });

  const { data, error } = await guard.ctx.service
    .from("safety_equipment_grants")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "grant_query_failed" }, { status: 500 });
  return NextResponse.json({ grants: data ?? [] });
}

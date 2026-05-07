import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const tbmSessionId = req.nextUrl.searchParams.get("tbmSessionId");
  if (!tbmSessionId) return NextResponse.json({ error: "tbmSessionId_required" }, { status: 400 });

  const { service } = guard.ctx;
  const [sessionResult, attendanceResult, pledgeResult] = await Promise.all([
    service.from("nfc_tbm_sessions").select("id, site_id, title, status, started_at").eq("id", tbmSessionId).maybeSingle(),
    service.from("nfc_tbm_attendance").select("worker_id, is_certified, certified_at").eq("session_id", tbmSessionId),
    service
      .from("claim13_pledges")
      .select("id, worker_id, site_id, pledge_content_hash, nfc_uid, approved_at, hash_chain_event_id, created_at")
      .eq("tbm_session_id", tbmSessionId)
      .order("created_at", { ascending: true }),
  ]);

  if (sessionResult.error || !sessionResult.data) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (attendanceResult.error) return NextResponse.json({ error: "attendance_query_failed", detail: attendanceResult.error.message }, { status: 500 });
  if (pledgeResult.error) return NextResponse.json({ error: "pledge_query_failed", detail: pledgeResult.error.message }, { status: 500 });

  const pledges = pledgeResult.data ?? [];
  const signedCount = pledges.filter((pledge) => Boolean(pledge.approved_at)).length;
  const expectedWorkerIds = new Set((attendanceResult.data ?? []).map((row) => String(row.worker_id)));
  const unsignedCount = Math.max(expectedWorkerIds.size - signedCount, 0);

  return NextResponse.json({
    session: sessionResult.data,
    signedCount,
    unsignedCount,
    pledges,
  });
}

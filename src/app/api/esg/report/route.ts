import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";
import { buildLegalReportEnvelope, recordReportExport } from "@/utils/reports/integrity";

export const runtime = "nodejs";

function rate(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number((part / total).toFixed(4));
}

function requireDate(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { service } = guard.ctx;

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId_required" }, { status: 400 });

  const denied = requireSameSite(guard.ctx.user, siteId);
  if (denied) return denied;

  const from = requireDate(req.nextUrl.searchParams.get("from"), "1970-01-01");
  const to = requireDate(req.nextUrl.searchParams.get("to"), new Date().toISOString().slice(0, 10));
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const [
    sessionsResult,
    grantsResult,
    stopWorkResult,
    pledgesResult,
    auditResult,
    liveTranslationsResult,
  ] = await Promise.all([
    service
      .from("nfc_tbm_sessions")
      .select("id", { count: "exact" })
      .eq("site_id", siteId)
      .gte("started_at", fromIso)
      .lte("started_at", toIso),
    service
      .from("safety_equipment_grants")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    service
      .from("claim17_stop_work_interventions")
      .select("id, status", { count: "exact" })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    service
      .from("claim13_pledges")
      .select("id, approved_at", { count: "exact" })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    service
      .from("claim13_hash_chain_events")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    service
      .from("live_translations")
      .select("session_id")
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
  ]);

  if (sessionsResult.error) return NextResponse.json({ error: "sessions_query_failed" }, { status: 500 });

  const sessionIds = (sessionsResult.data ?? []).map((session) => session.id);
  const attendanceResult = sessionIds.length
    ? await service
        .from("nfc_tbm_attendance")
        .select("id, is_certified")
        .in("session_id", sessionIds)
    : { data: [], error: null };

  if (attendanceResult.error) return NextResponse.json({ error: "attendance_query_failed" }, { status: 500 });
  if (grantsResult.error) return NextResponse.json({ error: "grants_query_failed" }, { status: 500 });
  if (stopWorkResult.error) return NextResponse.json({ error: "stop_work_query_failed" }, { status: 500 });
  if (pledgesResult.error) return NextResponse.json({ error: "pledges_query_failed" }, { status: 500 });
  if (auditResult.error) return NextResponse.json({ error: "audit_query_failed" }, { status: 500 });

  const attendance = attendanceResult.data ?? [];
  const certifiedCount = attendance.filter((row) => row.is_certified).length;
  const stopWorkRows = stopWorkResult.data ?? [];
  const pledgeRows = pledgesResult.data ?? [];
  const signedCount = pledgeRows.filter((row) => Boolean(row.approved_at)).length;
  const liveSessionCount = liveTranslationsResult.error
    ? null
    : new Set((liveTranslationsResult.data ?? []).map((row) => String(row.session_id))).size;

  const payload = {
    siteId,
    period: { from, to },
    tbm: {
      totalSessions: sessionsResult.count ?? sessionIds.length,
      totalAttendance: attendance.length,
      certificationRate: rate(certifiedCount, attendance.length),
    },
    quiz: { avgScore: null },
    safetyEquipment: { totalGrants: grantsResult.count ?? 0 },
    stopWork: {
      totalIncidents: stopWorkResult.count ?? stopWorkRows.length,
      resolvedCount: stopWorkRows.filter((row) => row.status === "resolved").length,
    },
    pledges: {
      totalPledges: pledgesResult.count ?? pledgeRows.length,
      signedCount,
      signatureRate: rate(signedCount, pledgeRows.length),
    },
    auditChain: { totalEvents: auditResult.count ?? 0 },
    interpretation: { totalSessions: liveSessionCount },
    generatedAt: new Date().toISOString(),
  };

  const report = buildLegalReportEnvelope({
    reportType: "esg_safety_report",
    generatedBy: guard.ctx.user.id,
    scope: { siteId, from, to },
    sourceTables: [
      "nfc_tbm_sessions",
      "nfc_tbm_attendance",
      "claim13_pledges",
      "claim17_stop_work_interventions",
      "claim13_hash_chain_events",
      "safety_equipment_grants",
      "live_translations",
    ],
    payload,
  });

  await recordReportExport({ service, envelope: report });

  return NextResponse.json({ ...payload, report });
}

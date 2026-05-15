import { NextRequest, NextResponse } from "next/server";
import { isGlobalAdmin, requireAdmin } from "@/utils/nfc/require-admin";
import { buildLegalReportEnvelope, recordReportExport } from "@/utils/reports/integrity";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  let siteId = req.nextUrl.searchParams.get("site_id")?.trim() || null;
  if (!isGlobalAdmin(ctx.user.role)) {
    if (!ctx.user.site_id) {
      return NextResponse.json({ error: "profile_site_required" }, { status: 409 });
    }
    if (siteId && siteId !== ctx.user.site_id) {
      return NextResponse.json({ error: "cross_site_access_denied" }, { status: 403 });
    }
    siteId = ctx.user.site_id;
  }

  const workDate = req.nextUrl.searchParams.get("work_date")?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 300);

  let query = ctx.service
    .from("nfc_worker_safety_daily_logs")
    .select(`
      id,
      worker_id,
      site_id,
      work_date,
      status,
      check_in_at,
      check_out_at,
      tbm_signed_at,
      tbm_records,
      attendance_summary,
      uploaded_at,
      worker:nfc_workers (
        worker_code,
        full_name,
        nationality,
        trade,
        preferred_lang
      )
    `)
    .order("work_date", { ascending: false })
    .order("check_out_at", { ascending: false })
    .limit(limit);

  if (siteId) query = query.eq("site_id", siteId);
  if (workDate) query = query.eq("work_date", workDate);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  const logs = data ?? [];
  const report = buildLegalReportEnvelope({
    reportType: "daily_safety_log_report",
    generatedBy: ctx.user.id,
    scope: { siteId: siteId ?? "ALL", workDate },
    sourceTables: ["nfc_worker_safety_daily_logs", "nfc_workers"],
    payload: { logs },
  });

  await recordReportExport({ service: ctx.service, envelope: report });

  return NextResponse.json({ logs, report });
}

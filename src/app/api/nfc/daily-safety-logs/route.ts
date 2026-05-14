import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  // 현장 범위 강제: 글로벌 role이 아닌 경우 자신의 현장 데이터만 조회 가능
  const GLOBAL_ROLES = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"];
  let enforcedSiteId: string | null = null;
  if (!GLOBAL_ROLES.includes(ctx.user.role.toUpperCase())) {
    const { data: profileData } = await ctx.service
      .from("profiles")
      .select("site_id")
      .eq("id", ctx.user.id)
      .maybeSingle();
    enforcedSiteId = profileData?.site_id ?? null;
    if (!enforcedSiteId) {
      return NextResponse.json({ error: "profile_site_required" }, { status: 409 });
    }
  }

  const siteId = enforcedSiteId ?? req.nextUrl.searchParams.get("site_id")?.trim();
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
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}

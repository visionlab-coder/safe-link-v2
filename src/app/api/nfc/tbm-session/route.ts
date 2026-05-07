import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const siteId = req.nextUrl.searchParams.get("site_id");
  const statusFilter = req.nextUrl.searchParams.get("status");

  let query = guard.ctx.service
    .from("nfc_tbm_sessions")
    .select("id, site_id, tbm_notice_id, title, status, started_at, ended_at, started_by, metadata")
    .order("started_at", { ascending: false })
    .limit(20);

  if (siteId) query = query.eq("site_id", siteId);
  if (statusFilter === "open") query = query.in("status", ["open", "running"]);
  else if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  let body: { site_id?: string; tbm_notice_id?: string | null; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const siteId = String(body.site_id || "").trim();
  if (!siteId) return NextResponse.json({ error: "site_id_required" }, { status: 400 });

  const { data, error } = await ctx.service
    .from("nfc_tbm_sessions")
    .insert({
      site_id: siteId,
      tbm_notice_id: body.tbm_notice_id ?? null,
      title: body.title?.trim() || null,
      started_by: ctx.user.id,
      status: "open",
    })
    .select("id, site_id, tbm_notice_id, title, status, started_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "session_create_failed", detail: error?.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

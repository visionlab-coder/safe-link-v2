import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type AdminContext } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

async function getAdminSiteId(ctx: AdminContext) {
  const { data: profile } = await ctx.service
    .from("profiles")
    .select("site_id")
    .eq("id", ctx.user.id)
    .maybeSingle();
  return profile?.site_id ? String(profile.site_id) : null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const siteId = await getAdminSiteId(ctx);
  if (!siteId) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });

  const { data, error } = await ctx.service
    .from("nfc_site_access_controls")
    .select("site_id, is_enabled, reason, updated_at")
    .eq("site_id", siteId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "site_access_query_failed" }, { status: 500 });
  return NextResponse.json({
    control: data ?? { site_id: siteId, is_enabled: true, reason: null, updated_at: null },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const siteId = await getAdminSiteId(ctx);
  if (!siteId) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });

  let body: { is_enabled?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const isEnabled = Boolean(body.is_enabled);
  const reason = String(body.reason ?? "").trim().slice(0, 200) || null;

  const { data, error } = await ctx.service
    .from("nfc_site_access_controls")
    .upsert({
      site_id: siteId,
      is_enabled: isEnabled,
      reason,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "site_id" })
    .select("site_id, is_enabled, reason, updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "site_access_update_failed", detail: error?.message }, { status: 500 });
  return NextResponse.json({ control: data });
}

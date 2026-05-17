import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, canAccessSite } from "@/utils/nfc/require-admin";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const tbmId = req.nextUrl.searchParams.get("tbmId");
  if (!tbmId) {
    return NextResponse.json({ error: "tbmId required" }, { status: 400 });
  }

  // Verify the TBM belongs to a site this admin can access
  const { data: tbm, error: tbmErr } = await ctx.service
    .from("tbm_notices")
    .select("id, site_id")
    .eq("id", tbmId)
    .maybeSingle();

  if (tbmErr || !tbm) {
    return NextResponse.json({ error: "TBM not found" }, { status: 404 });
  }

  if (!canAccessSite(ctx.user, tbm.site_id)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: acks, error: ackErr } = await ctx.service
    .from("tbm_ack")
    .select("worker_id, ack_at, signature_data")
    .eq("tbm_id", tbmId);

  if (ackErr) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ acks: acks || [] });
}

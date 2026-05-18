import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

const EVENT_TYPES = new Set(["written", "erased", "revoked"]);

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  let body: {
    event_type?: string;
    worker_id?: string;
    sticker_id?: string;
    tag_uid?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const eventType = String(body.event_type || "").trim();
  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "event_type_invalid" }, { status: 400 });
  }

  let workerSiteId: string | null = null;
  if (body.sticker_id) {
    const { data: stickerData } = await ctx.service
      .from("nfc_worker_stickers")
      .select("worker_id, nfc_workers(assigned_site_id)")
      .eq("id", body.sticker_id)
      .maybeSingle();

    const nfcWorkers = stickerData?.nfc_workers;
    workerSiteId = Array.isArray(nfcWorkers) && nfcWorkers.length > 0
      ? (nfcWorkers[0] as { assigned_site_id: string })?.assigned_site_id
      : !Array.isArray(nfcWorkers) && nfcWorkers
        ? (nfcWorkers as unknown as { assigned_site_id: string })?.assigned_site_id
        : null;
  } else if (body.worker_id) {
    const { data: worker } = await ctx.service
      .from("nfc_workers")
      .select("assigned_site_id")
      .eq("id", body.worker_id)
      .maybeSingle();
    workerSiteId = worker?.assigned_site_id ?? null;
  }

  const denied = requireSameSite(ctx.user, workerSiteId);
  if (denied) return denied;

  if (eventType === "erased" && body.sticker_id) {
    const { error: revokeErr } = await ctx.service
      .from("nfc_worker_stickers")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: ctx.user.id,
        revoke_reason: body.reason || "erased_for_reuse",
      })
      .eq("id", body.sticker_id);

    if (revokeErr) {
      return NextResponse.json({ error: "sticker_revoke_failed" }, { status: 500 });
    }
  }

  const { error } = await ctx.service.from("nfc_card_lifecycle_events").insert({
    worker_id: body.worker_id || null,
    sticker_id: body.sticker_id || null,
    event_type: eventType,
    actor_id: ctx.user.id,
    tag_uid: body.tag_uid || null,
    reason: body.reason || null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  });

  if (error) {
    return NextResponse.json({ error: "event_log_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

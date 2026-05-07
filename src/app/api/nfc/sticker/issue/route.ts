import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { signSticker, NFC_SIG_CURRENT_VERSION } from "@/utils/nfc/signing";
import { generateWorkerStickerUrl } from "@/utils/nfc/constants";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  let body: { worker_id?: string; revoke_previous?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const workerId = String(body.worker_id || "").trim();
  if (!workerId) return NextResponse.json({ error: "worker_id_required" }, { status: 400 });

  const { data: worker, error: workerErr } = await ctx.service
    .from("nfc_workers")
    .select("id, is_active, full_name, worker_code")
    .eq("id", workerId)
    .maybeSingle();

  if (workerErr || !worker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  if (worker.is_active === false) return NextResponse.json({ error: "worker_inactive" }, { status: 409 });

  if (body.revoke_previous) {
    await ctx.service
      .from("nfc_worker_stickers")
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.user.id, revoke_reason: "reissued" })
      .eq("worker_id", workerId)
      .eq("is_active", true);
  }

  const { data: latest } = await ctx.service
    .from("nfc_worker_stickers")
    .select("sig_version")
    .eq("worker_id", workerId)
    .order("sig_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Math.max((latest?.sig_version as number | undefined) ?? 0, NFC_SIG_CURRENT_VERSION - 1) + 1;
  const signed = await signSticker(workerId, { sigVersion: nextVersion });

  const { data: sticker, error: insertErr } = await ctx.service
    .from("nfc_worker_stickers")
    .insert({ worker_id: workerId, sig_version: signed.sigVersion, issued_epoch: signed.issuedEpoch, issued_by: ctx.user.id, is_active: true })
    .select("id")
    .single();

  if (insertErr || !sticker) return NextResponse.json({ error: "sticker_insert_failed", detail: insertErr?.message }, { status: 500 });

  const url = generateWorkerStickerUrl({ workerId, sigVersion: signed.sigVersion, issuedEpoch: signed.issuedEpoch, sig: signed.sig });

  return NextResponse.json({
    sticker_id: sticker.id,
    url,
    sig_version: signed.sigVersion,
    issued_epoch: signed.issuedEpoch,
    worker: { id: worker.id, worker_code: worker.worker_code, full_name: worker.full_name },
  });
}

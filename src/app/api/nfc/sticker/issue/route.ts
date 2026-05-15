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
    .select("id, is_active, full_name, worker_code, name_initials, phone_last4")
    .eq("id", workerId)
    .maybeSingle();

  if (workerErr || !worker) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  if (worker.is_active === false) return NextResponse.json({ error: "worker_inactive" }, { status: 409 });

  const { data: revoked } = await ctx.service
    .from("nfc_worker_stickers")
    .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.user.id, revoke_reason: "reissued" })
    .eq("worker_id", workerId)
    .eq("is_active", true)
    .select("id, sig_version, issued_epoch");

  if (revoked?.length) {
    await ctx.service.from("nfc_card_lifecycle_events").insert(
      revoked.map((item) => ({
        worker_id: workerId,
        sticker_id: item.id,
        event_type: "reissued",
        actor_id: ctx.user.id,
        sig_version: item.sig_version,
        issued_epoch: item.issued_epoch,
        reason: "reissued",
      }))
    );
  }

  const { data: latest } = await ctx.service
    .from("nfc_worker_stickers")
    .select("sig_version")
    .eq("worker_id", workerId)
    .order("sig_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Math.max((latest?.sig_version as number | undefined) ?? 0, NFC_SIG_CURRENT_VERSION - 1) + 1;
  const identityHint = [
    String(worker.name_initials || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase(),
    String(worker.phone_last4 || "").replace(/\D/g, "").slice(-4),
  ].filter(Boolean).join("");
  const signed = await signSticker(workerId, {
    sigVersion: nextVersion,
    workerCode: worker.worker_code,
    identityHint,
  });

  const { data: sticker, error: insertErr } = await ctx.service
    .from("nfc_worker_stickers")
    .insert({ worker_id: workerId, sig_version: signed.sigVersion, issued_epoch: signed.issuedEpoch, issued_by: ctx.user.id, is_active: true })
    .select("id")
    .single();

  if (insertErr || !sticker) {
    return NextResponse.json(
      { error: "sticker_insert_failed", detail: insertErr?.message },
      { status: insertErr?.code === "23505" ? 409 : 500 }
    );
  }

  const url = generateWorkerStickerUrl({
    workerId,
    workerCode: worker.worker_code,
    sigVersion: signed.sigVersion,
    issuedEpoch: signed.issuedEpoch,
    sig: signed.sig,
    identityHint,
  });

  // 청구항 2: NTAG213 NDEF 메시지 길이 138바이트 이내 검증
  // NDEF URI record 오버헤드: 3 bytes (NDEF header) + 1 byte (URI prefix 'https://')
  const urlBytes = new TextEncoder().encode(url);
  const ndefPayloadBytes = 3 + 1 + urlBytes.length; // TNF+type+payload header + URI prefix + URL
  if (ndefPayloadBytes > 138) {
    await ctx.service
      .from("nfc_worker_stickers")
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.user.id, revoke_reason: "ndef_too_long" })
      .eq("id", sticker.id);
    return NextResponse.json({
      error: "ndef_too_long",
      detail: `NDEF payload ${ndefPayloadBytes} bytes exceeds NTAG213 limit of 138 bytes. URL length: ${urlBytes.length}`,
    }, { status: 422 });
  }

  await ctx.service.from("nfc_card_lifecycle_events").insert({
    worker_id: workerId,
    sticker_id: sticker.id,
    event_type: "issued",
    actor_id: ctx.user.id,
    sig_version: signed.sigVersion,
    issued_epoch: signed.issuedEpoch,
    ndef_bytes: ndefPayloadBytes,
    metadata: {
      worker_code: worker.worker_code,
      has_identity_hint: Boolean(identityHint),
      revoke_previous: Boolean(body.revoke_previous),
    },
  });

  return NextResponse.json({
    sticker_id: sticker.id,
    url,
    sig_version: signed.sigVersion,
    issued_epoch: signed.issuedEpoch,
    ndef_bytes: ndefPayloadBytes,
    worker: { id: worker.id, worker_code: worker.worker_code, full_name: worker.full_name },
  });
}

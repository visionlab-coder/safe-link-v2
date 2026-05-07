import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

const ALLOWED_UPDATE_FIELDS = ["full_name", "nationality", "phone", "trade", "preferred_lang", "assigned_site_id", "notes"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const { data, error } = await guard.ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, phone, assigned_site_id, trade, preferred_lang, is_active, consent_signed_at, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  return NextResponse.json({ worker: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // 화이트리스트 필드만 업데이트
  const patch: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await guard.ctx.service
    .from("nfc_workers")
    .update(patch)
    .eq("id", id)
    .select("id, worker_code, full_name, nationality, trade, preferred_lang, is_active")
    .single();

  if (error || !data) return NextResponse.json({ error: "update_failed", detail: error?.message }, { status: 500 });
  return NextResponse.json({ worker: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  // 소프트 삭제: is_active=false + 모든 스티커 revoke
  await guard.ctx.service
    .from("nfc_worker_stickers")
    .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: guard.ctx.user.id, revoke_reason: "worker_deactivated" })
    .eq("worker_id", id)
    .eq("is_active", true);

  const { error } = await guard.ctx.service
    .from("nfc_workers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "deactivate_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

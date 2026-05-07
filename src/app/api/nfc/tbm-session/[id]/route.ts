import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

type SessionAction = "start" | "close";

const STATUS_MAP: Record<SessionAction, string> = {
  start: "running",
  close: "closed",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const { data: session, error } = await guard.ctx.service
    .from("nfc_tbm_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  const { data: attendance } = await guard.ctx.service
    .from("nfc_tbm_attendance")
    .select("id, worker_id, tapped_at, lang_used")
    .eq("session_id", id)
    .order("tapped_at", { ascending: true });

  return NextResponse.json({ session, attendance: attendance ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { action?: SessionAction };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !(action in STATUS_MAP)) {
    return NextResponse.json({ error: "invalid_action. use: start | close" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status: STATUS_MAP[action] };
  if (action === "close") {
    patch.ended_at = new Date().toISOString();
    patch.ended_by = guard.ctx.user.id;
  }

  const { data, error } = await guard.ctx.service
    .from("nfc_tbm_sessions")
    .update(patch)
    .eq("id", id)
    .select("id, status, started_at, ended_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "update_failed", detail: error?.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

const BACKOFF_MINUTES = [5, 10, 20, 40];

type WorkerRow = {
  id: string;
  worker_code?: string | null;
  full_name?: string | null;
  nationality?: string | null;
  assigned_site_id?: string | null;
  preferred_lang?: string | null;
  trade?: string | null;
};

function nextRetryForAttempt(attemptNumber: number): string {
  const minutes = BACKOFF_MINUTES[Math.min(Math.max(attemptNumber, 1), BACKOFF_MINUTES.length) - 1];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const { service } = guard.ctx;

  const { data: session, error: sessionError } = await service
    .from("nfc_tbm_sessions")
    .select("id, site_id, status")
    .eq("id", id)
    .maybeSingle();

  if (sessionError || !session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  const siteDenied = requireSameSite(guard.ctx.user, session.site_id);
  if (siteDenied) return siteDenied;

  const [workersResult, attendanceResult, logsResult] = await Promise.all([
    service
      .from("nfc_workers")
      .select("id, worker_code, full_name, nationality, assigned_site_id, preferred_lang, trade")
      .eq("assigned_site_id", session.site_id)
      .eq("is_active", true),
    service
      .from("nfc_tbm_attendance")
      .select("worker_id, is_certified")
      .eq("session_id", id),
    service
      .from("tbm_notification_log")
      .select("worker_id, attempt_number")
      .eq("tbm_session_id", id),
  ]);

  if (workersResult.error) return NextResponse.json({ error: "workers_query_failed" }, { status: 500 });
  if (attendanceResult.error) return NextResponse.json({ error: "attendance_query_failed" }, { status: 500 });
  if (logsResult.error) return NextResponse.json({ error: "notification_log_query_failed" }, { status: 500 });

  const certified = new Set(
    (attendanceResult.data ?? [])
      .filter((row) => row.is_certified)
      .map((row) => String(row.worker_id))
  );

  const maxAttempts = new Map<string, number>();
  for (const log of logsResult.data ?? []) {
    const workerId = String(log.worker_id);
    maxAttempts.set(workerId, Math.max(maxAttempts.get(workerId) ?? 0, Number(log.attempt_number) || 0));
  }

  const targets = ((workersResult.data ?? []) as WorkerRow[]).filter((worker) => !certified.has(worker.id));
  const rows = targets.map((worker) => {
    const attemptNumber = (maxAttempts.get(worker.id) ?? 0) + 1;
    return {
      tbm_session_id: id,
      worker_id: worker.id,
      attempt_number: attemptNumber,
      next_retry_at: nextRetryForAttempt(attemptNumber),
      channel: "push",
      status: "sent",
    };
  });

  if (rows.length === 0) return NextResponse.json({ notified: 0, workers: [] });

  const { data: inserted, error: insertError } = await service
    .from("tbm_notification_log")
    .insert(rows)
    .select("worker_id, attempt_number, next_retry_at");

  if (insertError) return NextResponse.json({ error: "notification_insert_failed" }, { status: 500 });

  return NextResponse.json({ notified: inserted?.length ?? 0, workers: inserted ?? [] });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const { data: getSession } = await guard.ctx.service
    .from("nfc_tbm_sessions")
    .select("site_id")
    .eq("id", id)
    .maybeSingle();
  const getSessionDenied = requireSameSite(guard.ctx.user, getSession?.site_id);
  if (getSessionDenied) return getSessionDenied;

  const { data, error } = await guard.ctx.service
    .from("tbm_notification_log")
    .select("*")
    .eq("tbm_session_id", id)
    .order("sent_at", { ascending: false });

  if (error) return NextResponse.json({ error: "notification_log_query_failed" }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

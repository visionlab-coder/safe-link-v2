import { NextRequest, NextResponse } from "next/server";
import { getCookieUser } from "@/utils/auth/cookie-user";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 청구항 11: 근로자 퀴즈 응답 제출 + 점수 계산
// POST /api/quiz/respond
// body: { quizResponseId, answers: number[] }

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  // P5 박제
  const user = await getCookieUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: { quizResponseId?: string; answers?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const quizResponseId = String(body.quizResponseId ?? "").trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (!quizResponseId) return NextResponse.json({ error: "quizResponseId_required" }, { status: 400 });

  const service = createService();

  // auth_user_id → nfc_workers.id 해석 (send 시 nfc_workers.id로 저장됨)
  const { data: nfcWorker } = await service
    .from("nfc_workers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const workerId = (nfcWorker as { id: string } | null)?.id ?? null;
  if (!workerId) return NextResponse.json({ error: "WORKER_NOT_FOUND" }, { status: 404 });

  const { data: response, error: fetchErr } = await service
    .from("tbm_quiz_responses")
    .select("*")
    .eq("id", quizResponseId)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (fetchErr || !response) {
    return NextResponse.json({ error: "quiz_response_not_found" }, { status: 404 });
  }

  if (response.status === "answered") {
    return NextResponse.json({ error: "already_answered", score_pct: response.score_pct }, { status: 409 });
  }

  const correctAnswers = response.answer_index_correct as number[];
  if (answers.length !== correctAnswers.length) {
    return NextResponse.json({ error: "invalid_answers_length" }, { status: 400 });
  }
  const correct = answers.filter((ans, i) => ans === correctAnswers[i]).length;
  const total = correctAnswers.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const { data: updatedData, error: updateErr } = await service
    .from("tbm_quiz_responses")
    .update({
      answers_submitted: answers,
      score_pct: scorePct,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", quizResponseId)
    .eq("status", "sent") // atomic guard — only one concurrent request wins
    .select("id")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!updatedData) {
    return NextResponse.json({ error: "already_answered", score_pct: response.score_pct }, { status: 409 });
  }

  return NextResponse.json({ ok: true, scorePct, correct, total });
}

// GET /api/quiz/respond?quizSessionId=xxx → 내 퀴즈 조회
export async function GET(req: NextRequest) {
  // P5 박제
  const user = await getCookieUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const quizSessionId = req.nextUrl.searchParams.get("quizSessionId");
  if (!quizSessionId) return NextResponse.json({ error: "quizSessionId_required" }, { status: 400 });

  const service = createService();
  const { data: nfcWorkerGet } = await service
    .from("nfc_workers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const workerIdGet = (nfcWorkerGet as { id: string } | null)?.id ?? null;
  if (!workerIdGet) return NextResponse.json({ response: null });

  // answer_index_correct는 제출 완료(answered) 후 결과 화면에만 반환 — 미제출 시 노출 금지 (C-5)
  const { data, error } = await service
    .from("tbm_quiz_responses")
    .select("id, lang, questions_translated, answer_index_correct, score_pct, status, answered_at")
    .eq("quiz_session_id", quizSessionId)
    .eq("worker_id", workerIdGet)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ response: null });

  // 미제출 상태에서는 answer_index_correct 제거
  if (data.status !== "answered") {
    const { answer_index_correct: _omit, ...safeData } = data as typeof data & { answer_index_correct: unknown };
    return NextResponse.json({ response: { ...safeData, answer_index_correct: null } });
  }

  return NextResponse.json({ response: data });
}

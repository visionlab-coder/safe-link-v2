import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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

  const { data: response, error: fetchErr } = await service
    .from("tbm_quiz_responses")
    .select("*")
    .eq("id", quizResponseId)
    .eq("worker_id", user.id)
    .maybeSingle();

  if (fetchErr || !response) {
    return NextResponse.json({ error: "quiz_response_not_found" }, { status: 404 });
  }

  if (response.status === "answered") {
    return NextResponse.json({ error: "already_answered", score_pct: response.score_pct }, { status: 409 });
  }

  const correctAnswers = response.answer_index_correct as number[];
  const correct = answers.filter((ans, i) => ans === correctAnswers[i]).length;
  const total = correctAnswers.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const { error: updateErr } = await service
    .from("tbm_quiz_responses")
    .update({
      answers_submitted: answers,
      score_pct: scorePct,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", quizResponseId);

  if (updateErr) {
    return NextResponse.json({ error: "update_failed", detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scorePct, correct, total });
}

// GET /api/quiz/respond?quizSessionId=xxx → 내 퀴즈 조회
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const quizSessionId = req.nextUrl.searchParams.get("quizSessionId");
  if (!quizSessionId) return NextResponse.json({ error: "quizSessionId_required" }, { status: 400 });

  const service = createService();
  const { data, error } = await service
    .from("tbm_quiz_responses")
    .select("id, lang, questions_translated, answer_index_correct, score_pct, status, answered_at")
    .eq("quiz_session_id", quizSessionId)
    .eq("worker_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data ?? null });
}

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// GET /api/quiz/worker-quiz
// 현재 로그인한 근로자의 최신 퀴즈 응답 조회
// auth_user_id → nfc_workers.id → tbm_quiz_responses 순으로 조회

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const service = createService();

  // auth_user_id로 nfc_workers.id 해석
  const { data: nfcWorker } = await service
    .from("nfc_workers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!nfcWorker) return NextResponse.json({ response: null });

  const { data } = await service
    .from("tbm_quiz_responses")
    .select("id, lang, questions_translated, answer_index_correct, answers_submitted, score_pct, status, answered_at")
    .eq("worker_id", (nfcWorker as { id: string }).id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ response: null });

  // 미제출 상태에서는 정답 인덱스 제거 (C-5 보안)
  if ((data as { status: string }).status !== "answered") {
    const { answer_index_correct: _omit, ...safeData } = data as typeof data & { answer_index_correct: unknown };
    return NextResponse.json({ response: { ...safeData, answer_index_correct: null } });
  }

  return NextResponse.json({ response: data });
}

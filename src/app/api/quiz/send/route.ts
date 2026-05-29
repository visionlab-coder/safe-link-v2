import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSameSite } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 11: 생성된 퀴즈를 근로자 모국어로 번역하여 발송
// POST /api/quiz/send
// body: { quizSessionId, tbmSessionId? }

// Gemini 의존 제거. Cloud Translation API (translateText) 만 사용.

type QuizQuestion = {
  id: string;
  keyword: string;
  question_ko: string;
  options_ko: string[];
  answer_index: number;
};

// 🚨 옵션 1 대 1 별도 번역 (Google Cloud Translation API).
// 이전 구현은 Gemini 에게 question + options 를 통째로 JSON 으로 번역 요청 → LLM 이
// 옵션 순서를 임의로 변경하여 채점 시 인덱스 불일치 → 다국어 워커만 오답 처리되는
// CRITICAL 버그. (한국어 워커는 분기에서 번역 안 함 → 정상 채점)
//
// Cloud Translation 은 각 문자열을 1 대 1 매핑으로 번역하므로 순서 변경 절대 없음.
// + 결과 검증 (개수 일치 / 빈값 없음) → 실패 시 원본 ko 폴백.
async function translateText(text: string, targetLang: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: targetLang, source: "ko", format: "text" }),
    }
  );
  if (!res.ok) throw new Error(`translate_http_${res.status}`);
  const data = (await res.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> };
  };
  const translated = data.data?.translations?.[0]?.translatedText;
  if (!translated) throw new Error("translate_empty");
  return translated;
}

async function translateQuiz(
  question: QuizQuestion,
  targetLang: string,
  apiKey: string
): Promise<{ question: string; options: string[] }> {
  if (targetLang === "ko") {
    return { question: question.question_ko, options: question.options_ko };
  }

  try {
    // 질문 + 각 옵션을 1 대 1 번역 (순서 절대 보존)
    const [translatedQ, ...translatedOpts] = await Promise.all([
      translateText(question.question_ko, targetLang, apiKey),
      ...question.options_ko.map((opt) => translateText(opt, targetLang, apiKey)),
    ]);

    // 검증: 옵션 개수 일치 + 모두 비어있지 않음
    if (translatedOpts.length !== question.options_ko.length) {
      return { question: question.question_ko, options: question.options_ko };
    }
    if (translatedOpts.some((o) => !o || !o.trim())) {
      return { question: question.question_ko, options: question.options_ko };
    }

    return { question: translatedQ, options: translatedOpts };
  } catch {
    // 번역 실패 → 한국어 원본 사용 (채점 일관성 우선)
    return { question: question.question_ko, options: question.options_ko };
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const apiKey = (process.env.GOOGLE_CLOUD_API_KEY ?? "").trim();
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_CLOUD_API_KEY_missing" }, { status: 500 });

  let body: { quizSessionId?: string; tbmSessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const quizSessionId = String(body.quizSessionId ?? "").trim();
  if (!quizSessionId) return NextResponse.json({ error: "quizSessionId_required" }, { status: 400 });

  // 퀴즈 세션 조회
  const { data: quizSession, error: qsErr } = await guard.ctx.service
    .from("tbm_quiz_sessions")
    .select("*")
    .eq("id", quizSessionId)
    .maybeSingle();

  if (qsErr || !quizSession) return NextResponse.json({ error: "quiz_session_not_found" }, { status: 404 });

  // 타현장 퀴즈 발송 차단 — SITE_ADMIN은 자신의 현장만, global admin은 허용
  const siteBlock = requireSameSite(guard.ctx.user, (quizSession as { site_id?: string | null }).site_id);
  if (siteBlock) return siteBlock;

  const questions = quizSession.questions as QuizQuestion[];
  const tbmSessionId = body.tbmSessionId ?? quizSession.tbm_session_id;

  // TBM 세션 참석자 조회 (TBM 없으면 현장 전체 근로자로 fallback)
  let workerIds: string[] = [];
  if (tbmSessionId) {
    const { data: attendees } = await guard.ctx.service
      .from("nfc_tbm_attendance")
      .select("worker_id")
      .eq("session_id", tbmSessionId);
    workerIds = (attendees ?? []).map((a: { worker_id: string }) => a.worker_id);
  }

  if (!workerIds.length) {
    const siteId = (quizSession as { site_id?: string | null }).site_id ??
      guard.ctx.user.site_id ?? null;
    if (siteId) {
      const { data: siteWorkers } = await guard.ctx.service
        .from("nfc_workers")
        .select("id")
        .eq("assigned_site_id", siteId)
        .eq("is_active", true);
      workerIds = (siteWorkers ?? []).map((w: { id: string }) => w.id);
    }
  }

  if (!workerIds.length) {
    return NextResponse.json({ error: "no_workers_found" }, { status: 400 });
  }

  // 근로자 언어 조회: nfc_workers.preferred_lang 우선, profiles.preferred_lang fallback
  const { data: workers } = await guard.ctx.service
    .from("nfc_workers")
    .select("id, preferred_lang, auth_user_id")
    .in("id", workerIds);

  // auth_user_id → profiles.preferred_lang 조회 (nfc_workers에 언어가 없는 경우 보정)
  const authUserIds = (workers ?? [])
    .map((w) => (w as { auth_user_id?: string | null }).auth_user_id)
    .filter(Boolean) as string[];

  const profileLangMap: Record<string, string> = {};
  if (authUserIds.length > 0) {
    const { data: profileRows } = await guard.ctx.service
      .from("profiles")
      .select("id, preferred_lang")
      .in("id", authUserIds);
    for (const p of profileRows ?? []) {
      const pr = p as { id: string; preferred_lang?: string | null };
      if (pr.preferred_lang) profileLangMap[pr.id] = pr.preferred_lang;
    }
  }

  // 언어별로 그룹화 후 번역 (중복 번역 방지)
  const langGroups = new Map<string, string[]>();
  for (const w of workers ?? []) {
    const worker = w as { id: string; preferred_lang?: string | null; auth_user_id?: string | null };
    const lang = worker.preferred_lang
      ?? (worker.auth_user_id ? profileLangMap[worker.auth_user_id] : null)
      ?? "ko";
    if (!langGroups.has(lang)) langGroups.set(lang, []);
    langGroups.get(lang)!.push(worker.id);
  }

  // 언어별 번역 + 퀴즈 발송 기록
  let sentCount = 0;
  const translatedByLang: Record<string, { question: string; options: string[] }[]> = {};

  await Promise.all(
    Array.from(langGroups.entries()).map(async ([lang]) => {
      const translated = await Promise.all(
        questions.map((q) => translateQuiz(q, lang, apiKey))
      );
      translatedByLang[lang] = translated;
    })
  );

  // tbm_quiz_responses 에 worker별 퀴즈 발송 기록 INSERT
  const insertRows = (workers ?? []).map((w) => {
    const worker = w as { id: string; preferred_lang?: string | null; auth_user_id?: string | null };
    const lang = worker.preferred_lang
      ?? (worker.auth_user_id ? profileLangMap[worker.auth_user_id] : null)
      ?? "ko";
    return {
      quiz_session_id: quizSessionId,
      worker_id: (w as { id: string }).id,
      lang,
      questions_translated: translatedByLang[lang] ?? [],
      answer_index_correct: questions.map((q) => q.answer_index),
      status: "sent",
    };
  });

  if (insertRows.length > 0) {
    await guard.ctx.service.from("tbm_quiz_responses").insert(insertRows).throwOnError();
    sentCount = insertRows.length;
  }

  // 퀴즈 세션 상태 업데이트
  await guard.ctx.service
    .from("tbm_quiz_sessions")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quizSessionId);

  return NextResponse.json({ sent: sentCount, langs: Object.keys(translatedByLang) });
}

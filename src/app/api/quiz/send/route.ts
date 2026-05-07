import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 11: 생성된 퀴즈를 근로자 모국어로 번역하여 발송
// POST /api/quiz/send
// body: { quizSessionId, tbmSessionId? }

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

const LANG_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", zh: "中文", vi: "Tiếng Việt",
  th: "ภาษาไทย", uz: "O'zbek", ph: "Filipino", ru: "Русский",
  km: "ខ្មែរ", id: "Bahasa Indonesia", mn: "Монгол",
  my: "မြန်မာ", ne: "नेपाली", bn: "বাংলা", kk: "Қазақ", jp: "日本語",
};

type QuizQuestion = {
  id: string;
  keyword: string;
  question_ko: string;
  options_ko: string[];
  answer_index: number;
};

async function translateQuiz(
  question: QuizQuestion,
  targetLang: string,
  apiKey: string
): Promise<{ question: string; options: string[] }> {
  if (targetLang === "ko") {
    return { question: question.question_ko, options: question.options_ko };
  }

  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const prompt = `Translate this safety quiz to ${langName}. Return ONLY JSON: {"question":"...","options":["...","...","..."]}
Korean question: ${question.question_ko}
Korean options: ${JSON.stringify(question.options_ko)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    }
  );

  if (!res.ok) return { question: question.question_ko, options: question.options_ko };

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!match) return { question: question.question_ko, options: question.options_ko };

  const parsed = JSON.parse(match[1]);
  return {
    question: parsed.question ?? question.question_ko,
    options: parsed.options ?? question.options_ko,
  };
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

  const questions = quizSession.questions as QuizQuestion[];
  const tbmSessionId = body.tbmSessionId ?? quizSession.tbm_session_id;

  // TBM 세션 참석자 조회
  const { data: attendees } = await guard.ctx.service
    .from("nfc_tbm_attendance")
    .select("worker_id")
    .eq("session_id", tbmSessionId);

  const workerIds = (attendees ?? []).map((a: { worker_id: string }) => a.worker_id);

  if (!workerIds.length) {
    return NextResponse.json({ error: "no_attendees_found" }, { status: 400 });
  }

  // 근로자 언어 조회
  const { data: workers } = await guard.ctx.service
    .from("profiles")
    .select("id, preferred_lang")
    .in("id", workerIds);

  // 언어별로 그룹화 후 번역 (중복 번역 방지)
  const langGroups = new Map<string, string[]>();
  for (const w of workers ?? []) {
    const lang = (w as { id: string; preferred_lang: string }).preferred_lang ?? "en";
    if (!langGroups.has(lang)) langGroups.set(lang, []);
    langGroups.get(lang)!.push((w as { id: string }).id);
  }

  // 언어별 번역 + 퀴즈 발송 기록
  let sentCount = 0;
  const translatedByLang: Record<string, { question: string; options: string[] }[]> = {};

  await Promise.all(
    Array.from(langGroups.entries()).map(async ([lang, _wIds]) => {
      const translated = await Promise.all(
        questions.map((q) => translateQuiz(q, lang, apiKey))
      );
      translatedByLang[lang] = translated;
    })
  );

  // tbm_quiz_responses 에 worker별 퀴즈 발송 기록 INSERT
  const insertRows = (workers ?? []).map((w) => {
    const lang = (w as { preferred_lang: string }).preferred_lang ?? "en";
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

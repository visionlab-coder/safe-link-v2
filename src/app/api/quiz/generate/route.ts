import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 11: TBM 발화 텍스트 → AI 퀴즈 자동 생성
// POST /api/quiz/generate
// body: { tbmSessionId, tbmText, workerLangs? }
// 반환: { questions: [{ id, question_ko, options_ko, answer_index, keyword }] }

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

type QuizQuestion = {
  id: string;
  keyword: string;
  question_ko: string;
  options_ko: string[];
  answer_index: number;
};

async function generateQuizFromText(
  tbmText: string,
  apiKey: string
): Promise<QuizQuestion[]> {
  const prompt = `당신은 건설현장 안전교육 퀴즈 출제 전문가입니다.
아래 TBM(Tool Box Meeting) 발화 텍스트에서 안전 핵심 키워드를 최대 5개 추출하고,
각 키워드에 대해 객관식 또는 OX 형식의 퀴즈 문항을 생성하세요.

규칙:
- 각 문항: 정답 1개 + 오답 2~3개 (총 3~4개 선지)
- 건설현장 맥락에 맞는 실용적인 문제
- 한국어로 작성

TBM 발화 텍스트:
${tbmText.slice(0, 3000)}

반드시 아래 JSON 배열 형식으로만 응답하세요:
[
  {
    "keyword": "키워드",
    "question_ko": "문제",
    "options_ko": ["정답", "오답1", "오답2"],
    "answer_index": 0
  }
]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) throw new Error("gemini_api_failed");

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error("invalid_gemini_response");

  const parsed = JSON.parse(jsonMatch[1]) as Omit<QuizQuestion, "id">[];
  return parsed.map((q, i) => ({ ...q, id: `q_${Date.now()}_${i}` }));
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const apiKey = (process.env.GOOGLE_CLOUD_API_KEY ?? "").trim();
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_CLOUD_API_KEY_missing" }, { status: 500 });

  let body: { tbmSessionId?: string; tbmText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const tbmSessionId = String(body.tbmSessionId ?? "").trim();
  let tbmText = String(body.tbmText ?? "").trim();

  // tbmText 없으면 세션 ID로 live_translations에서 발화 텍스트 조회
  if (!tbmText && tbmSessionId) {
    const { data: translations } = await guard.ctx.service
      .from("live_translations")
      .select("original_text")
      .eq("session_id", tbmSessionId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (translations?.length) {
      tbmText = translations.map((t: { original_text: string }) => t.original_text).join(" ");
    }
  }

  if (!tbmText) {
    return NextResponse.json({ error: "tbmText_or_tbmSessionId_required" }, { status: 400 });
  }

  try {
    const questions = await generateQuizFromText(tbmText, apiKey);

    // 생성된 퀴즈를 DB에 저장
    if (tbmSessionId && questions.length > 0) {
      await guard.ctx.service
        .from("tbm_quiz_sessions")
        .insert({
          tbm_session_id: tbmSessionId,
          site_id: null,
          questions: questions,
          created_by: guard.ctx.user.id,
          status: "draft",
        })
        .throwOnError();
    }

    return NextResponse.json({ questions, tbmSessionId });
  } catch (err) {
    return NextResponse.json(
      { error: "quiz_generation_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// GET /api/quiz/generate?tbmSessionId=xxx → 저장된 퀴즈 조회
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const tbmSessionId = req.nextUrl.searchParams.get("tbmSessionId");
  if (!tbmSessionId) return NextResponse.json({ error: "tbmSessionId_required" }, { status: 400 });

  const { data, error } = await guard.ctx.service
    .from("tbm_quiz_sessions")
    .select("*")
    .eq("tbm_session_id", tbmSessionId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quizSessions: data ?? [] });
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 11: TBM 발화 텍스트 → AI 퀴즈 자동 생성
// POST /api/quiz/generate
// body: { tbmSessionId, tbmText, workerLangs?, maxQuestions? }
// 반환: { questions: [{ id, question_ko, options_ko, answer_index, keyword }], source: "tbm"|"fallback" }

// 매일 3문제 기본값. TBM 내용 없을 때 사용하는 안전 상식 예시 풀 (21문제 × 일별 로테이션)
const FALLBACK_QUIZ_POOL: Omit<QuizQuestion, "id">[] = [
  { keyword: "추락방지", question_ko: "고소작업(2m 이상) 시 반드시 착용해야 할 안전장비는?", options_ko: ["안전대(안전벨트)", "방진마스크", "차광안경", "귀마개"], answer_index: 0 },
  { keyword: "안전모", question_ko: "건설현장에서 안전모를 착용하는 주된 이유는?", options_ko: ["낙하물로부터 머리 보호", "자외선 차단", "보온 유지", "신호 식별"], answer_index: 0 },
  { keyword: "화재예방", question_ko: "용접·절단 작업 전 반드시 해야 할 조치는?", options_ko: ["주변 가연성 물질 제거", "환기팬 끄기", "방화포 제거", "물 뿌리기"], answer_index: 0 },
  { keyword: "전기안전", question_ko: "젖은 손으로 전기 기기를 만지면 안 되는 이유는?", options_ko: ["감전 위험 증가", "기기 부식", "화재 발생", "소음 증가"], answer_index: 0 },
  { keyword: "개인보호구", question_ko: "분진이 발생하는 작업 시 착용해야 할 보호구는?", options_ko: ["방진마스크", "방음 귀마개", "차광 안경", "안전화"], answer_index: 0 },
  { keyword: "중량물취급", question_ko: "무거운 물건을 혼자 들 때 올바른 자세는?", options_ko: ["무릎을 굽히고 허리를 세운 자세", "허리를 구부려 빠르게 들기", "한 손으로 들기", "발끝으로 서서 들기"], answer_index: 0 },
  { keyword: "정리정돈", question_ko: "작업장 정리정돈이 중요한 주된 이유는?", options_ko: ["넘어짐·충돌 사고 예방", "작업 속도 향상", "도구 보호", "청결 유지"], answer_index: 0 },
  { keyword: "안전통로", question_ko: "현장 통로에 자재를 쌓아두면 안 되는 이유는?", options_ko: ["대피로 차단 및 사고 위험", "미관 저해", "자재 손상", "규정상 불필요"], answer_index: 0 },
  { keyword: "화학물질", question_ko: "유해 화학물질을 취급할 때 가장 먼저 해야 할 일은?", options_ko: ["MSDS(물질안전보건자료) 확인", "맨손으로 취급", "냄새로 확인", "폐기 처리"], answer_index: 0 },
  { keyword: "비계안전", question_ko: "비계 작업 시 발판 폭은 최소 몇 cm 이상이어야 하나요?", options_ko: ["40cm", "20cm", "10cm", "30cm"], answer_index: 0 },
  { keyword: "크레인안전", question_ko: "크레인 작업 반경 내에서 작업자가 해야 할 행동은?", options_ko: ["즉시 대피", "작업 계속", "신호수에게 보고 후 대기", "크레인 멈추기"], answer_index: 0 },
  { keyword: "굴착안전", question_ko: "굴착작업 시 주변 지반 침하를 막기 위해 설치하는 것은?", options_ko: ["흙막이 지보공", "방호 울타리", "안전망", "추락방지대"], answer_index: 0 },
  { keyword: "TBM목적", question_ko: "TBM(Tool Box Meeting)의 주요 목적은?", options_ko: ["작업 전 위험요소 공유 및 안전 확인", "작업 성과 평가", "인원 점호", "도구 배분"], answer_index: 0 },
  { keyword: "비상구", question_ko: "비상구 앞에 물건을 놓아두면 안 되는 이유는?", options_ko: ["긴급 대피를 방해하기 때문", "미관상 문제", "도난 위험", "화재 유발"], answer_index: 0 },
  { keyword: "신호수", question_ko: "중장비 후진 시 신호수의 역할은?", options_ko: ["장비 이동 방향을 안내하고 충돌을 예방", "짐을 실어주기", "연료 보충", "기계 점검"], answer_index: 0 },
  { keyword: "안전화", question_ko: "건설현장 안전화를 착용하는 이유는?", options_ko: ["낙하물·날카로운 물체로부터 발 보호", "미끄럼 방지만이 목적", "빠른 이동을 위해", "규정이 없어도 필요"], answer_index: 0 },
  { keyword: "철근작업", question_ko: "철근 작업 시 절단면에 대한 올바른 처리 방법은?", options_ko: ["보호캡 씌우기 또는 구부림 처리", "그대로 방치", "테이프로 감기", "제거 후 작업"], answer_index: 0 },
  { keyword: "콘크리트타설", question_ko: "콘크리트 타설 중 거푸집이 변형될 경우 취해야 할 행동은?", options_ko: ["즉시 작업 중단 후 보강", "타설 속도 높이기", "계속 타설 후 점검", "무시하고 진행"], answer_index: 0 },
  { keyword: "작업허가", question_ko: "밀폐 공간 작업 전 반드시 확인해야 할 것은?", options_ko: ["산소 농도 및 유해가스 측정", "조명 밝기 확인", "작업 공구 수량", "인원 인원수 확인"], answer_index: 0 },
  { keyword: "4대보험", question_ko: "외국인 근로자도 산재보험 적용 대상인가요?", options_ko: ["예, 내국인과 동일하게 적용됩니다", "아니오, 외국인은 제외됩니다", "비자 종류에 따라 다릅니다", "계약서에만 따릅니다"], answer_index: 0 },
  { keyword: "산소결핍", question_ko: "산소결핍 공간에서 작업 시 착용해야 할 장비는?", options_ko: ["공기호흡기 또는 송기마스크", "방진마스크", "방독마스크", "일반 마스크"], answer_index: 0 },
];

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
아래는 오늘 TBM(Tool Box Meeting)에서 실제로 다룬 내용입니다.
(TBM 교육 공지문 + 현장 발화 내용이 포함될 수 있습니다)

이 내용에서 안전 핵심 키워드를 최대 5개 추출하고,
각 키워드에 대해 객관식 또는 OX 형식의 퀴즈 문항을 생성하세요.

규칙:
- 오늘 TBM에서 실제로 언급된 내용만 출제 (추측 금지)
- 각 문항: 정답 1개 + 오답 2~3개 (총 3~4개 선지)
- 건설현장 맥락에 맞는 실용적인 문제
- 한국어로 작성

오늘 TBM 내용:
${tbmText.slice(0, 4000)}

반드시 아래 JSON 배열 형식으로만 응답하세요:
[
  {
    "keyword": "키워드",
    "question_ko": "문제",
    "options_ko": ["정답", "오답1", "오답2"],
    "answer_index": 0
  }
]`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

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

  let body: { tbmSessionId?: string; tbmText?: string; maxQuestions?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const tbmSessionId = String(body.tbmSessionId ?? "").trim();
  const maxQuestions = Math.min(Math.max(1, Number(body.maxQuestions ?? 3)), 10);
  let tbmText = String(body.tbmText ?? "").trim();

  // tbmSessionId가 있으면 서버에서 모든 소스를 직접 조회·결합
  if (tbmSessionId) {
    const [sessionRes, translationsRes] = await Promise.all([
      guard.ctx.service
        .from("nfc_tbm_sessions")
        .select("tbm_notices(content_ko)")
        .eq("id", tbmSessionId)
        .maybeSingle(),
      guard.ctx.service
        .from("live_translations")
        .select("original_text")
        .eq("session_id", tbmSessionId)
        .order("created_at", { ascending: true })
        .limit(150),
    ]);

    const noticeText =
      (sessionRes.data?.tbm_notices as { content_ko?: string } | null)?.content_ko ?? "";
    const liveText = (translationsRes.data ?? [])
      .map((t: { original_text: string }) => t.original_text)
      .join(" ");

    const parts: string[] = [];
    if (noticeText) parts.push(noticeText);
    if (liveText) parts.push(`[현장 발화 내용]\n${liveText}`);

    if (parts.length) tbmText = parts.join("\n\n");
  }

  // TBM 내용 없으면 일별 로테이션 예시 문제 사용 (fallback)
  let source: "tbm" | "fallback" = "tbm";
  let questions: QuizQuestion[];

  if (!tbmText) {
    source = "fallback";
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const offset = (dayOfYear * maxQuestions) % FALLBACK_QUIZ_POOL.length;
    const pool = [...FALLBACK_QUIZ_POOL.slice(offset), ...FALLBACK_QUIZ_POOL.slice(0, offset)];
    questions = pool.slice(0, maxQuestions).map((q, i) => ({ ...q, id: `fallback_${Date.now()}_${i}` }));
  } else {
    try {
      const all = await generateQuizFromText(tbmText, apiKey);
      questions = all.slice(0, maxQuestions);
    } catch (err) {
      return NextResponse.json(
        { error: "quiz_generation_failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  let quizSessionId: string | null = null;
  if (tbmSessionId && questions.length > 0) {
    const { data: inserted } = await guard.ctx.service
      .from("tbm_quiz_sessions")
      .insert({
        tbm_session_id: tbmSessionId,
        site_id: null,
        questions,
        created_by: guard.ctx.user.id,
        status: "draft",
        source,
      })
      .select("id")
      .single();
    quizSessionId = inserted?.id ?? null;
  }

  return NextResponse.json({ questions, tbmSessionId, quizSessionId, source });
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

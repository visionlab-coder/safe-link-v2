import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// 청구항 6: 위험성평가 DB → AI 안전 브리핑 초안 자동 생성
// POST /api/tbm/briefing-draft
// body: { category, subcategory?, siteId?, workTypes? }
// 반환: { draft, hazardItems, rawTips }

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

type HazardItem = {
  id: string;
  category: string;
  subcategory: string;
  hazard_description: string;
  accident_type: string;
  preventive_measure: string;
  risk_level: number;
  is_critical: boolean;
};

async function generateBriefingDraft(hazardItems: HazardItem[], apiKey: string): Promise<string> {
  const hazardSummary = hazardItems
    .slice(0, 10)
    .map(
      (h) =>
        `[${h.category}/${h.subcategory}] 위험요인: ${h.hazard_description} | 재해형태: ${h.accident_type} | 예방대책: ${h.preventive_measure}`
    )
    .join("\n");

  const prompt = `당신은 건설현장 안전관리 전문가입니다.
아래 위험성평가 항목들을 바탕으로 오늘 TBM(Tool Box Meeting) 안전 브리핑 초안을 작성해주세요.

위험성평가 항목:
${hazardSummary}

요구사항:
- 관리자가 5분 내 읽을 수 있는 분량 (300-500자)
- 중점 위험 요소 3가지와 구체적 예방 조치 포함
- 존댓말(공손체) 사용
- 실용적이고 현장 중심의 내용
- 제목 포함

반드시 브리핑 텍스트만 반환하세요.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) throw new Error("gemini_api_failed");
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("empty_gemini_response");
  return text.trim();
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const apiKey = (process.env.GOOGLE_CLOUD_API_KEY ?? "").trim();
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_CLOUD_API_KEY_missing" }, { status: 500 });

  let body: { category?: string; subcategory?: string; siteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const category = String(body.category ?? "").trim();

  // 위험성평가 DB 조회
  let query = guard.ctx.service
    .from("safety_education_library")
    .select("id, category, subcategory, hazard_description, accident_type, preventive_measure, risk_level, is_critical")
    .order("risk_level", { ascending: false })
    .limit(20);

  if (category) query = query.eq("category", category);
  if (body.subcategory) query = query.eq("subcategory", body.subcategory);

  const { data: hazardItems, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!hazardItems?.length) {
    return NextResponse.json({ error: "no_hazard_items_found", hint: "category가 올바른지 확인하세요" }, { status: 404 });
  }

  try {
    const draft = await generateBriefingDraft(hazardItems as HazardItem[], apiKey);
    return NextResponse.json({
      draft,
      hazardItemCount: hazardItems.length,
      criticalCount: hazardItems.filter((h) => (h as HazardItem).is_critical).length,
      category: category || "전체",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "draft_generation_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// GET /api/tbm/briefing-draft?category=xxx → 위험성평가 카테고리 목록
export async function GET(_req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.ctx.service
    .from("safety_education_library")
    .select("category, subcategory")
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grouped = (data ?? []).reduce<Record<string, string[]>>((acc, row) => {
    const r = row as { category: string; subcategory: string };
    if (!acc[r.category]) acc[r.category] = [];
    if (!acc[r.category].includes(r.subcategory)) acc[r.category].push(r.subcategory);
    return acc;
  }, {});

  return NextResponse.json({ categories: grouped });
}

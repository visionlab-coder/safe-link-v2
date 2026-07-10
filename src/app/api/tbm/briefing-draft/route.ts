import { NextRequest, NextResponse } from "next/server";
import { stripEmoji } from "@/utils/strip-emoji";
import { getV3SessionUser } from "@/utils/auth/v3-session-user";
import { callV3AiVendor } from "@/utils/ai/v3-ai-gateway";

export const runtime = "nodejs";

// 청구항 6: 위험성평가 DB → AI 안전 브리핑 초안 자동 생성
// POST /api/tbm/briefing-draft
// body: { category, subcategory?, siteId?, workTypes? }
// 반환: { draft, hazardItems, rawTips }

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

const DEFAULT_HAZARDS: HazardItem[] = [
  {
    id: "fall-001",
    category: "고소작업",
    subcategory: "추락",
    hazard_description: "개구부와 단부에서 작업 중 추락 위험이 있습니다.",
    accident_type: "추락",
    preventive_measure: "안전난간, 덮개, 안전대 체결 상태를 작업 전 확인합니다.",
    risk_level: 5,
    is_critical: true,
  },
  {
    id: "equipment-001",
    category: "중장비",
    subcategory: "협착",
    hazard_description: "굴삭기와 지게차 작업 반경 내 접근 시 협착 위험이 있습니다.",
    accident_type: "협착",
    preventive_measure: "유도자를 배치하고 장비 작업 반경 출입을 통제합니다.",
    risk_level: 5,
    is_critical: true,
  },
  {
    id: "electric-001",
    category: "전기",
    subcategory: "감전",
    hazard_description: "임시 전선과 분전반 사용 중 감전 위험이 있습니다.",
    accident_type: "감전",
    preventive_measure: "누전차단기, 접지, 전선 피복 손상 여부를 확인합니다.",
    risk_level: 4,
    is_critical: true,
  },
  {
    id: "fire-001",
    category: "화기작업",
    subcategory: "화재",
    hazard_description: "용접과 절단 작업 중 불티로 인한 화재 위험이 있습니다.",
    accident_type: "화재",
    preventive_measure: "불티 비산 방지포와 소화기를 배치하고 작업 후 잔불을 확인합니다.",
    risk_level: 4,
    is_critical: false,
  },
];

async function generateBriefingDraft(req: NextRequest, siteId: number, hazardItems: HazardItem[]): Promise<string> {
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
- 이모지·이모티콘 절대 사용 금지 (TTS 음성 읽기 오류 방지)

반드시 브리핑 텍스트만 반환하세요.`;

  const result = await callV3AiVendor(req, {
    siteId,
    feature: "quiz",
    provider: "openai-prompt",
    sourceLanguage: "ko",
    targetLanguage: "ko",
    text: hazardSummary,
    prompt,
    maxOutputTokens: 1024,
    temperature: 0.5,
  });
  const text = result?.text ?? "";
  if (!text) throw new Error("empty_ai_response");
  return stripEmoji(text);
}

export async function POST(req: NextRequest) {
  const user = await getV3SessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const isAdmin = user.roles.some((role) => ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER"].includes(role));
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const siteId = user.siteIds[0];
  if (typeof siteId !== "number") return NextResponse.json({ error: "site_required" }, { status: 403 });

  let body: { category?: string; subcategory?: string; siteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const category = String(body.category ?? "").trim();

  const hazardItems = DEFAULT_HAZARDS
    .filter((item) => !category || item.category === category)
    .filter((item) => !body.subcategory || item.subcategory === body.subcategory)
    .sort((a, b) => b.risk_level - a.risk_level)
    .slice(0, 20);

  if (!hazardItems.length) {
    return NextResponse.json({ error: "no_hazard_items_found", hint: "category가 올바른지 확인하세요" }, { status: 404 });
  }

  try {
    const draft = await generateBriefingDraft(req, siteId, hazardItems);
    return NextResponse.json({
      draft,
      hazardItemCount: hazardItems.length,
      criticalCount: hazardItems.filter((h) => h.is_critical).length,
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
export async function GET() {
  const user = await getV3SessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const isAdmin = user.roles.some((role) => ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER"].includes(role));
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const grouped = DEFAULT_HAZARDS.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    if (!acc[row.category].includes(row.subcategory)) acc[row.category].push(row.subcategory);
    return acc;
  }, {});

  return NextResponse.json({ categories: grouped });
}

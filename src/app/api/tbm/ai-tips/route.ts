import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { getErrorMessage } from '@/utils/errors';
import { getV3SessionUser } from '@/utils/auth/v3-session-user';
import { callV3AiVendor } from '@/utils/ai/v3-ai-gateway';

interface TipsPayload {
    tips?: string[];
}

/**
 * POST /api/tbm/ai-tips
 * Spring AI Gateway 기반 건설 현장 TBM 안전 수칙 3개 생성
 */
export async function POST(request: NextRequest) {
    const user = await getV3SessionUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const isAdmin = user.roles.some((role) => ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER"].includes(role));
    if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const siteId = user.siteIds[0];
    if (typeof siteId !== "number") return NextResponse.json({ error: "site_required" }, { status: 403 });

    let context = "";
    try {
        const body = await request.json();
        context = body.context || "";
    } catch {
        // body 없으면 컨텍스트 없이 진행
    }

    const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    const prompt = `당신은 건설 현장 안전 관리 전문가입니다. 오늘(${today})의 건설 현장 TBM(Toolbox Meeting) 안전 수칙 3가지를 생성해주세요.${context ? ` 추가 상황: ${context}` : ""}

요구사항:
- 각 수칙은 완전한 한국어 문장 1개 (반말 금지, 정중한 존댓말 사용)
- 건설 현장의 구체적이고 실용적인 내용 (고소작업, 중장비, 전기, 화재, 협착 등 다양한 위험 요소)
- 계절/날씨/요일을 고려한 현실적 내용
- 절대. 이모지나 이모티콘을 어떠한 경우에도 포함하지 마세요. (TTS 읽기 오류 방지용)
- JSON 형식으로만 응답: {"tips": ["수칙1", "수칙2", "수칙3"]}`;

    try {
        const result = await callV3AiVendor(request, {
            siteId,
            feature: "quiz",
            provider: "openai-prompt",
            sourceLanguage: "ko",
            targetLanguage: "ko",
            text: context || today,
            prompt,
            maxOutputTokens: 512,
            temperature: 0.9,
        });
        const textContent = result?.text;
        if (!textContent) throw new Error("Empty AI response");

        const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
        const parsed = JSON.parse(jsonMatch?.[1] || textContent) as TipsPayload;
        if (!Array.isArray(parsed.tips) || parsed.tips.length === 0) {
            throw new Error("Invalid tips format");
        }

        const cleanTips = parsed.tips.slice(0, 3).map((tip: string) =>
            tip.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
        );

        return NextResponse.json({ tips: cleanTips });
    } catch (error: unknown) {
        console.error("[AI-Tips] AI gateway failed:", getErrorMessage(error));
        return NextResponse.json({ tips: getFallbackTips() });
    }
}

function getFallbackTips(): string[] {
    return [
        "고소 작업 시 안전대 착용 여부를 반드시 확인하시고, 하부 통제 구역을 설정해 주시기 바랍니다.",
        "전기 작업 전 반드시 전원을 차단하고 잠금장치(LOTO)를 적용하여 감전 사고를 예방해 주십시오.",
        "중장비 후방 이동 시 유도자를 배치하고, 작업 반경 내 근로자 접근을 통제해 주시기 바랍니다."
    ];
}

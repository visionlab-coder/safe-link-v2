/**
 * SAFE-LINK AI Watchdog Agent
 * 분석 에이전트: 모든 현장의 대화를 실시간 스캔하여 위험 요소를 추출합니다.
 */

export type AIAnalysisResult = {
    safety_score: number; // 0 (위험) ~ 100 (안전)
    is_emergency: boolean;
    sentiment: 'positive' | 'neutral' | 'negative';
    keywords: string[];
    summary_ko: string;
    recommended_action?: string;
};

export async function analyzeMessageWithAI(text: string): Promise<AIAnalysisResult> {
    // TODO: 실제 Google Gemini API 연동 (API Key 필요)
    // 현재는 MVP 시뮬레이션 로직으로 작동합니다.

    const dangerKeywords = ['위험', '사고', '피 나', '다쳤', '응급', '불 났', '추락', '붕괴', '미끄러'];
    const isEmergency = dangerKeywords.some(k => text.includes(k));

    // 시뮬레이션 지연 (AI가 생각하는 느낌)
    await new Promise(resolve => setTimeout(resolve, 800));

    if (isEmergency) {
        return {
            safety_score: 20,
            is_emergency: true,
            sentiment: 'negative',
            keywords: dangerKeywords.filter(k => text.includes(k)),
            summary_ko: "긴급 상황 감지: 현장 내 부상 또는 사고 관련 키워드가 식별되었습니다.",
            recommended_action: "즉시 현장 안전관리자에게 사이렌 알림 전송 및 구급차 대기"
        };
    }

    return {
        safety_score: 95,
        is_emergency: false,
        sentiment: 'neutral',
        keywords: [],
        summary_ko: "평범한 현장 소통입니다.",
    };
}

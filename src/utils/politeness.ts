/**
 * Korean Politeness (Honorifics) Utility
 * Ensures sentences end with polite forms (존댓말).
 * 건설현장 안전관리 맥락에 최적화.
 */

/**
 * 문장 단위로 존대말 변환 (각 문장의 끝을 경어로)
 */
export function ensurePoliteKo(text: string): string {
    if (!text || text.length === 0) return text;

    const trimmed = text.trim();

    // 이미 존대말이면 그대로 반환
    if (/(?:요|까|죠|니다|세요|니까|시오|바랍니다)[.!?]?$/.test(trimmed)) {
        return trimmed;
    }

    // 여러 문장/절이면 각각 처리 (마침표/물음표/느낌표/쉼표 기준 분리)
    const sentences = trimmed.split(/(?<=[.!?])\s+|,\s*/);
    if (sentences.length > 1) {
        return sentences.map(s => ensurePoliteKo(s)).join(" ");
    }

    // 문장 끝 패턴 매칭 (구체적인 것 → 일반적인 것 순서)
    const rules: Array<{ from: RegExp; to: string }> = [
        // === 명령/청유형 (건설현장에서 자주 사용) ===
        { from: /지 ?마라[.!?]?$/, to: "지 마세요." },
        { from: /지 ?마[.!?]?$/, to: "지 마세요." },
        { from: /해라[.!?]?$/, to: "하세요." },
        { from: /하자[.!?]?$/, to: "합시다." },
        { from: /가자[.!?]?$/, to: "갑시다." },
        { from: /하게[.!?]?$/, to: "하세요." },

        // === 동사 특수 활용 (건설현장 빈출) ===
        { from: /써[.!?]?$/, to: "쓰세요." },         // 안전모 써 → 쓰세요
        { from: /와[.!?]?$/, to: "오세요." },         // 가져와 → 가져오세요... 와 → 오세요
        { from: /가져와[.!?]?$/, to: "가져오세요." },
        { from: /줘[.!?]?$/, to: "주세요." },         // 도와줘 → 도와주세요
        { from: /봐[.!?]?$/, to: "보세요." },         // 확인해봐 → 확인해보세요

        // === ~ㄴ다/는다 (현재형 평서문) ===
        { from: /한다[.!?]?$/, to: "합니다." },       // 시작한다 → 시작합니다
        { from: /온다[.!?]?$/, to: "옵니다." },       // 비 온다 → 비 옵니다
        { from: /간다[.!?]?$/, to: "갑니다." },       // 간다 → 갑니다
        { from: /된다[.!?]?$/, to: "됩니다." },       // 된다 → 됩니다
        { from: /난다[.!?]?$/, to: "납니다." },       // 난다 → 납니다
        { from: /본다[.!?]?$/, to: "봅니다." },       // 본다 → 봅니다
        { from: /준다[.!?]?$/, to: "줍니다." },       // 준다 → 줍니다
        { from: /산다[.!?]?$/, to: "삽니다." },
        { from: /신다[.!?]?$/, to: "신습니다." },
        { from: /는다[.!?]?$/, to: "습니다." },       // 먹는다 → 먹습니다 (받침 있는 동사 현재형)

        // === 과거형 ===
        { from: /했다[.!?]?$/, to: "했습니다." },
        { from: /었다[.!?]?$/, to: "었습니다." },
        { from: /았다[.!?]?$/, to: "았습니다." },
        { from: /겠다[.!?]?$/, to: "겠습니다." },
        { from: /였다[.!?]?$/, to: "였습니다." },
        { from: /됐다[.!?]?$/, to: "됐습니다." },

        // === 일반 ~다 (형용사/동사 기본형) ===
        { from: /하다[.!?]?$/, to: "합니다." },
        { from: /이다[.!?]?$/, to: "입니다." },
        { from: /없다[.!?]?$/, to: "없습니다." },
        { from: /있다[.!?]?$/, to: "있습니다." },
        { from: /같다[.!?]?$/, to: "같습니다." },
        { from: /크다[.!?]?$/, to: "큽니다." },
        { from: /작다[.!?]?$/, to: "작습니다." },
        { from: /좋다[.!?]?$/, to: "좋습니다." },
        { from: /많다[.!?]?$/, to: "많습니다." },
        { from: /높다[.!?]?$/, to: "높습니다." },
        { from: /낮다[.!?]?$/, to: "낮습니다." },
        { from: /넓다[.!?]?$/, to: "넓습니다." },
        { from: /깊다[.!?]?$/, to: "깊습니다." },

        // 받침 있는 동사 + 다 → 습니다
        { from: /([가-힣])다[.!?]?$/, to: "$1습니다." },

        // === 반말 어미 ===
        { from: /해[.!?]?$/, to: "하세요." },        // 조심해 → 조심하세요
        { from: /냐[.!?]?$/, to: "나요?" },
        { from: /니[.!?]?$/, to: "나요?" },
        { from: /이야[.!?]?$/, to: "이에요." },       // 일이야? → 일이에요?
        { from: /야[.!?]?$/, to: "예요." },           // 뭐야? → 뭐예요?
        { from: /어[.!?]?$/, to: "어요." },          // 먹었어 → 먹었어요
        { from: /아[.!?]?$/, to: "아요." },

        // === 형용사 반말 (ㅃ/ㄲ 등 쌍자음 + 아/어) ===
        { from: /빠[.!?]?$/, to: "빠요." },          // 바빠 → 바빠요
        { from: /싸[.!?]?$/, to: "싸요." },
        { from: /커[.!?]?$/, to: "커요." },
        { from: /작아[.!?]?$/, to: "작아요." },
        { from: /높아[.!?]?$/, to: "높아요." },
        { from: /좋아[.!?]?$/, to: "좋아요." },
        { from: /많아[.!?]?$/, to: "많아요." },
        { from: /넓어[.!?]?$/, to: "넓어요." },
        { from: /깊어[.!?]?$/, to: "깊어요." },
        { from: /추워[.!?]?$/, to: "추워요." },
        { from: /더워[.!?]?$/, to: "더워요." },
        { from: /무거워[.!?]?$/, to: "무거워요." },
        { from: /가벼워[.!?]?$/, to: "가벼워요." },
        { from: /위험해[.!?]?$/, to: "위험해요." },
    ];

    let result = trimmed;
    for (const rule of rules) {
        if (rule.from.test(result)) {
            result = result.replace(rule.from, rule.to);
            break;
        }
    }

    // 변환이 안 됐으면 fallback: 한글로 끝나면 "요" 추가
    if (result === trimmed && /[가-힣]$/.test(result)) {
        result += "요.";
    }

    return result;
}

/**
 * 일본어 출력의 경어 보장 — 반말(だ체/명령형)을 です/ます체로 변환
 * 파파고가 반말 입력을 だ体로 번역하는 경우 방어
 */
export function formalizeJa(text: string): string {
    const trimmed = text?.trim();
    if (!trimmed) return text;

    // 이미 경어면 그대로
    if (/(?:です|ます|ください|ませ|でしょう|ましょう|ません)[。！？.!?]?$/.test(trimmed)) return trimmed;

    const rules: Array<{ from: RegExp; to: string }> = [
        // 단정/추측 반말 → 존댓말
        { from: /だろう[。！？.!?]?$/, to: 'でしょう。' },
        { from: /であろう[。！？.!?]?$/, to: 'でしょう。' },
        { from: /である[。！？.!?]?$/, to: 'です。' },
        { from: /だ[。！？.!?]?$/, to: 'です。' },
        // 명령형/요청 반말 → 정중 요청형
        { from: /してくれ[。！？.!?]?$/, to: 'してください。' },
        { from: /てくれ[。！？.!?]?$/, to: 'てください。' },
        { from: /しろ[。！？.!?]?$/, to: 'してください。' },
        { from: /なさい[。！？.!?]?$/, to: 'てください。' },
    ];

    let result = trimmed;
    for (const rule of rules) {
        if (rule.from.test(result)) {
            result = result.replace(rule.from, rule.to);
            break;
        }
    }
    return result;
}

/**
 * 전체 텍스트를 존대말로 변환 (단어 치환 + 어미 변환)
 */
export function formalizeKo(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    // 1. 완전 일치 매핑 (건설현장 빈출 표현)
    const exactMapping: Record<string, string> = {
        "묻다": "물어보고 싶은 게 있습니다.",
        "말하다": "말씀드릴 게 있습니다.",
        "물어보다": "물어보고 싶은 게 있습니다.",
        "도와줘": "도움이 필요합니다.",
        "기다려": "잠시만 기다려 주세요.",
        "위험": "위험하니 주의하시기 바랍니다.",
        "조심해": "조심하시기 바랍니다.",
        "안녕": "안녕하세요.",
        "고마워": "감사합니다.",
        "미안해": "죄송합니다.",
        "그래": "알겠습니다.",
        "응": "네.",
        "아니": "아니요.",
        "먹어": "드세요.",
    };

    if (exactMapping[trimmed]) return exactMapping[trimmed];

    // 2. 이미 존대말이면 그대로 반환
    if (/(?:요|까|죠|니다|세요|니까|시오|바랍니다)[.!?]?$/.test(trimmed)) {
        return trimmed;
    }

    // 3. 어미 변환 적용
    return ensurePoliteKo(trimmed);
}

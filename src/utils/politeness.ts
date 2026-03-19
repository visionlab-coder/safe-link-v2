/**
 * Korean Politeness (Honorifics) Utility
 * Ensures sentences end with polite forms (존댓말).
 */

const politeEndings = [
    { from: /다$/, to: "습니다" },
    { from: /어$/, to: "어요" },
    { from: /아$/, to: "아요" },
    { from: /니$/, to: "세요" },
    { from: /냐$/, to: "나요?" },
    { from: /해$/, to: "해요" },
    { from: /야$/, to: "이에요" },
];

/**
 * 밥 먹었어 -> 밥 먹었어요
 * 간다 -> 갑니다
 */
export function ensurePoliteKo(text: string): string {
    if (!text || text.length === 0) return text;

    const trimmed = text.trim();
    // Already polite check
    if (trimmed.endsWith("요") || trimmed.endsWith("까") || trimmed.endsWith("죠") || trimmed.endsWith("습니다")) {
        return trimmed;
    }

    // Basic heuristic conversion
    let result = trimmed;
    for (const rule of politeEndings) {
        if (rule.from.test(result)) {
            result = result.replace(rule.from, rule.to);
            break;
        }
    }

    // Fallback: If it doesn't end with a polite marker and is a complete sentence-like string, add '요'
    if (result === trimmed && /[가-힣]$/.test(result)) {
        result += "요";
    }

    return result;
}

/**
 * Normalizes and formalizes Korean text.
 */
export function formalizeKo(text: string): string {
    // 1. Pre-process known informal patterns
    // 2. Natural Contextual Mapping (실생활 현장 번역 지침 반영)
    const naturalMapping: Record<string, string> = {
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
        "밥": "식사",
        "먹어": "드세요.",
        "자": "주무세요.",
    };

    const trimmed = text.trim();
    if (naturalMapping[trimmed]) return naturalMapping[trimmed];

    // 3. Apply common informal to formal word replacements within sentences
    const wordMap: Record<string, string> = {
        "너": "선생님",
        "나": "저",
        "우리": "저희",
        "애": "아이",
        "개": "것",
    };

    let formalized = trimmed;
    for (const [informal, formal] of Object.entries(wordMap)) {
        // This simple replacement might not be robust for all cases (e.g., "너는" vs "너")
        // A more advanced NLP approach would be needed for full sentence parsing.
        formalized = formalized.replace(new RegExp(`\\b${informal}\\b`, 'g'), formal);
    }

    return ensurePoliteKo(formalized);
}

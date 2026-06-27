export const runtime = "nodejs";

export function isPocEnabled() {
    return process.env.NODE_ENV !== "production" || process.env.POC_AI_LAB_ENABLED === "true";
}

export function masked(value?: string) {
    if (!value) return { configured: false };
    const trimmed = value.trim();
    return {
        configured: trimmed.length > 0,
        preview: trimmed.length <= 8 ? "set" : `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
    };
}

export function getGeminiKey() {
    return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GOOGLE_CLOUD_API_KEY ||
        ""
    ).trim();
}

export function normalizeLang(code: string) {
    const map: Record<string, string> = {
        jp: "ja",
        zh: "zh-CN",
        ph: "tl",
    };
    return map[code] || code;
}

import { NextRequest, NextResponse } from "next/server";
import { getGeminiKey, isPocEnabled, normalizeLang } from "../_utils";

export const runtime = "nodejs";

type Provider = "google" | "gemini" | "deepl";

async function translateWithGoogle(text: string, sl: string, tl: string) {
    const key = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!key) throw new Error("Missing GOOGLE_CLOUD_API_KEY");

    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: normalizeLang(sl), target: normalizeLang(tl), format: "text" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Google Translate failed (${res.status})`);
    return data?.data?.translations?.[0]?.translatedText || "";
}

async function translateWithGemini(text: string, sl: string, tl: string) {
    const key = getGeminiKey();
    if (!key) throw new Error("Missing GEMINI_API_KEY or GOOGLE_AI_API_KEY");
    const model = process.env.GEMINI_TRANSLATE_MODEL || "gemini-3.5-flash";
    const prompt = [
        "You are a professional construction-site interpreter.",
        "Translate only the source text. Do not explain.",
        "Preserve numbers, units, floor names, worker names, equipment names, and safety warnings.",
        `Source language: ${sl}`,
        `Target language: ${tl}`,
        `Text: ${text}`,
    ].join("\n");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Gemini failed (${res.status})`);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function deeplLang(code: string, isTarget: boolean) {
    const normalized = normalizeLang(code).toUpperCase();
    const map: Record<string, string> = {
        "ZH-CN": "ZH",
        JA: "JA",
        KO: "KO",
        EN: isTarget ? "EN-US" : "EN",
    };
    return map[normalized] || normalized;
}

async function translateWithDeepL(text: string, sl: string, tl: string) {
    const key = process.env.DEEPL_API_KEY?.trim();
    if (!key) throw new Error("Missing DEEPL_API_KEY");
    const apiUrl = process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
    const body = new URLSearchParams({
        text,
        source_lang: deeplLang(sl, false),
        target_lang: deeplLang(tl, true),
    });

    const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
            Authorization: `DeepL-Auth-Key ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `DeepL failed (${res.status})`);
    return data?.translations?.[0]?.text || "";
}

export async function POST(request: NextRequest) {
    if (!isPocEnabled()) {
        return NextResponse.json({ error: "POC_DISABLED" }, { status: 404 });
    }

    const started = Date.now();
    try {
        const { provider, text, sl = "ko", tl = "en" } = await request.json() as {
            provider?: Provider;
            text?: string;
            sl?: string;
            tl?: string;
        };
        if (!provider || !["google", "gemini", "deepl"].includes(provider)) {
            return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
        }
        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }
        if (text.length > 5000) {
            return NextResponse.json({ error: "Text too long" }, { status: 400 });
        }

        const translated =
            provider === "google" ? await translateWithGoogle(text, sl, tl) :
            provider === "gemini" ? await translateWithGemini(text, sl, tl) :
            await translateWithDeepL(text, sl, tl);

        return NextResponse.json({
            provider,
            sl,
            tl,
            translated,
            latency_ms: Date.now() - started,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unknown error",
            latency_ms: Date.now() - started,
        }, { status: 500 });
    }
}

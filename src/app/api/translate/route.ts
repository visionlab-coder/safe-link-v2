import { NextRequest, NextResponse } from 'next/server';
import { fetchGlossaryFromDB } from '@/utils/normalize';
import { getErrorMessage } from '@/utils/errors';

interface CloudTranslateResponse {
    data?: { translations?: Array<{ translatedText?: string }> };
    error?: { message?: string };
}

interface GeminiResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
}

/**
 * 하이브리드 번역 API
 * 1단계: Google Cloud Translation API (0.3초, 고품질 번역)
 * 2단계: Gemini 2.5 Flash (발음 + 역번역) — 1단계와 병렬 실행
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();

    if (!apiKey) {
        return NextResponse.json({ error: "Missing GOOGLE_CLOUD_API_KEY" }, { status: 500 });
    }

    try {
        const { text, sl, tl } = await request.json();

        if (!text || !sl || !tl) {
            return NextResponse.json({ error: "Missing required texts" }, { status: 400 });
        }

        if (typeof text !== 'string' || text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 characters)" }, { status: 400 });
        }

        // 건설 현장 용어집: 출발어가 한국어일 때만 적용 (은어→표준어 치환)
        let processedText = text;
        if (sl === 'ko') {
            const glossary = await fetchGlossaryFromDB();
            for (const [slang, std] of Object.entries(glossary)) {
                processedText = processedText.replace(new RegExp(slang, 'g'), std as string);
            }
        }

        // 언어 코드 매핑 (앱 내부 코드 → Google API 코드)
        const langMap: Record<string, string> = {
            ko: 'ko', vi: 'vi', zh: 'zh-CN', th: 'th', uz: 'uz',
            ph: 'tl', km: 'km', id: 'id', mn: 'mn', my: 'my',
            ne: 'ne', bn: 'bn', kk: 'kk', ru: 'ru', en: 'en',
            jp: 'ja', fr: 'fr', es: 'es', ar: 'ar', hi: 'hi',
        };
        const sourceLang = langMap[sl] || sl;
        const targetLang = langMap[tl] || tl;

        // === 병렬 실행: 번역 + (발음/역번역) ===
        const translatePromise = fetch(
            `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: processedText, source: sourceLang, target: targetLang, format: 'text' }),
            }
        ).then(r => r.json() as Promise<CloudTranslateResponse>);

        // 역번역도 Cloud Translation으로 병렬 실행 (번역 결과 필요하므로 체이닝)
        const translated = await translatePromise;
        const translatedText = translated.data?.translations?.[0]?.translatedText;

        if (!translatedText) {
            // Cloud Translation 실패 시 Gemini fallback
            return await geminiFullFallback(apiKey, processedText, sl, tl);
        }

        // 역번역 + 발음을 병렬로 요청 (발음은 1.5초 타임아웃)
        const [reverseResult, pronResult] = await Promise.all([
            // 역번역: Cloud Translation (초고속)
            fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: translatedText, source: targetLang, target: sourceLang, format: 'text' }),
            }).then(r => r.json() as Promise<CloudTranslateResponse>),

            // 발음: Gemini (1.5초 내 응답 못하면 빈 값)
            Promise.race([
                generatePronunciation(apiKey, translatedText, text, sl, tl),
                new Promise<string>(resolve => setTimeout(() => resolve(""), 1500)),
            ]),
        ]);

        const reverseTranslated = reverseResult.data?.translations?.[0]?.translatedText || "";

        return NextResponse.json({
            translated: translatedText,
            pronunciation: pronResult,
            reverse_translated: reverseTranslated,
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Translation API] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Gemini로 한글 발음 생성 (경량 요청) */
async function generatePronunciation(apiKey: string, translatedText: string, originalText: string, sl: string, tl: string): Promise<string> {
    try {
        const pronTarget = tl === 'ko' ? originalText : translatedText;
        const pronLang = tl === 'ko' ? sl : tl;
        const prompt = `Write the Korean Hangul pronunciation of this ${pronLang} text. Return ONLY the pronunciation, nothing else.\nText: ${JSON.stringify(pronTarget)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
                }),
                signal: controller.signal,
            }
        );
        clearTimeout(timeoutId);

        if (!response.ok) return "";
        const data = await response.json() as GeminiResponse;
        const parts = data.candidates?.[0]?.content?.parts || [];
        const result = parts[parts.length - 1]?.text?.trim() || "";
        return result.replace(/```/g, '').replace(/\n/g, ' ').trim();
    } catch {
        return "";
    }
}

/** Gemini 풀 fallback (Cloud Translation 실패 시) */
async function geminiFullFallback(apiKey: string, text: string, sl: string, tl: string) {
    try {
        const prompt = `Translate accurately. Source: ${sl}, Target: ${tl}.
Return ONLY JSON: {"translated":"...","pronunciation":"Korean Hangul pronunciation","reverse_translated":"..."}
Text: ${JSON.stringify(text)}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2 },
                }),
            }
        );

        if (!response.ok) {
            return NextResponse.json({ translated: text, pronunciation: "API Offline", reverse_translated: text, is_fallback: true });
        }

        const data = await response.json() as GeminiResponse;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) throw new Error("Empty response");

        const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) throw new Error("No JSON");
        const parsed = JSON.parse(jsonMatch[1]);

        return NextResponse.json({
            translated: parsed.translated || text,
            pronunciation: parsed.pronunciation || "",
            reverse_translated: parsed.reverse_translated || "",
        });
    } catch {
        return NextResponse.json({ translated: text, pronunciation: "Offline", reverse_translated: text, is_fallback: true });
    }
}

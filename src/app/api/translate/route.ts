import { NextRequest, NextResponse } from 'next/server';
import { fetchGlossaryFromDB } from '@/utils/normalize';
import { getErrorMessage } from '@/utils/errors';

interface GeminiTranslateResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

interface TranslationPayload {
    translated?: string;
    pronunciation?: string;
    reverse_translated?: string;
}

/**
 * AI 기반 고급 번역 (Gemini 2.0 Flash)
 * 건설 현장의 은어나 전문 용어를 문맥에 맞게 완벽히 번역 및 역번역합니다.
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

        // 건설 현장 용어집: 출발어가 한국어일 때만 적용
        let glossaryNote = "";
        if (sl === 'ko') {
            const glossary = await fetchGlossaryFromDB();
            const glossaryStr = Object.entries(glossary).map(([slang, std]) => `"${slang}"→"${std}"`).join(', ');
            glossaryNote = `\nIf the Korean source text contains any of these slang terms, use the standard meaning for translation: ${glossaryStr}\n`;
        }

        const pronInstruction = tl === 'ko'
            ? `Write the Korean Hangul pronunciation of the ORIGINAL ${sl} text (e.g. '你好'→'니하오', 'Hello'→'헬로').`
            : `Write the Korean Hangul pronunciation of the TRANSLATED ${tl} text (so a Korean reader can pronounce it).`;

        const prompt = `You are a professional translator. Translate the given text accurately and naturally.
Source language: ${sl}
Target language: ${tl}
VERY IMPORTANT: The "translated" field MUST be entirely and exclusively in ${tl}. Do not mix in English or any other language.
STRICT RULE: Do NOT include any emojis or emoticons in the output. The text must be clean so TTS engines do not read emoji descriptions.
${glossaryNote}
Return ONLY a JSON object with exactly these three fields:
{
  "translated": "<accurate translation of the source text exclusively into ${tl}>",
  "pronunciation": "<${pronInstruction}>",
  "reverse_translated": "<translate 'translated' back into ${sl}>"
}

Source text: ${JSON.stringify(text)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                    }
                }),
                signal: controller.signal,
            }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            
            // 🚨 CRITICAL FALLBACK for Demo Stability
            // If Gemini fails, we return the original text so the UI doesn't crash.
            return NextResponse.json({
                translated: text,
                pronunciation: "API Offline",
                reverse_translated: text,
                is_fallback: true
            });
        }

        const data = await response.json() as GeminiTranslateResponse;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) throw new Error("Empty Gemini response");

        // JSON 블록 추출 (```json ... ``` 또는 { ... } 형태 모두 처리)
        const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) throw new Error("No JSON in response");
        const parsed = JSON.parse(jsonMatch[1]) as TranslationPayload;

        return NextResponse.json({
            translated: parsed.translated || text,
            pronunciation: parsed.pronunciation || "",
            reverse_translated: parsed.reverse_translated || ""
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Translation API] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { fetchGlossaryFromDB } from '@/utils/normalize';

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

        // 건설 현장 용어집 로드
        const glossary = await fetchGlossaryFromDB();
        const glossaryStr = Object.entries(glossary).map(([slang, std]) => `${slang}=${std}`).join(', ');

        const prompt = `You are a professional construction site supervisor and interpreter.
Translate the following text from [${sl}] to [${tl}].
Be aware that the text may contain Korean construction slang (e.g., Japanese remnants like 공구리, 다루끼).
Here is a reference dictionary of slang:
{ ${glossaryStr} }

Instructions:
1. 'translated': Translate naturally into the target language ([${tl}]). Recognize slang from the dictionary (e.g., '공구리' means 'concrete') and translate its STANDARD meaning to the target language context perfectly.
2. 'pronunciation': The phonetic reading of the 'translated' text. 
   - IF [${sl}] is 'ko', you MUST write the pronunciation strictly in Korean Hangul (e.g., "베똥" instead of "bê tông").
   - IF [${tl}] is 'ko', write the pronunciation in the [${sl}] native alphabet or English Romanization so the foreign worker can read the Korean sounds.
3. 'reverse_translated': Translate the 'translated' text back to [${sl}] strictly based on its literal meaning array to verify accuracy.

Respond EXACTLY in this JSON format ONLY (No markdown formatting or backticks around it):
{
    "translated": "...",
    "pronunciation": "...",
    "reverse_translated": "..."
}

Text to translate:
"${text}"
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.1, // 현장 용어이므로 사실 관계를 위해 낮은 temperature
                    }
                })
            }
        );

        if (!response.ok) {
            console.error("Gemini API Error:", await response.text());
            return NextResponse.json({ error: "Translation API failed" }, { status: 500 });
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) throw new Error("Empty Gemini response");

        const parsed = JSON.parse(textContent);

        return NextResponse.json({
            translated: parsed.translated || text,
            pronunciation: parsed.pronunciation || "",
            reverse_translated: parsed.reverse_translated || ""
        });
    } catch (e: any) {
        console.error("[Translation API] Error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

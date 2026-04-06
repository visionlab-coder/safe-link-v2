import { NextRequest, NextResponse } from 'next/server';

interface GeminiResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
}

/**
 * POST: Translate quiz question + options to target language using Gemini
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { question, options, targetLang } = await request.json();

        if (!question || !options || !targetLang) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        if (targetLang === 'ko') {
            return NextResponse.json({ question, options });
        }

        const langNames: Record<string, string> = {
            ko: '한국어', en: 'English', zh: '中文', vi: 'Tiếng Việt',
            th: 'ภาษาไทย', uz: "O'zbek", ph: 'Filipino', ru: 'Русский',
            jp: '日本語', km: 'ខ្មែរ', id: 'Bahasa Indonesia', mn: 'Монгол',
            my: 'မြန်မာ', ne: 'नेपाली', bn: 'বাংলা', kk: 'Қазақ',
            fr: 'Français', es: 'Español', ar: 'العربية', hi: 'हिन्दी',
        };

        const prompt = `Translate this construction safety quiz to ${langNames[targetLang] || targetLang}.
Return ONLY JSON: {"question":"translated question","options":["option1","option2","option3","option4"]}

Korean question: ${question}
Korean options: ${JSON.stringify(options)}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
                }),
            }
        );

        if (!response.ok) {
            return NextResponse.json({ question, options });
        }

        const data = await response.json() as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return NextResponse.json({ question, options });

        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) return NextResponse.json({ question, options });

        const parsed = JSON.parse(jsonMatch[1]);
        return NextResponse.json({
            question: parsed.question || question,
            options: parsed.options || options,
        });
    } catch {
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}

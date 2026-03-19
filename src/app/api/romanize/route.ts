import { NextRequest, NextResponse } from 'next/server';

interface GeminiResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
}

/**
 * 외국인 이름을 영문(로마자)으로 변환
 * 예: 김철수 → Kim Cheol-su, Nguyễn Văn A → Nguyen Van A
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({ error: "Missing GOOGLE_CLOUD_API_KEY" }, { status: 500 });
    }

    let name: string;
    let lang: string;
    try {
        const body = await request.json() as { name?: string; lang?: string };
        name = body.name ?? "";
        lang = body.lang ?? "";
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!name?.trim()) {
        return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // 이미 순수 라틴 문자인 경우 그대로 반환
    const isLatin = /^[a-zA-Z\s\-'.]+$/.test(name.trim());
    if (isLatin) {
        return NextResponse.json({ romanized: name.trim() });
    }

    const prompt = `You are a name romanization expert.
Convert the following person's name into standard English romanization (Latin alphabet).
Source language: ${lang}
Name: "${name}"

Rules:
- Output ONLY the romanized name, nothing else
- Use standard romanization for the given language (e.g. Korean: Revised Romanization, Chinese: Pinyin, Japanese: Hepburn)
- Capitalize each word
- No explanations, no punctuation except hyphens within syllables if standard
- If the name is already in Latin script, clean it up (remove diacritics for readability)

Romanized name:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 64 }
                })
            }
        );

        if (!response.ok) {
            return NextResponse.json({ romanized: null });
        }

        const data = await response.json() as GeminiResponse;
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        const romanized = raw.replace(/^["']|["']$/g, "").trim();

        return NextResponse.json({ romanized: romanized || null });
    } catch {
        return NextResponse.json({ romanized: null });
    }
}

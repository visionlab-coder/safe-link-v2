import { NextRequest, NextResponse } from 'next/server';
import { getCookieUser } from "@/utils/auth/cookie-user";

export const runtime = "nodejs";

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
    // P5 박제
    const user = await getCookieUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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

    // Sanitize inputs to prevent LLM prompt injection
    // name: strip control characters, limit to 100 chars
    const safeName = name.trim().slice(0, 100).replace(/[\x00-\x1f\x7f]/g, '');
    // lang: allowlist of valid BCP-47-style language codes only
    const safeLang = /^[a-z]{2,5}$/.test((lang ?? '').trim()) ? lang.trim() : 'unknown';

    // User values are placed inside a JSON block so they are clearly data,
    // not instructions, making prompt injection ineffective.
    const prompt = `You are a name romanization expert. Convert the name to standard English romanization.

Input (JSON):
${JSON.stringify({ language: safeLang, name: safeName })}

Rules:
- Output ONLY the romanized name in plain text. No explanations.
- Use standard romanization for the given language (e.g. Korean: Revised Romanization, Chinese: Pinyin, Japanese: Hepburn)
- Capitalize each word
- No punctuation except hyphens within syllables if standard`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

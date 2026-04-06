import { NextRequest, NextResponse } from 'next/server';

interface GeminiVisionResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
}

export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { image, lang } = await request.json();

        if (!image) {
            return NextResponse.json({ error: "No image data" }, { status: 400 });
        }

        // 5MB limit for base64 image
        if (typeof image !== 'string' || image.length > 5 * 1024 * 1024 * (4 / 3)) {
            return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 413 });
        }

        const targetLang = lang || 'ko';

        const langNames: Record<string, string> = {
            ko: '한국어', en: 'English', zh: '中文', vi: 'Tiếng Việt',
            th: 'ภาษาไทย', uz: "O'zbek", ph: 'Filipino', ru: 'Русский',
            jp: '日本語', km: 'ខ្មែរ', id: 'Bahasa Indonesia', mn: 'Монгол',
            my: 'မြန်မာ', ne: 'नेपाली', bn: 'বাংলা', kk: 'Қазақ',
            fr: 'Français', es: 'Español', ar: 'العربية', hi: 'हिन्दी',
        };
        const langName = langNames[targetLang] || 'English';

        const prompt = `You are a construction site safety expert analyzing a photo from a construction site.

Identify ALL construction-related objects, equipment, materials, and potential hazards visible in this image.

For each identified item, provide:
1. name_ko: Korean name
2. name_local: Name in ${langName} (${targetLang})
3. category: one of "equipment", "material", "hazard", "ppe", "structure", "tool"
4. risk_level: "safe", "caution", "danger"
5. safety_note_ko: Brief safety note in Korean (1 sentence)
6. safety_note_local: Same safety note in ${langName}

Return ONLY valid JSON array. No markdown, no explanation.
Example: [{"name_ko":"안전모","name_local":"Safety Helmet","category":"ppe","risk_level":"safe","safety_note_ko":"반드시 착용하세요","safety_note_local":"Must be worn at all times"}]

If no construction-related items are found, return an empty array: []`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'image/jpeg', data: image } }
                        ]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Vision API] Gemini error:", errorText);
            return NextResponse.json({ error: "Vision API failed" }, { status: 502 });
        }

        const data = await response.json() as GeminiVisionResponse;
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            return NextResponse.json({ items: [] });
        }

        // Parse JSON from response (handle markdown code blocks)
        const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch) {
            return NextResponse.json({ items: [] });
        }

        const items = JSON.parse(jsonMatch[1]);
        return NextResponse.json({ items });
    } catch (error) {
        console.error("[Vision API] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCookieUser } from "@/utils/auth/cookie-user";
import { checkQuizTranslateLimit } from "@/utils/rate-limit";
import { callV3AiVendor } from "@/utils/ai/v3-ai-gateway";

export const runtime = "nodejs";

/**
 * POST: Translate quiz question + options through the Spring AI Gateway
 */
export async function POST(request: NextRequest) {
    // P5 박제
    const user = await getCookieUser({ allowV3: true });
    if (!user) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!(await checkQuizTranslateLimit(user.id))) {
        return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const siteId = user.siteIds?.[0];
    if (typeof siteId !== "number") return NextResponse.json({ error: "site_required" }, { status: 403 });

    try {
        const body = await request.json();
        const { question, options, targetLang } = body;

        if (!question || !options || !targetLang) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }
        if (typeof question !== 'string' || question.length > 500) {
            return NextResponse.json({ error: "question too long" }, { status: 400 });
        }
        if (!Array.isArray(options) || options.length > 6 || options.some(o => typeof o !== 'string' || o.length > 200)) {
            return NextResponse.json({ error: "invalid options" }, { status: 400 });
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

        const result = await callV3AiVendor(request, {
            feature: "quiz",
            siteId,
            provider: "openai-prompt",
            sourceLanguage: "ko",
            targetLanguage: targetLang,
            text: `${question}\n${options.join("\n")}`,
            prompt,
            maxOutputTokens: 512,
            temperature: 0.1,
        });
        const text = result?.text;
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

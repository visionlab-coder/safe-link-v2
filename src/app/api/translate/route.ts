import { NextRequest, NextResponse } from 'next/server';
import { fetchGlossaryFromDB } from '@/utils/normalize';
import { getErrorMessage } from '@/utils/errors';
import { hangulize } from '@/utils/hangulize';
import pinyin from 'tiny-pinyin';
import { preProcessWithGlossary } from '@/utils/construction-glossary';
import { formalizeKo } from '@/utils/politeness';

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

        // 건설 현장 용어집 전처리
        let processedText = text;
        if (sl === 'ko') {
            // 한국어 출발: 은어→표준어 치환
            const glossary = await fetchGlossaryFromDB();
            for (const [slang, std] of Object.entries(glossary)) {
                processedText = processedText.replace(new RegExp(slang, 'g'), std as string);
            }
        } else if (tl === 'ko') {
            // 외국어→한국어: 건설 전문 용어를 한국어로 치환 후 번역 (품질 향상)
            processedText = preProcessWithGlossary(text, sl);
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

        // === 1. Naver Papago (아시아권 언어 고품질 번역) ===
        const NAVER_ID = process.env.NAVER_CLIENT_ID?.trim();
        const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET?.trim();
        
        // 파파고 지원 언어 목록
        const papagoLangs = ['ko', 'en', 'zh-CN', 'vi', 'id', 'th', 'ru', 'ja', 'fr', 'es'];
        const usePapago = NAVER_ID && NAVER_SECRET && papagoLangs.includes(sourceLang) && papagoLangs.includes(targetLang);

        let translatedText = "";
        let engine = "google";

        if (usePapago) {
            try {
                const papagoRes = await fetch('https://papago.apigw.ntruss.com/nmt/v1/translation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-NCP-APIGW-API-KEY-ID': NAVER_ID!,
                        'X-NCP-APIGW-API-KEY': NAVER_SECRET!,
                    },
                    body: new URLSearchParams({
                        source: sourceLang,
                        target: targetLang,
                        text: processedText,
                    }),
                });

                if (papagoRes.ok) {
                    const papagoData = await papagoRes.json();
                    translatedText = papagoData.message?.result?.translatedText || "";
                    if (translatedText) engine = "papago";
                }
            } catch (err) {
                console.error("[Translation API] Papago error, falling back to Google:", err);
            }
        }

        // === 2. Google Cloud Translation (기본 및 폴백) ===
        if (!translatedText) {
            const cloudTranslate = (q: string, source: string, target: string) =>
                fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q, source, target, format: 'text' }),
                }).then(r => r.json() as Promise<CloudTranslateResponse>);

            const translated = await cloudTranslate(processedText, sourceLang, targetLang);
            translatedText = translated.data?.translations?.[0]?.translatedText || "";
        }

        if (!translatedText) {
            return await geminiFullFallback(apiKey, processedText, sl, tl);
        }

        // === 3. 역번역 및 발음 처리 (Google로 통일하여 속도 확보) ===
        const cloudTranslateFast = (q: string, source: string, target: string) =>
            fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q, source, target, format: 'text' }),
            }).then(r => r.json() as Promise<CloudTranslateResponse>);

        // 2단계: 역번역 + 발음 생성을 완전 병렬 실행
        const pronTarget = tl === 'ko' ? processedText : translatedText;
        const pronLang = tl === 'ko' ? sl : tl;
        const isChinese = pronLang === 'zh' || pronLang === 'zh-CN';
        const isLatinScript = /^[a-zA-Z\s\-.,!?'"()0-9\u00C0-\u024F\u1E00-\u1EFF]+$/.test(
            pronTarget.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );
        const needsEnglishBridge = !isLatinScript && !isChinese;

        const [reverseResult, pronEnglish] = await Promise.all([
            cloudTranslateFast(translatedText, targetLang, sourceLang),
            needsEnglishBridge
                ? cloudTranslateFast(pronTarget, (tl === 'ko' ? sourceLang : targetLang), 'en')
                : Promise.resolve(null),
        ]);

        const reverseTranslated = reverseResult.data?.translations?.[0]?.translatedText || "";

        // 한글 발음 생성 (CPU only, 0ms)
        let pronunciation: string;
        if (isChinese) {
            const py = pinyin.isSupported()
                ? pinyin.convertToPinyin(pronTarget, ' ', true)
                : pronTarget;
            pronunciation = hangulize(py, 'zh');
        } else if (isLatinScript) {
            pronunciation = hangulize(pronTarget, pronLang);
        } else {
            const englishText = pronEnglish?.data?.translations?.[0]?.translatedText || "";
            pronunciation = englishText ? hangulize(englishText, 'en') : "";
        }

        // 한국어 결과는 존대말(경어)로 변환
        const finalTranslated = tl === 'ko' ? formalizeKo(translatedText) : translatedText;
        // 역번역은 원래 언어로 돌아가므로, 한국어로 돌아오는 경우 존대말 적용
        const finalReverse = sl === 'ko' ? formalizeKo(reverseTranslated) : reverseTranslated;

        return NextResponse.json({
            translated: finalTranslated,
            pronunciation,
            reverse_translated: finalReverse,
            engine
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Translation API] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
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

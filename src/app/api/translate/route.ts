import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { createServiceClient } from '@/utils/supabase/service';
import { createClient } from '@/utils/supabase/server';
import { verifyTravelToken } from '@/lib/travel-auth';
import { checkTranslateLimit } from '@/utils/rate-limit';
import { CONSTRUCTION_GLOSSARY } from '@/constants/glossary';
import { getErrorMessage } from '@/utils/errors';
import { hangulize } from '@/utils/hangulize';
import { stripEmoji } from '@/utils/strip-emoji';
import pinyin from 'tiny-pinyin';
import { preProcessWithGlossary } from '@/utils/construction-glossary';
import { formalizeKo } from '@/utils/politeness';
import {
    PAPAGO_TIMEOUT_MS,
    GOOGLE_TRANSLATE_TIMEOUT_MS,
    GEMINI_TRANSLATE_TIMEOUT_MS,
    GEMINI_PRONUNCIATION_TIMEOUT_MS,
} from '@/constants/quality-config';

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
    // 인증: travel_token (Travel Talk 흐름) 또는 Supabase 세션
    const authHeader = request.headers.get('authorization');
    let rateLimitKey: string;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (!verifyTravelToken(token)) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }
        // travel token은 IP 기반 제한
        rateLimitKey = `ip:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"}`;
    } else {
        const supa = await createClient();
        const { data: { user }, error: userErr } = await supa.auth.getUser();
        if (userErr || !user) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }
        rateLimitKey = `uid:${user.id}`;
    }

    if (!(await checkTranslateLimit(rateLimitKey))) {
        return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();

    if (!apiKey) {
        return NextResponse.json({ error: "Missing GOOGLE_CLOUD_API_KEY" }, { status: 500 });
    }

    try {
        const { text, sl, tl, fast, pronunciation: includePronunciation = true, useGlossary = false } = await request.json();

        if (!text || !sl || !tl) {
            return NextResponse.json({ error: "Missing required texts" }, { status: 400 });
        }

        if (typeof text !== 'string' || text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 characters)" }, { status: 400 });
        }

        // 건설 현장 용어집 전처리 — useGlossary=true 로 명시한 호출(TBM/안전지시)에만 적용
        // 일반 채팅(밥 먹으러 가자 등)에는 건설 용어집 불필요 — 오역 방지
        let processedText = text;
        if (useGlossary && sl === 'ko') {
            const glossary = await fetchGlossaryServer();
            for (const [slang, std] of Object.entries(glossary)) {
                const escapedSlang = slang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                processedText = processedText.replace(new RegExp(escapedSlang, 'g'), std as string);
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
                const papagoCtrl = new AbortController();
                const papagoTimeout = setTimeout(() => papagoCtrl.abort(), PAPAGO_TIMEOUT_MS);
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
                    signal: papagoCtrl.signal,
                });
                clearTimeout(papagoTimeout);

                if (papagoRes.ok) {
                    const papagoData = await papagoRes.json();
                    translatedText = papagoData.message?.result?.translatedText || "";
                    if (translatedText) engine = "papago";
                }
            } catch (err) {
                console.error("[Translation API] Papago error, falling back to Google:", err);
            }
        }

        // === 1.5. Gemini 건설현장 번역 (비Papago 언어: uz/km/my/ne/bn/kk/ar/hi/mn/tl) ===
        // Google 단독으로는 건설 안전 문맥 없이 직역 → 오역/오해 위험
        // fast 여부와 무관하게 항상 Gemini 우선 사용 (라이브 통역에서도 정확도 보장)
        if (!translatedText && !usePapago) {
            const geminiTranslated = await geminiConstructionTranslate(processedText, sl, tl, apiKey);
            if (geminiTranslated) {
                translatedText = geminiTranslated;
                engine = "gemini";
            }
        }

        // === 2. Google Cloud Translation (기본 및 폴백) ===
        if (!translatedText) {
            const googleCtrl = new AbortController();
            const googleTimeout = setTimeout(() => googleCtrl.abort(), GOOGLE_TRANSLATE_TIMEOUT_MS);
            const cloudTranslate = (q: string, source: string, target: string) =>
                fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q, source, target, format: 'text' }),
                    signal: googleCtrl.signal,
                }).then(r => r.json() as Promise<CloudTranslateResponse>);

            try {
                const translated = await cloudTranslate(processedText, sourceLang, targetLang);
                clearTimeout(googleTimeout);
                translatedText = translated.data?.translations?.[0]?.translatedText || "";
            } catch (err) {
                clearTimeout(googleTimeout);
                console.error("[Translation API] Google Translate error:", err);
            }
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
        // fast=true: Gemini 발음 생성 스킵 → 번역 즉시 반환 (실시간 통역 폴백 경로 고속화)
        const shouldGeneratePronunciation = includePronunciation !== false && !fast;
        const pronTarget = tl === 'ko' ? processedText : translatedText;
        const pronLang = tl === 'ko' ? sl : tl;
        const isChinese = pronLang === 'zh' || pronLang === 'zh-CN';
        const isJapanese = pronLang === 'ja' || pronLang === 'jp';
        const isThai = pronLang === 'th';
        // 나머지 비라틴 언어: 키릴·아랍·데바나가리·크메르·버마·벵골
        const nonLatinLangs = new Set(['km', 'mn', 'my', 'ne', 'bn', 'kk', 'ru', 'ar', 'hi']);
        const isLatinScript = /^[a-zA-Z\s\-.,!?'"()0-9\u00C0-\u024F\u1E00-\u1EFF]+$/.test(
            pronTarget.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );
        const isNonLatinOther = nonLatinLangs.has(pronLang) && !isLatinScript;
        const needsEnglishBridge = !isLatinScript && !isChinese && !isJapanese && !isThai && !isNonLatinOther;

        const [reverseResult, pronEnglish, chinesePron, japPron, thaiPron, nonLatinPron] = await Promise.all([
            cloudTranslateFast(translatedText, targetLang, sourceLang),
            (shouldGeneratePronunciation && needsEnglishBridge)
                ? cloudTranslateFast(pronTarget, (tl === 'ko' ? sourceLang : targetLang), 'en')
                : Promise.resolve(null),
            (shouldGeneratePronunciation && isChinese)
                ? generateChinesePronunciation(apiKey, pronTarget)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isJapanese)
                ? generateJapanesePronunciation(apiKey, pronTarget)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isThai)
                ? generateThaiPronunciation(apiKey, pronTarget)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isNonLatinOther)
                ? generateNonLatinPronunciation(apiKey, pronTarget, pronLang)
                : Promise.resolve(""),
        ]);

        const reverseTranslated = reverseResult.data?.translations?.[0]?.translatedText || "";

        // 한글 발음 생성
        let pronunciation: string;
        if (!shouldGeneratePronunciation) {
            pronunciation = "";
        } else if (isChinese) {
            if (chinesePron) {
                pronunciation = chinesePron;
            } else {
                const py = pinyin.isSupported()
                    ? pinyin.convertToPinyin(pronTarget, ' ', true)
                    : pronTarget;
                pronunciation = hangulize(py, 'zh');
            }
        } else if (isJapanese) {
            const raw = japPron || hangulize(pronTarget, 'ja');
            // 한글·공백·구두점만 허용 — 한자·가나 제거
            pronunciation = raw.replace(/[^\uAC00-\uD7A3\s.,!?]/g, "").trim();
        } else if (isThai) {
            pronunciation = thaiPron || hangulize(pronTarget, 'th');
        } else if (isNonLatinOther) {
            pronunciation = nonLatinPron || "";
        } else if (isLatinScript) {
            pronunciation = hangulize(pronTarget, pronLang);
        } else {
            const englishText = pronEnglish?.data?.translations?.[0]?.translatedText || "";
            pronunciation = englishText ? hangulize(englishText, 'en') : "";
        }

        // 한국어 결과는 존대말(경어)로 변환
        const finalTranslated = stripEmoji(tl === 'ko' ? formalizeKo(translatedText) : translatedText);
        // 역번역은 원래 언어로 돌아가므로, 한국어로 돌아오는 경우 존대말 적용
        const finalReverse = stripEmoji(sl === 'ko' ? formalizeKo(reverseTranslated) : reverseTranslated);

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


/** 서버사이드 glossary fetch — 서비스 롤 클라이언트로 RLS 우회 */
let _serverGlossaryCache: Record<string, string> | null = null;

async function fetchGlossaryServer(): Promise<Record<string, string>> {
    if (_serverGlossaryCache) return _serverGlossaryCache;
    try {
        const sb = createServiceClient();
        const { data, error } = await sb
            .from('construction_glossary')
            .select('slang, standard')
            .eq('is_active', true);
        if (error || !data?.length) {
            _serverGlossaryCache = CONSTRUCTION_GLOSSARY;
        } else {
            const dict: Record<string, string> = { ...CONSTRUCTION_GLOSSARY };
            for (const row of data) dict[row.slang] = row.standard;
            _serverGlossaryCache = dict;
            console.info(`[translate] DB glossary 로드: ${data.length}개`);
        }
    } catch {
        _serverGlossaryCache = CONSTRUCTION_GLOSSARY;
    }
    return _serverGlossaryCache;
}

/** 중국어 → 한글 발음 생성 (Gemini 2.5 Flash, 국립국어원 표준 기반) */
async function generateChinesePronunciation(apiKey: string, chineseText: string): Promise<string> {
    if (!chineseText || chineseText.length > 2000) return "";
    try {
        const prompt = `다음 중국어 텍스트를 **한국어 한글로 읽는 발음**으로 변환해주세요.

규칙:
1. 국립국어원 외래어 표기법 (중국어) 기준
2. 병음(pinyin)을 한글로 자연스럽게 표기 (예: 你好 → 니하오, 谢谢 → 씨에씨에, 中国 → 쭝궈)
3. 건설 현장 전문 용어도 정확하게 (예: 安全帽 → 안취안마오, 钢筋 → 깡진, 混凝土 → 훈닝투)
4. 띄어쓰기는 원문 단위 유지
5. 한국어로 발음하기 쉽게, 외국어 티가 나지 않게
6. 발음 결과만 반환, 설명·따옴표·원문 반복 금지

중국어: ${chineseText}

발음:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_PRONUNCIATION_TIMEOUT_MS);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            }
        );

        clearTimeout(timeout);
        if (!response.ok) return "";

        const data = await response.json() as GeminiResponse;
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        // 한글·공백·구두점만 허용 (혹시 라틴/한자 섞여있으면 거부)
        if (!result) return "";
        // 한글·공백·구두점만 추출 (괄호 안 원문 표기 등 비한글 제거)
        const koreanOnly = result.replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
        return koreanOnly.length >= 1 ? koreanOnly : "";
    } catch {
        return "";
    }
}

/** 일본어 → 한글 발음 생성 (Gemini 2.5 Flash, 국립국어원 표준 기반) */
async function generateJapanesePronunciation(apiKey: string, japaneseText: string): Promise<string> {
    if (!japaneseText || japaneseText.length > 2000) return "";
    try {
        const prompt = `다음 일본어 텍스트를 **한국어 한글로 읽는 발음**으로 변환해주세요.

규칙:
1. 국립국어원 외래어 표기법 (일본어) 기준
2. 히라가나·가타카나·한자 모두 한글로 변환 (예: こんにちは → 콘니치와, 安全 → 안젠, ヘルメット → 헤루멧토)
3. 건설 현장 전문 용어도 정확하게 (예: 安全帽 → 안젠보, 鉄筋 → 텟킨, コンクリート → 콘쿠리토)
4. 띄어쓰기는 원문 단위 유지
5. 발음 결과만 반환, 설명·따옴표·원문 반복 금지

일본어: ${japaneseText}

발음:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_PRONUNCIATION_TIMEOUT_MS);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            }
        );

        clearTimeout(timeout);
        if (!response.ok) return "";

        const data = await response.json() as GeminiResponse;
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!result) return "";
        const koreanOnly = result.replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
        return koreanOnly.length >= 1 ? koreanOnly : "";
    } catch {
        return "";
    }
}

/** 태국어 → 한글 발음 생성 (Gemini 2.5 Flash, 국립국어원 표준 기반) */
async function generateThaiPronunciation(apiKey: string, thaiText: string): Promise<string> {
    if (!thaiText || thaiText.length > 2000) return "";
    try {
        const prompt = `다음 태국어 텍스트를 **한국어 한글로 읽는 발음**으로 변환해주세요.

규칙:
1. 국립국어원 외래어 표기법 (태국어) 기준
2. 태국 문자를 자연스러운 한글 발음으로 변환 (예: สวัสดี → 사왓디, ขอบคุณ → 콥쿤, ความปลอดภัย → 쾀쁠럿파이)
3. 건설 현장 전문 용어도 정확하게 (예: หมวกนิรภัย → 무억니라파이, ความปลอดภัย → 쾀쁠럿파이)
4. 띄어쓰기는 원문 단위 유지
5. 발음 결과만 반환, 설명·따옴표·원문 반복 금지

태국어: ${thaiText}

발음:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_PRONUNCIATION_TIMEOUT_MS);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            }
        );

        clearTimeout(timeout);
        if (!response.ok) return "";

        const data = await response.json() as GeminiResponse;
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!result) return "";
        const koreanOnly = result.replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
        return koreanOnly.length >= 1 ? koreanOnly : "";
    } catch {
        return "";
    }
}

/** 비라틴 언어(러시아·몽골·미얀마·크메르·네팔·벵골·카자흐·아랍·힌디) → 한글 발음 */
async function generateNonLatinPronunciation(apiKey: string, text: string, lang: string): Promise<string> {
    if (!text || text.length > 2000) return "";

    const langExamples: Record<string, string> = {
        ru: "Привет→쁘리볫, спасибо→스빠씨바, безопасность→비자빠스나스찌",
        mn: "сайн байна уу→사인 바인나 우, баярлалаа→바야를라라",
        my: "မင်္ဂလာပါ→밍글라바, ကျေးဇူးတင်ပါ→제주띤빠",
        km: "ជំរាបសួរ→춤랍수어, សុខសប្បាយ→속삽바이",
        ne: "नमस्ते→나마스테, धन्यवाद→단야바드",
        bn: "আমাকে→아마케, ধন্যবাদ→다냐바드",
        kk: "сәлем→살렘, рахмет→라흐멧",
        ar: "مرحبا→마르하바, شكراً→슈크란",
        hi: "नमस्ते→나마스테, धन्यवाद→단야바드",
    };
    const examples = langExamples[lang] || "";

    try {
        const prompt = `다음 외국어 텍스트를 **한국어 한글로 읽는 발음**으로 변환해주세요.

규칙:
1. 국립국어원 외래어 표기법 기준으로 자연스러운 한글 발음
2. 발음 예시: ${examples}
3. 건설 현장 안전 용어도 정확하게 변환
4. 띄어쓰기는 원문 단위 유지
5. 발음 결과만 반환, 설명·따옴표·원문 반복 금지

텍스트: ${text}

발음:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_PRONUNCIATION_TIMEOUT_MS);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            }
        );

        clearTimeout(timeout);
        if (!response.ok) return "";

        const data = await response.json() as GeminiResponse;
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!result) return "";
        const koreanOnly = result.replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
        return koreanOnly.length >= 1 ? koreanOnly : "";
    } catch {
        return "";
    }
}

/** 건설현장 문맥 Gemini 번역 (비Papago 언어: uz, km, my, ne, bn, kk, ar, hi, mn, tl/ph) */
async function geminiConstructionTranslate(text: string, sl: string, tl: string, apiKey: string): Promise<string> {
    if (!text || text.length > 3000) return "";

    const langNames: Record<string, string> = {
        ko: '한국어', en: '영어', zh: '중국어', vi: '베트남어', id: '인도네시아어',
        th: '태국어', ru: '러시아어', ja: '일본어', jp: '일본어', fr: '프랑스어', es: '스페인어',
        uz: '우즈베크어', km: '크메르어', mn: '몽골어', my: '미얀마어', ne: '네팔어',
        bn: '벵골어', kk: '카자흐어', ar: '아랍어', hi: '힌디어', tl: '필리핀어', ph: '필리핀어',
    };
    const sourceName = langNames[sl] || sl;
    const targetName = langNames[tl] || tl;

    const prompt = `당신은 건설현장에서 일하는 외국인 근로자를 위한 안전 통역 전문가입니다.
다음 텍스트를 ${sourceName}에서 ${targetName}으로 번역하세요.

핵심 원칙 (반드시 준수):
1. 직역 금지 — 현지 근로자가 실제 쓰는 자연스러운 표현 사용
2. 건설 안전 용어는 해당 국가에서 실제 쓰이는 현지 단어로 번역
   (예: 안전모→헬멧 현지어, 안전벨트→하네스 현지어, 거푸집·철근→현지 건설 용어)
3. 안전 지시는 단순·명확하게 (문법보다 이해 우선)
4. 명령/지시는 근로자에게 정중하게, 하지만 오해 없이 직접적으로
5. 번역문만 반환 (원문·설명·따옴표 절대 불포함)

원문 (${sourceName}): ${text}

번역 (${targetName}):`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TRANSLATE_TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
                }),
            }
        );
        clearTimeout(timeout);
        if (!response.ok) return "";
        const data = await response.json() as GeminiResponse;
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } catch {
        clearTimeout(timeout);
        return "";
    }
}

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
            return NextResponse.json({ translated: text, pronunciation: "", reverse_translated: text, is_fallback: true });
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
        return NextResponse.json({ translated: text, pronunciation: "", reverse_translated: text, is_fallback: true });
    }
}

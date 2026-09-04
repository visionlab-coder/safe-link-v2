import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { getCookieUser } from '@/utils/auth/cookie-user';
import { verifyTravelToken } from '@/lib/travel-auth';
import { checkTranslateLimit } from '@/utils/rate-limit';
import { CONSTRUCTION_GLOSSARY } from '@/constants/glossary';
import { getErrorMessage } from '@/utils/errors';
import { getLabOverride } from '@/utils/lab/engine-config';
import { withMobileCors, handleMobilePreflight } from '@/utils/auth/mobile-cors';
import { hangulize } from '@/utils/hangulize';
import { stripEmoji } from '@/utils/strip-emoji';
import pinyin from 'tiny-pinyin';
import { preProcessWithGlossary } from '@/utils/construction-glossary';
import { formalizeKo } from '@/utils/politeness';
import { callInternalAiTranslate, callV3AiVendor } from '@/utils/ai/v3-ai-gateway';
import { SAFE_LINK_V3_API_BASE_URL } from '@/utils/auth/v3-proxy';

interface CloudTranslateResponse {
    data?: { translations?: Array<{ translatedText?: string }> };
    error?: { message?: string };
}

interface LocalM2M100Response {
    translated?: string;
    reverse_translated?: string;
    engine?: string;
    processing_ms?: number;
}

interface MultilingualGlossaryTerm {
    glossaryId: number;
    standard: string;
    standardCore: string;
    pivotEnglish: string;
    localTerm: string;
    language: string;
}

type V3AiVendorContext = {
    request: NextRequest;
    siteId: number;
};

/**
 * 하이브리드 번역 API
 * 1단계: Google Cloud Translation API (0.3초, 고품질 번역)
 * 2단계: Spring AI Gateway의 문맥 보정 + 역번역/발음 — 1단계와 병렬 실행
 */
async function handleTranslate(request: NextRequest): Promise<NextResponse> {
    // 인증: travel_token(Travel Talk) | 📱 모바일 Bearer JWT | 웹 cookie
    // ⚠️ travel-token도 'Bearer '라 모바일 JWT와 충돌 → X-Safe-Link-Client: mobile 로 구분 (S-005)
    const authHeader = request.headers.get('authorization');
    const isMobile = request.headers.get('x-safe-link-client') === 'mobile';
    let rateLimitKey: string;
    let v3AiVendorContext: V3AiVendorContext | null = null;
    if (authHeader?.startsWith('Bearer ') && !isMobile) {
        const token = authHeader.slice(7);
        if (!verifyTravelToken(token)) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }
        // travel token은 IP 기반 제한
        rateLimitKey = `ip:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"}`;
    } else if (isMobile) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    } else {
        // P5 박제: createServerClient.getUser() → getCookieUser() (raw JWT 파싱)
        const user = await getCookieUser({ allowV3: true });
        if (!user) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }
        rateLimitKey = `uid:${user.id}`;
        const firstSiteId = user.siteIds?.[0];
        if (user.source === "v3" && typeof firstSiteId === "number") {
            v3AiVendorContext = { request, siteId: firstSiteId };
        }
    }

    if (!(await checkTranslateLimit(rateLimitKey))) {
        return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    // 🧪 Lab 런타임 오버라이드: 운영(APP_MODE!=lab)에선 항상 null → 아래 모든 분기는 기존 env 그대로.
    const lab = await getLabOverride();
    const internalGatewayConfigured = Boolean(process.env.TRAVEL_API_SECRET?.trim());

    try {
        const { text, sl, tl, fast, quality, pronunciation: includePronunciation = true } = await request.json();

        if (!text || !sl || !tl) {
            return NextResponse.json({ error: "Missing required texts" }, { status: 400 });
        }

        if (typeof text !== 'string' || text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 characters)" }, { status: 400 });
        }

        // 건설 현장 용어집 전처리 — useGlossary=true 로 명시한 호출(TBM/안전지시)에만 적용
        // 일반 채팅(밥 먹으러 가자 등)에는 건설 용어집 불필요 — 오역 방지
        let processedText = text;
        if (sl === 'ko') {
            const glossary = await fetchGlossaryServer();
            // BUG-1 fix: 괄호 설명형 치환어는 번역 텍스트를 오염시킴 → skip
            // BUG-2 fix: 긴 슬랭 먼저 매칭해야 짧은 슬랭이 긴 슬랭 일부를 먼저 치환하는 문제 방지
            const sortedEntries = Object.entries(glossary)
                .filter(([, std]) => !(std as string).includes('('))
                .sort((a, b) => b[0].length - a[0].length);
            for (const [slang, std] of sortedEntries) {
                const escapedSlang = slang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = Array.from(slang).length === 1
                    ? `(?<![\\p{L}\\p{N}])${escapedSlang}(?![\\p{L}\\p{N}])`
                    : escapedSlang;
                processedText = processedText.replace(new RegExp(pattern, 'gu'), std as string);
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
        const forced = lab?.translateEngine;
        // 크메르어는 OpenAI 문맥 번역의 문장 선택이 Google 번역과 달라
        // 화면의 기준 번역문과 TTS 발음 확인이 혼동될 수 있다. Google 결과를
        // 기준 번역문으로 고정하고, TTS는 그 결과만 읽도록 한다.
        const preferGoogleTranslation = tl === 'km';

        // m2m100(로컬 오픈소스)은 서비스 URL이 설정됐거나 루트관리자가 명시 선택한 경우에만 시도.
        // (운영엔 127.0.0.1:8100 서비스가 없어 매 번역마다 실패·낭비되던 문제 수정)
        const m2m100Enabled = forced === "m2m100"
            || (!forced && !!process.env.M2M100_TRANSLATE_URL?.trim());
        if (m2m100Enabled) {
            const localTranslation = await tryM2M100Translate(processedText, sl, tl, !fast);
            if (localTranslation) {
                return NextResponse.json({
                    translated: stripEmoji(tl === "ko"
                        ? formalizeKo(localTranslation.translated)
                        : localTranslation.translated),
                    pronunciation: getLocalPronunciation(localTranslation.translated, tl),
                    reverse_translated: stripEmoji(sl === "ko"
                        ? formalizeKo(localTranslation.reverseTranslated)
                        : localTranslation.reverseTranslated),
                    engine: "m2m100-local",
                    processing_ms: localTranslation.processingMs,
                });
            }
        }

        if (!internalGatewayConfigured && !v3AiVendorContext) {
            return NextResponse.json({
                error: "Translation gateway is not configured",
            }, { status: 503 });
        }

        // === 1. Naver Papago (아시아권 언어 고품질 번역) ===
        // 파파고 지원 언어 목록
        const papagoLangs = ['ko', 'en', 'zh-CN', 'vi', 'id', 'th', 'ru', 'ja', 'fr', 'es'];
        // 🧪 Lab 강제 엔진: forced 지정 시 해당 엔진만 사용(운영은 forced=undefined → 기존 우선순위)
        const usePapago = (forced ? forced === "papago" : true)
            && papagoLangs.includes(sourceLang) && papagoLangs.includes(targetLang);

        let translatedText = "";
        let engine = "google";

        // 일반 1:1 대화는 문맥과 현장 용어의 의미 보존을 우선한다.
        // fast는 발음·역번역만 생략할 뿐, quality=high 본문 번역의 정확도를 낮추지 않는다.
        const useHighQualityContext = quality === "high" && forced !== "papago" && forced !== "google" && !preferGoogleTranslation;
        if (useHighQualityContext && v3AiVendorContext) {
            try {
                const contextualTranslation = await contextualConstructionTranslate(processedText, sl, tl, v3AiVendorContext);
                if (contextualTranslation) {
                    translatedText = contextualTranslation;
                    engine = "openai-context";
                }
            } catch (err) {
                console.warn("[Translation API] High-quality context translation failed, falling back:", err);
            }
        }

        if (!translatedText && usePapago) {
            try {
                if (v3AiVendorContext) {
                    const papagoData = await callV3AiVendor(v3AiVendorContext.request, {
                        siteId: v3AiVendorContext.siteId,
                        feature: "translate",
                        provider: "papago",
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang,
                        text: processedText,
                    });
                    translatedText = papagoData?.text || "";
                    if (translatedText) engine = "papago";
                } else {
                    const papagoData = await callInternalAiTranslate({
                        provider: "papago",
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang,
                        text: processedText,
                    });
                    translatedText = papagoData?.text || "";
                    if (translatedText) engine = "papago";
                }
            } catch (err) {
                console.error("[Translation API] Papago error, falling back to Google:", err);
            }
        }

        // Papago가 중국어 요청형 문장에서 "~해주세요, 식사하세요"처럼
        // 미완성 조사/접두어를 그대로 반환하는 경우가 있다. 한국어 결과에
        // 이 형태가 섞이면 Google 번역으로 다시 시도해 정상 문장만 반환한다.
        if (tl === "ko" && /(?:^|\s)~\s*해s*주(?:세|세)요/.test(translatedText)) {
            translatedText = "";
            engine = "google";
        }

        // === 1.5. 비Papago 언어의 건설현장 문맥 번역 ===
        if (!translatedText && forced !== "google" && !preferGoogleTranslation && v3AiVendorContext) {
            const contextualTranslation = await contextualConstructionTranslate(processedText, sl, tl, v3AiVendorContext);
            if (contextualTranslation) {
                translatedText = contextualTranslation;
                engine = "openai-context";
            }
        }

        // === 2. Google Cloud Translation (기본 및 폴백) ===
        if (!translatedText) {
            const cloudTranslate = async (q: string, source: string, target: string) => {
                if (v3AiVendorContext) {
                    const translated = await callV3AiVendor(v3AiVendorContext.request, {
                        siteId: v3AiVendorContext.siteId,
                        feature: "translate",
                        provider: "google",
                        sourceLanguage: source,
                        targetLanguage: target,
                        text: q,
                    });
                    return { data: { translations: [{ translatedText: translated?.text || "" }] } } as CloudTranslateResponse;
                }
                const translated = await callInternalAiTranslate({
                    provider: "google",
                    sourceLanguage: source,
                    targetLanguage: target,
                    text: q,
                });
                return { data: { translations: [{ translatedText: translated?.text || "" }] } } as CloudTranslateResponse;
            };

            try {
                const translated = await cloudTranslate(processedText, sourceLang, targetLang);
                translatedText = translated.data?.translations?.[0]?.translatedText || "";
            } catch (err) {
                console.error("[Translation API] Google Translate error:", err);
            }
        }

        if (!translatedText) {
            return await aiFullFallback(processedText, sl, tl, v3AiVendorContext);
        }

        // 채팅 전송은 상대방에게 번역문을 먼저 전달하는 것이 우선이다.
        // 역번역·발음은 표시 보조 정보이므로 fast 요청에서는 추가 AI 왕복을
        // 만들지 않는다. 이전에는 fast=true여도 역번역을 기다려 전송이 늦었다.
        if (fast) {
            return NextResponse.json({
                translated: stripEmoji(tl === "ko" ? formalizeKo(translatedText) : translatedText),
                pronunciation: "",
                reverse_translated: "",
                engine,
            });
        }

        // === 3. 역번역 및 발음 처리 (Google로 통일하여 속도 확보) ===
        const cloudTranslateFast = async (q: string, source: string, target: string) => {
            if (v3AiVendorContext) {
                const translated = await callV3AiVendor(v3AiVendorContext.request, {
                    siteId: v3AiVendorContext.siteId,
                    feature: "translate",
                    provider: "google",
                    sourceLanguage: source,
                    targetLanguage: target,
                    text: q,
                });
                return { data: { translations: [{ translatedText: translated?.text || "" }] } } as CloudTranslateResponse;
            }
            const translated = await callInternalAiTranslate({
                provider: "google",
                sourceLanguage: source,
                targetLanguage: target,
                text: q,
            });
            return { data: { translations: [{ translatedText: translated?.text || "" }] } } as CloudTranslateResponse;
        };

        // 2단계: 역번역 + 발음 생성을 완전 병렬 실행
        // fast=true: AI 발음 생성 스킵 → 번역 즉시 반환 (실시간 통역 폴백 경로 고속화)
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
                ? generateChinesePronunciation(pronTarget, v3AiVendorContext)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isJapanese)
                ? generateJapanesePronunciation(pronTarget, v3AiVendorContext)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isThai)
                ? generateThaiPronunciation(pronTarget, v3AiVendorContext)
                : Promise.resolve(""),
            (shouldGeneratePronunciation && isNonLatinOther)
                ? generateNonLatinPronunciation(pronTarget, pronLang, v3AiVendorContext)
                : Promise.resolve(""),
        ]);

        const reverseTranslated = reverseResult.data?.translations?.[0]?.translatedText || "";

        // 한글 발음 생성
        let pronunciation: string;
        if (!shouldGeneratePronunciation) {
            pronunciation = "";
        } else if (isChinese) {
            // 중국어 발음은 병음 기반의 결정적 변환을 우선 사용한다.
            // 생성형 결과가 你好를 "닝하오"처럼 잘못 표기하는 경우를 막는다.
            const py = pinyin.isSupported()
                ? pinyin.convertToPinyin(pronTarget, ' ', true)
                : pronTarget;
            pronunciation = hangulize(py, 'zh') || chinesePron;
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

// 📱 모바일(Capacitor) preflight (S-005)
export async function OPTIONS(request: NextRequest) {
    return handleMobilePreflight(request) ?? new NextResponse(null, { status: 405 });
}

// POST 래퍼 — 허용 mobile origin이면 응답에 CORS 부착(웹/travel-token 무영향).
export async function POST(request: NextRequest) {
    const res = await handleTranslate(request);
    return withMobileCors(res, request.headers.get("origin"));
}


/** 서버사이드 번역 fallback */
const M2M100_LANG_MAP: Record<string, string> = {
    ko: "ko", en: "en", zh: "zh", vi: "vi", th: "th", uz: "uz",
    ph: "tl", tl: "tl", km: "km", id: "id", mn: "mn", my: "my",
    ne: "ne", bn: "bn", kk: "kk", ru: "ru", jp: "ja", ja: "ja",
    fr: "fr", es: "es", ar: "ar", hi: "hi",
};

async function tryM2M100Translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    includeReverse: boolean,
): Promise<{
    translated: string;
    reverseTranslated: string;
    processingMs: number;
} | null> {
    const source = M2M100_LANG_MAP[sourceLanguage];
    const target = M2M100_LANG_MAP[targetLanguage];
    if (!source || !target || source === target || text.length > 3000) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const url = process.env.M2M100_TRANSLATE_URL?.trim() || "http://127.0.0.1:8100";

    try {
        const terminology = await prepareM2M100Terminology(text, source, target);
        const response = await fetch(`${url}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            signal: controller.signal,
            cache: "no-store",
            body: JSON.stringify({
                text: terminology.text,
                source,
                target,
                reverse: includeReverse,
            }),
        });
        if (!response.ok) return null;

        const result = await response.json() as LocalM2M100Response;
        const translated = enforceM2M100Terminology(
            result.translated?.trim() || "",
            target,
            terminology.terms,
        );
        const reverseTranslated = result.reverse_translated?.trim() || "";
        if (!isUsableLocalTranslation(text, translated)) return null;

        return {
            translated,
            reverseTranslated,
            processingMs: result.processing_ms ?? 0,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

let _multilingualGlossaryCache: MultilingualGlossaryTerm[] | null = null;
let _multilingualGlossaryCacheAt = 0;

async function fetchMultilingualGlossary(): Promise<MultilingualGlossaryTerm[]> {
    if (
        _multilingualGlossaryCache &&
        Date.now() - _multilingualGlossaryCacheAt < GLOSSARY_CACHE_TTL_MS
    ) {
        return _multilingualGlossaryCache;
    }

    try {
        const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/glossary/translations`, {
            cache: "no-store",
        });
        if (!response.ok) return _multilingualGlossaryCache ?? [];
        const payload = await response.json() as { terms?: MultilingualGlossaryTerm[] };
        _multilingualGlossaryCache = (payload.terms ?? []).flatMap((term) => {
            const standardCore = term.standardCore?.trim();
            const pivotEnglish = term.pivotEnglish?.match(/\(([^)]+)\)/)?.[1] || term.pivotEnglish;
            if (!standardCore || !pivotEnglish?.trim() || !term.localTerm?.trim()) return [];
            return [{
                glossaryId: term.glossaryId,
                standard: term.standard,
                standardCore,
                pivotEnglish: pivotEnglish.trim(),
                localTerm: term.localTerm.trim(),
                language: normalizeGlossaryLanguage(term.language),
            }];
        });
        _multilingualGlossaryCacheAt = Date.now();
        return _multilingualGlossaryCache;
    } catch {
        return _multilingualGlossaryCache ?? [];
    }
}

async function prepareM2M100Terminology(
    text: string,
    source: string,
    target: string,
): Promise<{ text: string; terms: MultilingualGlossaryTerm[] }> {
    const glossary = await fetchMultilingualGlossary();
    const targetTerms = glossary.filter((term) => term.language === target);
    const sourceTerms = glossary.filter((term) => term.language === source);
    const applied: MultilingualGlossaryTerm[] = [];
    let prepared = text;

    if (source === "ko") {
        for (const term of targetTerms.sort((a, b) => b.standardCore.length - a.standardCore.length)) {
            if (!prepared.includes(term.standardCore)) continue;
            prepared = prepared.replaceAll(term.standardCore, term.pivotEnglish);
            applied.push(term);
        }
    } else {
        for (const sourceTerm of sourceTerms.sort((a, b) => b.localTerm.length - a.localTerm.length)) {
            if (!prepared.toLowerCase().includes(sourceTerm.localTerm.toLowerCase())) continue;
            prepared = prepared.replace(
                new RegExp(escapeRegExp(sourceTerm.localTerm), "giu"),
                sourceTerm.pivotEnglish,
            );
            const targetTerm = target === "ko"
                ? sourceTerm
                : targetTerms.find((candidate) => candidate.glossaryId === sourceTerm.glossaryId);
            if (targetTerm) applied.push(targetTerm);
        }
    }

    return { text: prepared, terms: applied };
}

function enforceM2M100Terminology(
    translated: string,
    target: string,
    terms: MultilingualGlossaryTerm[],
): string {
    let result = translated;
    for (const term of terms) {
        const required = target === "ko" ? term.standardCore : term.localTerm;
        if (result.toLowerCase().includes(required.toLowerCase())) continue;

        const pivotWords = term.pivotEnglish.match(/[A-Za-z]+/g) ?? [];
        const distinctiveWord = pivotWords.at(-1);
        if (distinctiveWord && new RegExp(`\\b${escapeRegExp(distinctiveWord)}\\b`, "iu").test(result)) {
            result = result.replace(
                new RegExp(`\\b(?:${pivotWords.slice(0, -1).map(escapeRegExp).join("\\s+")}\\s+)?${escapeRegExp(distinctiveWord)}\\b`, "iu"),
                required,
            );
        } else {
            result = `${required}: ${result}`;
        }
    }
    return result;
}

function normalizeGlossaryLanguage(language: string): string {
    const aliases: Record<string, string> = {
        ph: "tl", kh: "km", lk: "si", bd: "bn", np: "ne", mm: "my", pk: "ur",
    };
    return aliases[language] ?? language;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isUsableLocalTranslation(source: string, translated: string): boolean {
    if (!translated || translated.includes("\uFFFD")) return false;
    if (translated.length > Math.max(500, source.length * 8)) return false;

    const words = translated.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length >= 4) {
        const counts = new Map<string, number>();
        for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
        if (Math.max(...counts.values()) / words.length > 0.4) return false;
    }

    return true;
}

function getLocalPronunciation(text: string, language: string): string {
    if (!text) return "";
    if (language === "zh") {
        const romanized = pinyin.isSupported()
            ? pinyin.convertToPinyin(text, " ", true)
            : text;
        return hangulize(romanized, "zh");
    }
    if (language === "jp" || language === "ja") return hangulize(text, "ja");

    const latinScript = /^[a-zA-Z\s\-.,!?'"()0-9\u00C0-\u024F\u1E00-\u1EFF]+$/.test(
        text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
    return latinScript ? hangulize(text, language) : "";
}

const GLOSSARY_CACHE_TTL_MS = 60_000;
let _serverGlossaryCache: Record<string, string> | null = null;
let _serverGlossaryCacheAt = 0;

async function fetchGlossaryServer(): Promise<Record<string, string>> {
    if (
        _serverGlossaryCache &&
        Date.now() - _serverGlossaryCacheAt < GLOSSARY_CACHE_TTL_MS
    ) {
        return _serverGlossaryCache;
    }
    try {
        const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/glossary?active=true`, {
            cache: "no-store",
        });
        const payload = response.ok
            ? await response.json() as { terms?: Array<{ slang: string; standard: string }> }
            : null;
        const data = payload?.terms ?? [];
        if (!response.ok || data.length === 0) {
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
    _serverGlossaryCacheAt = Date.now();
    return _serverGlossaryCache;
}

/** 중국어 → 한글 발음 생성 (Spring AI Gateway, 국립국어원 표준 기반) */
async function generateChinesePronunciation(chineseText: string, v3Context: V3AiVendorContext | null = null): Promise<string> {
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

        if (v3Context) {
            const result = await callV3AiVendor(v3Context.request, {
                siteId: v3Context.siteId,
                feature: "translate",
                provider: "openai-prompt",
                sourceLanguage: "zh-CN",
                targetLanguage: "ko",
                text: chineseText,
                prompt,
                maxOutputTokens: 1024,
                temperature: 0.2,
            });
            const koreanOnly = (result?.text || "").replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
            return koreanOnly.length >= 1 ? koreanOnly : "";
        }

        return "";
    } catch {
        return "";
    }
}

/** 일본어 → 한글 발음 생성 (Spring AI Gateway, 국립국어원 표준 기반) */
async function generateJapanesePronunciation(japaneseText: string, v3Context: V3AiVendorContext | null = null): Promise<string> {
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

        if (v3Context) {
            const result = await callV3AiVendor(v3Context.request, {
                siteId: v3Context.siteId,
                feature: "translate",
                provider: "openai-prompt",
                sourceLanguage: "ja",
                targetLanguage: "ko",
                text: japaneseText,
                prompt,
                maxOutputTokens: 1024,
                temperature: 0.2,
            });
            const koreanOnly = (result?.text || "").replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
            return koreanOnly.length >= 1 ? koreanOnly : "";
        }

        return "";
    } catch {
        return "";
    }
}

/** 태국어 → 한글 발음 생성 (Spring AI Gateway, 국립국어원 표준 기반) */
async function generateThaiPronunciation(thaiText: string, v3Context: V3AiVendorContext | null = null): Promise<string> {
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

        if (v3Context) {
            const result = await callV3AiVendor(v3Context.request, {
                siteId: v3Context.siteId,
                feature: "translate",
                provider: "openai-prompt",
                sourceLanguage: "th",
                targetLanguage: "ko",
                text: thaiText,
                prompt,
                maxOutputTokens: 1024,
                temperature: 0.2,
            });
            const koreanOnly = (result?.text || "").replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
            return koreanOnly.length >= 1 ? koreanOnly : "";
        }

        return "";
    } catch {
        return "";
    }
}

/** 비라틴 언어(러시아·몽골·미얀마·크메르·네팔·벵골·카자흐·아랍·힌디) → 한글 발음 */
async function generateNonLatinPronunciation(text: string, lang: string, v3Context: V3AiVendorContext | null = null): Promise<string> {
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

        if (v3Context) {
            const result = await callV3AiVendor(v3Context.request, {
                siteId: v3Context.siteId,
                feature: "translate",
                provider: "openai-prompt",
                sourceLanguage: lang,
                targetLanguage: "ko",
                text,
                prompt,
                maxOutputTokens: 1024,
                temperature: 0.2,
            });
            const koreanOnly = (result?.text || "").replace(/[^\uAC00-\uD7A3\s]/g, "").trim();
            return koreanOnly.length >= 1 ? koreanOnly : "";
        }

        return "";
    } catch {
        return "";
    }
}

/** 비Papago 언어의 건설현장 문맥 번역 */
async function contextualConstructionTranslate(text: string, sl: string, tl: string, v3Context: V3AiVendorContext): Promise<string> {
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

    const result = await callV3AiVendor(v3Context.request, {
        siteId: v3Context.siteId,
        feature: "translate",
        provider: "openai-prompt",
        sourceLanguage: sl,
        targetLanguage: tl,
        text,
        prompt,
        maxOutputTokens: 1024,
        temperature: 0.1,
    });
    return result?.text?.trim() || "";
}

async function aiFullFallback(text: string, sl: string, tl: string, v3Context: V3AiVendorContext | null = null) {
    try {
        const prompt = `Translate accurately. Source: ${sl}, Target: ${tl}.
Return ONLY JSON: {"translated":"...","pronunciation":"Korean Hangul pronunciation","reverse_translated":"..."}
Text: ${JSON.stringify(text)}`;

        if (!v3Context) throw new Error("V3 AI context required");
        const result = await callV3AiVendor(v3Context.request, {
            siteId: v3Context.siteId,
            feature: "translate",
            provider: "openai-prompt",
            sourceLanguage: sl,
            targetLanguage: tl,
            text,
            prompt,
            maxOutputTokens: 1024,
            temperature: 0.2,
        });
        const textContent = result?.text || "";
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

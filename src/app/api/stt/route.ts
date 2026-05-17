import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { getErrorMessage } from '@/utils/errors';
import { CONSTRUCTION_SPEECH_HINTS, WHISPER_CONTEXT_PROMPT } from '@/constants/construction-terms';
import { CONSTRUCTION_GLOSSARY } from '@/constants/glossary';
import {
    WHISPER_TIMEOUT_MS,
    GOOGLE_STT_TIMEOUT_MS,
    GEMINI_STT_CORRECTION_TIMEOUT_MS,
    STT_MIN_CONFIDENCE,
    STT_MIN_CONFIDENCE_LIVE,
    STT_HIGH_CONFIDENCE_SKIP_GEMINI,
} from '@/constants/quality-config';

/** 동기 정규화: 은어→표준어 (서버사이드, DB 미사용) */
function normalizeServerSide(text: string): { normalized: string; changes: { from: string; to: string }[] } {
    const changes: { from: string; to: string }[] = [];
    const sorted = Object.entries(CONSTRUCTION_GLOSSARY)
        .sort((a, b) => b[0].length - a[0].length);

    const placeholders: string[] = [];
    let result = text;

    for (const [slang, standard] of sorted) {
        if (result.includes(slang)) {
            changes.push({ from: slang, to: standard });
            const ph = `\x00${placeholders.length}\x00`;
            placeholders.push(standard);
            result = result.split(slang).join(ph);
        }
    }

    for (let i = 0; i < placeholders.length; i++) {
        result = result.split(`\x00${i}\x00`).join(placeholders[i]);
    }

    return { normalized: result, changes };
}

/** Gemini 기반 건설 현장 문맥 보정 (한국어 전용) */
async function correctWithLLM(transcript: string, apiKey: string): Promise<string> {
    try {
        const systemPrompt = `당신은 건설현장 안전 교육 음성인식(STT) 교정 전문가입니다.
아래는 건설 현장 관리자 발화를 STT로 변환한 텍스트입니다.
발화 맥락: 건설 현장 안전 교육 또는 TBM(Tool Box Meeting) 진행 중.

교정 규칙 (우선순위 순):
1. 안전 지시·경고 오인식 최우선 교정 (위험/경고 단어는 안전 관련으로 해석)
2. 건설 자재/장비 오인식: 아이폰→알폼(Al-Form), 씨피비→CPB, CPD/CPVR→CPB
3. 층수·수치 교정: "식스층"→"6층", "일층"→"1층", "쓰리"→"3"
4. 현장 은어 보존: "국물"=시멘트페이스트, "빠루"=빠루(철제도구)
5. 외국인 이름·팀명 원형 유지 (슈그아르, 압둘라, 베트남팀 등)
6. 불완전한 문장도 원형 유지 (교정 대신 원문 반환)
7. 교정 불필요 시 원문 그대로 반환

교정된 텍스트만 출력하세요. 설명·따옴표·원문 반복 없이.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_STT_CORRECTION_TIMEOUT_MS);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: `${systemPrompt}\n\nSTT 원문: ${transcript}` }] }
                    ],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
                }),
            }
        );

        clearTimeout(timeout);
        if (!response.ok) return transcript;

        const data = await response.json() as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const corrected = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return corrected || transcript;
    } catch {
        return transcript;
    }
}

/** Whisper 언어 코드 매핑 (앱 내부 → ISO-639-1) */
const WHISPER_LANG_MAP: Record<string, string> = {
    ko: 'ko', en: 'en', zh: 'zh', vi: 'vi', ja: 'ja', jp: 'ja',
    th: 'th', id: 'id', ru: 'ru', uz: 'uz', ne: 'ne', km: 'km',
    my: 'my', hi: 'hi', bn: 'bn', ar: 'ar', fr: 'fr', es: 'es',
    mn: 'mn', kk: 'kk', ph: 'tl', tl: 'tl',
};

/** OpenAI Whisper 호출 — 소음 현장 최적화 */
async function transcribeWithWhisper(
    audio: string,
    mimeType: string | undefined,
    lang: string,
    apiKey: string,
): Promise<string | null> {
    const iso = WHISPER_LANG_MAP[lang.split('-')[0]] || 'ko';

    const formData = new FormData();
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', iso);
    // 자연문 형태 컨텍스트 프롬프트 — 키워드 나열보다 문장 맥락이 Whisper 인식률 더 높음
    formData.append('prompt', WHISPER_CONTEXT_PROMPT);
    // 소음 환경: 온도 0 = 가장 확률 높은 토큰만 선택 → 환각 억제
    formData.append('temperature', '0');
    formData.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

    try {
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const err = await res.text();
            console.error('[STT Whisper]', res.status, err.slice(0, 200));
            return null;
        }

        const data = await res.json() as { text?: string };
        return data.text?.trim() || null;
    } catch (err) {
        clearTimeout(timeout);
        console.error('[STT Whisper] fetch error', err);
        return null;
    }
}

// 신뢰도 임계값 — quality-config.ts 에서 중앙 관리 (임의 변경 금지)
const MIN_CONFIDENCE = STT_MIN_CONFIDENCE;
const MIN_CONFIDENCE_LIVE = STT_MIN_CONFIDENCE_LIVE;

/** 음성 어시스턴트 wake word — STT가 잡아도 즉시 폐기 */
const WAKE_WORD_RE = /^(ok\s*google|okay\s*google|hey\s*google|ok\s*구글|오케이\s*구글|hey\s*siri|하이\s*빅스비|hi\s*bixby|ok\s*bixby|알렉사|alexa)\.?$/i;

/**
 * 일본어 음성을 한국어 STT가 한글 발음으로 전사한 패턴
 * 가나 문자 없이 한글로만 표기된 일본어 음소를 탐지 (문자 기반 필터 우회 방지)
 */
const JA_PHONETIC_IN_KO_RE = /고자이마스|고자이마시다|아리가또|아리가토|코니치와|고니치와|스미마셍|스미마센|와카리마스|와카리마셍|와카리마시타|나니?데스까|도코데스|도코카라|오하이오\s*고자|이키마스|이키마셍|오야스미/i;

/**
 * 교차 음성 오염 필터 — 주변 타국 근로자 음성이 관리자 마이크에 섞였을 때 폐기
 * Layer 1: 문자 범위 감지 (가나·한글·CJK)
 * Layer 2 (ko 전용): 한국어 STT가 일본어 음소를 한글로 전사한 패턴 감지
 * Layer 3 (ko 전용): 한글 없는 전사 = 주변 소음/비한국어 발화를 억지 전사한 것으로 폐기
 */
function isCrossTalkContamination(transcript: string, shortLang: string): boolean {
    const hasHangul = /[가-힣ㄱ-ㆎ]/.test(transcript);
    const hasKana   = /[぀-ゟ゠-ヿ]/.test(transcript);

    switch (shortLang) {
        case 'ko':
            if (hasKana) return true;
            if (JA_PHONETIC_IN_KO_RE.test(transcript)) return true;
            // 한국어 발화는 반드시 한글 포함 — 한글 없으면 주변 타국어 소음 오염
            if (!hasHangul) return true;
            return false;
        case 'ja':
            return hasHangul;
        case 'zh':
            return hasHangul || hasKana;
        case 'vi': case 'en':
            return false;
        default:
            return false;
    }
}

interface SpeechRecognitionResponse {
    error?: { message?: string };
    results?: Array<{
        alternatives?: Array<{ transcript?: string; confidence?: number }>;
    }>;
}

export async function POST(req: Request) {
    const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    const t0 = Date.now();

    if (!GOOGLE_API_KEY && !OPENAI_API_KEY) {
        console.error("[STT API] No STT provider API key configured");
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { audio, lang, mimeType, live } = await req.json();

        if (!audio) {
            return NextResponse.json({ error: "No audio data" }, { status: 400 });
        }

        const MAX_BASE64_LENGTH = 10 * 1024 * 1024 * (4 / 3);
        if (typeof audio !== 'string' || audio.length > MAX_BASE64_LENGTH) {
            return NextResponse.json({ error: "Audio payload too large (max 10MB)" }, { status: 413 });
        }

        const languageCode = lang || "ko-KR";
        const shortLang = languageCode.split('-')[0];

        // === 1. live 모드: Google Cloud STT 우선 (Whisper보다 3~6배 빠름 — 200~500ms vs 1~3s) ===
        if (!live && OPENAI_API_KEY && WHISPER_LANG_MAP[shortLang]) {
            const transcript = await transcribeWithWhisper(audio, mimeType, languageCode, OPENAI_API_KEY);

            if (transcript) {
                // 한국어: 은어 정규화 (동기, 즉시) + Gemini 교정
                if (shortLang === 'ko') {
                    if (GOOGLE_API_KEY) {
                        const corrected = await correctWithLLM(transcript, GOOGLE_API_KEY);
                        const { normalized, changes } = normalizeServerSide(corrected);
                        return NextResponse.json({
                            transcript: normalized,
                            llm_corrected: corrected !== transcript,
                            raw_stt: transcript,
                            normalized: changes.length > 0,
                            changes,
                            engine: "whisper",
                        });
                    }
                }
                return NextResponse.json({ transcript, engine: "whisper" });
            }
            // Whisper 실패 시 Google 폴백으로 계속
        }

        // === 2. Google Cloud STT (live 모드 기본 + non-live 폴백) ===
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: "STT unavailable" }, { status: 503 });
        }

        let encoding = "WEBM_OPUS";
        const sampleRate = 48000;
        if (mimeType?.includes('ogg')) encoding = "OGG_OPUS";

        // 건설현장 용어 힌트는 한국어 전용 — 일본어·중국어 등에 적용 시 오인식 유발
        const speechContexts = shortLang === 'ko'
            ? [{ phrases: CONSTRUCTION_SPEECH_HINTS.slice(0, 500), boost: 15 }]
            : [];

        const buildConfig = (enhanced: boolean) => ({
            encoding,
            sampleRateHertz: sampleRate,
            languageCode,
            enableAutomaticPunctuation: true,
            ...(enhanced
                ? { model: "latest_long", useEnhanced: true, ...(speechContexts.length > 0 && { speechContexts }) }
                : { model: "default" }),
        });

        // 항상 enhanced 모델 사용 — live 모드도 latest_long + speechContexts 적용
        // (default 모델 대비 한국어 건설 현장 발화 인식률 대폭 향상)
        const tryEnhanced = true;
        const callSTT = async (enhanced: boolean): Promise<Response> => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), GOOGLE_STT_TIMEOUT_MS);
            const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": GOOGLE_API_KEY },
                body: JSON.stringify({ config: buildConfig(enhanced), audio: { content: audio } }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            return res;
        };

        let response = await callSTT(tryEnhanced);
        let data = await response.json() as SpeechRecognitionResponse;

        // non-live에서만 enhanced 실패 시 default 모델로 폴백
        if (data.error && tryEnhanced) {
            console.warn("[STT] latest_long 실패, default 모델로 폴백:", data.error.message);
            response = await callSTT(false);
            data = await response.json() as SpeechRecognitionResponse;
        }

        if (data.error) {
            console.error("[STT API Error]", data.error);
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        // live 모드(TBM 방송)는 다국어 혼재 환경 → 더 엄격한 신뢰도 적용
        const confidenceThreshold = live ? MIN_CONFIDENCE_LIVE : MIN_CONFIDENCE;
        let totalConf = 0, confCount = 0;
        const transcript = data.results
            ?.map((res) => {
                const alt = res.alternatives?.[0];
                if (!alt?.transcript) return "";
                if (alt.confidence !== undefined && alt.confidence < confidenceThreshold) return "";
                if (alt.confidence !== undefined) { totalConf += alt.confidence; confCount++; }
                return alt.transcript;
            })
            .filter(Boolean)
            .join(" ") || "";

        // 평균 신뢰도가 높으면 Gemini 교정 생략 (명확한 발화 → 1~3s 절약)
        const avgConf = confCount > 0 ? totalConf / confCount : 0;
        const skipGemini = avgConf >= STT_HIGH_CONFIDENCE_SKIP_GEMINI;

        if (!transcript.trim()) {
            return NextResponse.json({ transcript: "" });
        }

        // 음성 어시스턴트 wake word 폐기 (OK Google 등)
        if (WAKE_WORD_RE.test(transcript.trim())) {
            return NextResponse.json({ transcript: "" });
        }

        // 교차 음성 오염 감지 — 상대방 언어가 섞인 경우 폐기
        if (isCrossTalkContamination(transcript, shortLang)) {
            console.log(`[STT] Cross-talk filtered (${shortLang}):`, transcript.slice(0, 30));
            return NextResponse.json({ transcript: "" });
        }

        if (shortLang === "ko") {
            if (live) {
                // 실시간 통역: 은어 정규화 + Gemini 교정 (신뢰도 높으면 Gemini 생략 → 지연 절감)
                const corrected = (GOOGLE_API_KEY && !skipGemini)
                    ? await correctWithLLM(transcript.trim(), GOOGLE_API_KEY)
                    : transcript.trim();
                const { normalized, changes } = normalizeServerSide(corrected);
                return NextResponse.json({
                    transcript: normalized,
                    ...(corrected !== transcript.trim() && { llm_corrected: true }),
                    ...(changes.length > 0 && { normalized: true, changes }),
                    engine: "google",
                    live: true,
                });
            }
            const corrected = skipGemini
                ? transcript.trim()
                : await correctWithLLM(transcript.trim(), GOOGLE_API_KEY);
            const llmCorrected = corrected !== transcript.trim();
            const { normalized, changes } = normalizeServerSide(corrected);

            return NextResponse.json({
                transcript: normalized,
                ...(llmCorrected && { llm_corrected: true, raw_stt: transcript.trim() }),
                ...(changes.length > 0 && { normalized: true, changes }),
                engine: "google",
            });
        }

        const elapsed = Date.now() - t0;
        console.log(`[STT] ${shortLang} live=${live} → ${elapsed}ms`);
        return NextResponse.json({ transcript: transcript.trim(), engine: "google" });
    } catch (error: unknown) {
        console.error("[STT API Internal Error]", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

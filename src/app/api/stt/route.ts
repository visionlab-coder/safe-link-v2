import { NextResponse } from "next/server";
import { getErrorMessage } from '@/utils/errors';
import { CONSTRUCTION_SPEECH_HINTS } from '@/constants/construction-terms';
import { CONSTRUCTION_GLOSSARY } from '@/constants/glossary';

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
        const systemPrompt = `당신은 건설 현장 음성 인식 교정 전문가입니다.
아래 텍스트는 건설 현장에서 STT(음성인식)로 변환된 결과입니다.
건설 현장 문맥에 맞게 오인식된 단어를 교정해주세요.

교정 규칙:
1. 건설 장비/자재 오인식: CPD/CPVR→CPB, 아이폰→알폼(Al-Form), 씨피비→CPB
2. 현장 은어의 문맥 보존: "국물"은 건설 현장에서 "시멘트 페이스트"를 의미
3. 외국인 이름/팀명은 그대로 유지 (슈그아르, 압둘 등)
4. 안전 용어 우선: 위험/경고 관련 단어가 애매하면 안전 관련으로 해석
5. 숫자/층수 관련 오인식 교정: "식스"→"6", "일층"→"1층"
6. 교정이 불필요하면 원문 그대로 반환

반드시 교정된 텍스트만 반환하세요. 설명이나 따옴표 없이 텍스트만 출력하세요.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

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
    // 현장 용어 프롬프트 — Whisper는 최대 224 토큰 prompt 힌트 허용
    formData.append('prompt', CONSTRUCTION_SPEECH_HINTS.join(', ').slice(0, 800));
    // 소음 환경: 온도 0 = 가장 확률 높은 토큰만 선택 → 환각 억제
    formData.append('temperature', '0');
    formData.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

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

/** 일반 신뢰도 임계값 */
const MIN_CONFIDENCE = 0.6;
/** live 모드(Travel Talk) — 교차 오염 가능성↑, 더 엄격한 신뢰도 요구 */
const MIN_CONFIDENCE_LIVE = 0.75;

/** 음성 어시스턴트 wake word — STT가 잡아도 즉시 폐기 */
const WAKE_WORD_RE = /^(ok\s*google|okay\s*google|hey\s*google|ok\s*구글|오케이\s*구글|hey\s*siri|하이\s*빅스비|hi\s*bixby|ok\s*bixby|알렉사|alexa)\.?$/i;

/**
 * 일본어 음성을 한국어 STT가 한글 발음으로 전사한 패턴
 * 예) ありがとうございます → "아리가또 고자이마시다"
 * 가나 문자가 없어 문자 기반 필터를 우회하는 케이스를 잡음
 */
const JA_PHONETIC_IN_KO_RE = /고자이마스|고자이마시다|아리가또|아리가토|코니치와|고니치와|스미마셍|스미마센|와카리마스|와카리마셍|와카리마시타|나니?데스까|도코데스|도코카라|오하이오\s*고자|이키마스|이키마셍|오야스미/i;

/**
 * 교차 음성 오염 필터 — 상대방 언어가 내 마이크에 섞였을 때 폐기
 * Layer 1: 문자 범위 감지 (가나·한글·CJK)
 * Layer 2 (ko전용): 한국어 STT가 일본어 음성을 한글 발음으로 전사한 패턴 감지
 */
function isCrossTalkContamination(transcript: string, shortLang: string): boolean {
    const hasHangul = /[\uAC00-\uD7A3\u3131-\u318E]/.test(transcript);
    const hasKana   = /[\u3040-\u309F\u30A0-\u30FF]/.test(transcript);

    switch (shortLang) {
        case 'ko':
            if (hasKana) return true;
            // 한국어 STT가 일본어 음성을 한글 음소로 전사한 패턴 (가나 없이도 탐지)
            if (JA_PHONETIC_IN_KO_RE.test(transcript)) return true;
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

        const callSTT = async (enhanced: boolean) =>
            fetch(`https://speech.googleapis.com/v1/speech:recognize`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": GOOGLE_API_KEY },
                body: JSON.stringify({ config: buildConfig(enhanced), audio: { content: audio } }),
            });

        let response = await callSTT(true);
        let data = await response.json() as SpeechRecognitionResponse;

        // latest_long / useEnhanced 미지원 언어(zh-CN 등) → default 모델로 폴백
        if (data.error) {
            console.warn("[STT] latest_long 실패, default 모델로 폴백:", data.error.message);
            response = await callSTT(false);
            data = await response.json() as SpeechRecognitionResponse;
        }

        if (data.error) {
            console.error("[STT API Error]", data.error);
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        // live 모드(Travel Talk)는 교차 오염 가능성이 높아 더 엄격한 신뢰도 적용
        const confidenceThreshold = live ? MIN_CONFIDENCE_LIVE : MIN_CONFIDENCE;
        const transcript = data.results
            ?.map((res) => {
                const alt = res.alternatives?.[0];
                if (!alt?.transcript) return "";
                if (alt.confidence !== undefined && alt.confidence < confidenceThreshold) return "";
                return alt.transcript;
            })
            .filter(Boolean)
            .join(" ") || "";

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
                // 실시간 통역: 은어 정규화만, Gemini 스킵
                const { normalized, changes } = normalizeServerSide(transcript.trim());
                return NextResponse.json({
                    transcript: normalized,
                    ...(changes.length > 0 && { normalized: true, changes }),
                    engine: "google",
                    live: true,
                });
            }
            const corrected = await correctWithLLM(transcript.trim(), GOOGLE_API_KEY);
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

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

/** Gemini 기반 건설 현장 문맥 보정 */
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: `${systemPrompt}\n\nSTT 원문: ${transcript}` }] }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 512,
                    },
                }),
            }
        );

        clearTimeout(timeout);

        if (!response.ok) return transcript;

        const data = await response.json() as {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };
        const corrected = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return corrected || transcript;
    } catch {
        // LLM 실패 시 원문 그대로 반환 (graceful degradation)
        return transcript;
    }
}

/** 최소 confidence 임계값 — 이 미만은 오인식으로 간주하여 제거 */
const MIN_CONFIDENCE = 0.6;

interface SpeechRecognitionResponse {
    error?: { message?: string };
    results?: Array<{
        alternatives?: Array<{
            transcript?: string;
            confidence?: number;
        }>;
    }>;
}

export async function POST(req: Request) {
    const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();

    if (!GOOGLE_API_KEY) {
        console.error("[STT API] Missing GOOGLE_CLOUD_API_KEY in environment");
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    try {
        const { audio, lang, mimeType } = await req.json();

        if (!audio) {
            return NextResponse.json({ error: "No audio data" }, { status: 400 });
        }

        // base64 10MB 제한 (10초 청크 대응, 실제 바이너리 ~7.5MB)
        const MAX_BASE64_LENGTH = 10 * 1024 * 1024 * (4 / 3);
        if (typeof audio !== 'string' || audio.length > MAX_BASE64_LENGTH) {
            return NextResponse.json({ error: "Audio payload too large (max 10MB)" }, { status: 413 });
        }

        // Determine encoding based on mimeType
        let encoding = "WEBM_OPUS";
        let sampleRate = 48000;

        if (mimeType?.includes('ogg')) {
            encoding = "OGG_OPUS";
            sampleRate = 48000;
        } else if (mimeType?.includes('webm')) {
            encoding = "WEBM_OPUS";
            sampleRate = 48000;
        }

        const languageCode = lang || "ko-KR";

        // === 1. OpenAI Whisper (한국어 전용, 최상위 품질) ===
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
        const isKorean = languageCode.startsWith("ko");

        if (isKorean && OPENAI_API_KEY) {
            try {
                // OpenAI Whisper용 오디오 변환 (FormData 필요)
                const formData = new FormData();
                const audioBuffer = Buffer.from(audio, 'base64');
                const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
                formData.append('file', audioBlob, 'audio.webm');
                formData.append('model', 'whisper-1');
                formData.append('language', 'ko');
                formData.append('prompt', CONSTRUCTION_SPEECH_HINTS.join(', '));

                const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                    body: formData,
                });

                if (whisperResponse.ok) {
                    const whisperData = await whisperResponse.json();
                    const transcript = whisperData.text || "";

                    if (transcript.trim()) {
                        console.log("[STT API] Used OpenAI Whisper for Korean");
                        // LLM 보정 및 은어 정규화 적용
                        const corrected = await correctWithLLM(transcript.trim(), GOOGLE_API_KEY);
                        const { normalized, changes } = normalizeServerSide(corrected);

                        return NextResponse.json({
                            transcript: normalized,
                            llm_corrected: corrected !== transcript.trim(),
                            raw_stt: transcript.trim(),
                            normalized: changes.length > 0,
                            changes,
                            engine: "whisper"
                        });
                    }
                }
            } catch (err) {
                console.error("[STT API] Whisper Fallback to Google STT due to error:", err);
            }
        }

        // === 2. Google Cloud STT (기타 언어 및 Whisper 폴백) ===
        const url = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                config: {
                    encoding,
                    sampleRateHertz: sampleRate,
                    languageCode,
                    enableAutomaticPunctuation: true,
                    model: "latest_long",
                    useEnhanced: true,
                    ...(speechContexts.length > 0 && { speechContexts }),
                },
                audio: {
                    content: audio,
                },
            }),
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json() as SpeechRecognitionResponse;

        if (data.error) {
            console.error("[STT API Error]", data.error);
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        // confidence 필터링: 낮은 신뢰도 결과 제거 (오인식 방지)
        const transcript = data.results
            ?.map((res) => {
                const alt = res.alternatives?.[0];
                if (!alt?.transcript) return "";
                // confidence가 있고 임계값 미만이면 제거
                if (alt.confidence !== undefined && alt.confidence < MIN_CONFIDENCE) return "";
                return alt.transcript;
            })
            .filter(Boolean)
            .join(" ") || "";

        if (!transcript.trim()) {
            return NextResponse.json({ transcript: "" });
        }

        // 한국어일 때: 1) LLM 문맥 보정 → 2) 은어→표준어 정규화
        if (languageCode.startsWith("ko")) {
            // 1단계: LLM 문맥 보정 (Gemini)
            const corrected = await correctWithLLM(transcript.trim(), GOOGLE_API_KEY);
            const llmCorrected = corrected !== transcript.trim();

            // 2단계: 은어→표준어 정규화
            const { normalized, changes } = normalizeServerSide(corrected);

            return NextResponse.json({
                transcript: normalized,
                ...(llmCorrected && { llm_corrected: true, raw_stt: transcript.trim() }),
                ...(changes.length > 0 && { normalized: true, changes }),
                engine: "google"
            });
        }

        return NextResponse.json({ transcript: transcript.trim() });
    } catch (error: unknown) {
        console.error("[STT API Internal Error]", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

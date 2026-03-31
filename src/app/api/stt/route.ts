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

        // 한국어일 때 건설 용어 힌트 적용
        const speechContexts = languageCode.startsWith("ko")
            ? [{ phrases: CONSTRUCTION_SPEECH_HINTS, boost: 5 }]
            : [];

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

        // 한국어일 때 서버사이드 정규화 (은어→표준어)
        if (languageCode.startsWith("ko")) {
            const { normalized, changes } = normalizeServerSide(transcript.trim());
            return NextResponse.json({
                transcript: normalized,
                ...(changes.length > 0 && { normalized: true, changes }),
            });
        }

        return NextResponse.json({ transcript: transcript.trim() });
    } catch (error: unknown) {
        console.error("[STT API Internal Error]", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

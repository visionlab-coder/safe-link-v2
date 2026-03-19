import { NextResponse } from "next/server";
import { getErrorMessage } from '@/utils/errors';

interface SpeechRecognitionResponse {
    error?: { message?: string };
    results?: Array<{
        alternatives?: Array<{
            transcript?: string;
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

        // base64 5MB 제한 (실제 바이너리 ~3.75MB)
        const MAX_BASE64_LENGTH = 5 * 1024 * 1024 * (4 / 3);
        if (typeof audio !== 'string' || audio.length > MAX_BASE64_LENGTH) {
            return NextResponse.json({ error: "Audio payload too large (max 5MB)" }, { status: 413 });
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

        const url = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                config: {
                    encoding: encoding,
                    sampleRateHertz: sampleRate,
                    languageCode: lang || "ko-KR",
                    enableAutomaticPunctuation: true,
                    model: "default",
                    useEnhanced: true,
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

        const transcript = data.results
            ?.map((res) => res.alternatives?.[0]?.transcript ?? "")
            .join(" ");

        return NextResponse.json({ transcript: transcript || "" });
    } catch (error: unknown) {
        console.error("[STT API Internal Error]", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

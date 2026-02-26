import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();

    if (!GOOGLE_API_KEY) {
        console.error("[STT API] Missing GOOGLE_CLOUD_API_KEY in environment");
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }


    try {
        const { audio, lang } = await req.json();

        if (!audio) {
            return NextResponse.json({ error: "No audio data" }, { status: 400 });
        }

        const url = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                config: {
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 48000,
                    languageCode: lang || "ko-KR",
                    enableAutomaticPunctuation: true,
                    model: "latest_long",
                    useEnhanced: true,
                },
                audio: {
                    content: audio,
                },
            }),
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (data.error) {
            console.error("[STT API Error]", data.error);
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        const transcript = data.results
            ?.map((res: any) => res.alternatives[0].transcript)
            .join(" ");

        return NextResponse.json({ transcript: transcript || "" });
    } catch (error: any) {
        console.error("[STT API Internal Error]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

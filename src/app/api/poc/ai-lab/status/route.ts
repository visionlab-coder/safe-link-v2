import { NextResponse } from "next/server";
import { getGeminiKey, isPocEnabled, masked } from "../_utils";

export const runtime = "nodejs";

export async function GET() {
    if (!isPocEnabled()) {
        return NextResponse.json({ error: "POC_DISABLED" }, { status: 404 });
    }

    return NextResponse.json({
        env: process.env.NODE_ENV,
        providers: {
            google_translate: {
                key: masked(process.env.GOOGLE_CLOUD_API_KEY),
                env: "GOOGLE_CLOUD_API_KEY",
            },
            gemini_translate: {
                key: masked(getGeminiKey()),
                env: "GEMINI_API_KEY or GOOGLE_AI_API_KEY or GOOGLE_CLOUD_API_KEY",
                model: process.env.GEMINI_TRANSLATE_MODEL || "gemini-3.5-flash",
            },
            deepl: {
                key: masked(process.env.DEEPL_API_KEY),
                env: "DEEPL_API_KEY",
                apiUrl: process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate",
            },
            flitto_rtt: {
                key: masked(process.env.FLITTO_RTT_TOKEN),
                env: "FLITTO_RTT_TOKEN",
                url: process.env.FLITTO_RTT_URL || "wss://ai-realtime-dev.flit.to/v1/realtime/speech-session",
            },
        },
    });
}

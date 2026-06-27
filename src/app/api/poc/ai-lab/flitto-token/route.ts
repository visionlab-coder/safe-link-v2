import { NextResponse } from "next/server";
import { isPocEnabled } from "../_utils";

export const runtime = "nodejs";

const DEFAULT_RTT_URL = "wss://ai-realtime-dev.flit.to/v1/realtime/speech-session";

export async function GET() {
    if (!isPocEnabled()) {
        return NextResponse.json({ error: "POC_DISABLED" }, { status: 404 });
    }

    const token = process.env.FLITTO_RTT_TOKEN?.trim();
    const url = process.env.FLITTO_RTT_URL?.trim() || DEFAULT_RTT_URL;
    if (!token) {
        return NextResponse.json({ error: "Missing FLITTO_RTT_TOKEN" }, { status: 500 });
    }

    return NextResponse.json({
        url,
        token,
        supported_langs: ["ko", "en", "ja", "zh-CN", "zh-TW", "ru", "vi", "fr", "it", "ar", "es"],
    });
}

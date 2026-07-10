import { NextResponse } from "next/server";
import { getOpenAiKey, isPocEnabled, masked } from "../_utils";

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
            openai_translate: {
                key: masked(getOpenAiKey()),
                env: "OPENAI_API_KEY",
                model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
            },
        },
    });
}

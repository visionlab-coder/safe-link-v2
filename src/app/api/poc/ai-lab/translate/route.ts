import { NextRequest, NextResponse } from "next/server";
import { callInternalAiTranslate } from "@/utils/ai/v3-ai-gateway";
import { isPocEnabled, normalizeLang } from "../_utils";

export const runtime = "nodejs";

type Provider = "google" | "openai";

export async function POST(request: NextRequest) {
  if (!isPocEnabled()) {
    return NextResponse.json({ error: "POC_DISABLED" }, { status: 404 });
  }
  const started = Date.now();
  try {
    const { provider, text, sl = "ko", tl = "en" } = await request.json() as {
      provider?: Provider;
      text?: string;
      sl?: string;
      tl?: string;
    };
    if (!provider || !["google", "openai"].includes(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }
    const result = await callInternalAiTranslate({
      provider,
      sourceLanguage: normalizeLang(sl),
      targetLanguage: normalizeLang(tl),
      text,
    });
    if (!result?.text) throw new Error("AI gateway returned an empty response");
    return NextResponse.json({
      provider: result.vendor,
      sl,
      tl,
      translated: result.text,
      latency_ms: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      latency_ms: Date.now() - started,
    }, { status: 500 });
  }
}

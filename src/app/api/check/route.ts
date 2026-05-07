import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/utils/errors";

interface HealthItem {
  status: "pending" | "ok" | "error";
  message: string;
}

interface ApiErrorResponse {
  error?: { message?: string };
}

function ok(message: string): HealthItem {
  return { status: "ok", message };
}

function fail(message: string): HealthItem {
  return { status: "error", message };
}

export async function GET() {
  const results: Record<string, HealthItem> = {
    supabase: { status: "pending", message: "" },
    google_translate: { status: "pending", message: "" },
    google_tts: { status: "pending", message: "" },
    google_stt: { status: "pending", message: "" },
    openai: { status: "pending", message: "" },
    naver_papago: { status: "pending", message: "" },
    pusher: { status: "pending", message: "" },
  };

  const googleApiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const naverClientId = process.env.NAVER_CLIENT_ID?.trim();
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  const pusherKey = process.env.PUSHER_KEY?.trim();
  const pusherCluster = process.env.PUSHER_CLUSTER?.trim();

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase env vars not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("sites").select("id").limit(1);
    if (error) {
      throw error;
    }

    results.supabase = ok("Connected");
  } catch (error: unknown) {
    results.supabase = fail(getErrorMessage(error));
  }

  try {
    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_CLOUD_API_KEY");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    );

    if (response.ok) {
      results.google_translate = ok("Gemini translate path active");
    } else {
      const err = (await response.json()) as ApiErrorResponse;
      results.google_translate = fail(err.error?.message || "API Error");
    }
  } catch (error: unknown) {
    results.google_translate = fail(getErrorMessage(error));
  }

  try {
    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_CLOUD_API_KEY");
    }

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: "test" },
        voice: { languageCode: "ko-KR", ssmlGender: "FEMALE" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (response.ok) {
      results.google_tts = ok("TTS engine active");
    } else {
      const err = (await response.json()) as ApiErrorResponse;
      results.google_tts = fail(err.error?.message || "API Error");
    }
  } catch (error: unknown) {
    results.google_tts = fail(getErrorMessage(error));
  }

  try {
    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_CLOUD_API_KEY");
    }

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { encoding: "LINEAR16", sampleRateHertz: 16000, languageCode: "ko-KR" },
        audio: { content: "" },
      }),
    });

    results.google_stt =
      response.ok || response.status === 400
        ? ok("STT engine active")
        : fail(`HTTP ${response.status}`);
  } catch (error: unknown) {
    results.google_stt = fail(getErrorMessage(error));
  }

  results.openai = openaiKey ? ok("Configured") : fail("Missing OPENAI_API_KEY");
  results.naver_papago =
    naverClientId && naverClientSecret
      ? ok("Configured")
      : fail("Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET");
  results.pusher =
    pusherKey && pusherCluster
      ? ok("Configured")
      : fail("Missing PUSHER_KEY or PUSHER_CLUSTER");

  return NextResponse.json(results);
}

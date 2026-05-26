import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/utils/errors";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

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
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

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

    // Cloudflare Workers 가 홍콩(HKG) 등 Gemini 미지원 지역으로 라우팅되면
    // generativelanguage.googleapis.com 는 "User location is not supported" 반환.
    // /api/translate 의 1순위 엔진인 Cloud Translation API 는 전세계 작동 →
    // health check 는 이쪽을 검증해 실 사용 기준과 일치시킴.
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: "hi", target: "ko", source: "en" }),
      }
    );

    if (response.ok) {
      results.google_translate = ok("Cloud Translate active");
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

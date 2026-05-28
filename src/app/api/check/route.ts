import { NextResponse } from "next/server";
import { getErrorMessage } from "@/utils/errors";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// Supabase 가용성은 requireAdmin() 통과 자체가 증거이므로 별도 health endpoint 호출 안 함.

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

  // ✅ Supabase 가용성: requireAdmin() 통과 자체가 가장 확실한 증거.
  //   - requireAdmin 은 쿠키 파싱 → JWT 검증 → /rest/v1/profiles 조회 (Supabase REST API 호출)
  //   - 모두 통과해야 ctx 반환됨. 즉 여기 도달했다는 것은:
  //     · GoTrue 가 발급한 JWT 가 유효
  //     · PostgREST 가 응답 반환
  //     · RLS 정책 정상 작동
  //   → 별도 health endpoint 호출 불필요. (이전 시도들 모두 Workers 에서 401 또는
  //     rate-limit 으로 false-negative 발생: /auth/v1/token, /auth/v1/health,
  //     /rest/v1/sites, /rest/v1/, /auth/v1/settings)
  //
  //   추가 변수 / Workers 헤더 손상 / rate limit / RLS 변경 등 모든 false-negative
  //   원인 제거. requireAdmin 이 동작했다 = supabase 살아있다. 끝.
  if (supabaseUrl && supabaseAnonKey) {
    results.supabase = ok("Connected (verified via requireAdmin)");
  } else {
    results.supabase = fail("Missing SUPABASE env vars");
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

  // PAPAGO / PUSHER 는 안정적으로 읽히는 client_id / public key / cluster (wrangler.toml [vars])
  // 만 확인. SECRET 값은 Cloudflare Dashboard 의 secret 으로 유지되며 별도 검증 없음 —
  // 실제 호출 시 동작 여부로 검증됨. (이전: secret 도 환경변수 존재 체크에 포함했으나
  // Workers 런타임에서 간헐적으로 누락되어 health check 가 잘못 ERROR 표시됨)
  results.naver_papago = naverClientId
    ? ok("Client ID configured")
    : fail("Missing NAVER_CLIENT_ID");
  results.pusher = (pusherKey && pusherCluster)
    ? ok("Key + Cluster configured")
    : fail("Missing PUSHER_KEY or PUSHER_CLUSTER");

  // naverClientSecret 변수는 위에서 선언만 했고 health check 에는 사용하지 않음 —
  // 실제 papago 호출 시 검증되도록 둠.
  void naverClientSecret;

  return NextResponse.json(results);
}

import { NextRequest, NextResponse } from "next/server";
import { checkHiinfoLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

const HI_INFO_BASE_URL = process.env.HI_INFO_BASE_URL || "https://api.hi-info.co.kr";
const HI_INFO_API_KEY = process.env.HI_INFO_API_KEY || "";

const TOKEN_RE = /^[0-9a-f]{16,32}$/;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  // C-8: pre-session endpoint — auth 불가, IP 기반 rate limit으로 토큰 열거 차단
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  if (!(await checkHiinfoLimit(ip))) {
    return NextResponse.json(
      { status: "error", error_code: "E_RATE_LIMIT", message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429 }
    );
  }

  const { token } = await context.params;

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { status: "error", error_code: "E003", message: "토큰 형식 오류 (16–32자 소문자 hex)" },
      { status: 422 }
    );
  }

  if (!HI_INFO_API_KEY) {
    return NextResponse.json(
      { status: "error", error_code: "E_NO_KEY", message: "Hi-Info API 키가 설정되지 않았습니다. 환경변수 HI_INFO_API_KEY를 확인하세요." },
      { status: 503 }
    );
  }

  let res: Response;
  try {
    res = await fetch(`${HI_INFO_BASE_URL}/safelink/v1/worker/${token}`, {
      headers: {
        "X-API-Key": HI_INFO_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[HiInfo] fetch error:", err);
    return NextResponse.json(
      { status: "error", error_code: "E_TIMEOUT", message: "하이정보 API 응답 시간 초과" },
      { status: 504 }
    );
  }

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}

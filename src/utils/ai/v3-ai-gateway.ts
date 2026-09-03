import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";

function mergeSetCookie(cookieHeader: string, setCookie: string | null): string {
  if (!setCookie) return cookieHeader;
  const firstPair = setCookie.split(";")[0]?.trim();
  if (!firstPair || !firstPair.includes("=")) return cookieHeader;
  const name = firstPair.split("=")[0];
  const parts = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith(`${name}=`));
  parts.push(firstPair);
  return parts.join("; ");
}

async function csrf(cookieHeader: string): Promise<{ cookie: string; token: string | null }> {
  const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as { token?: string };
  return {
    cookie: mergeSetCookie(cookieHeader, response.headers.get("set-cookie")),
    token: body.token ?? null,
  };
}

export type AiGatewayFeature =
  | "translate"
  | "stt"
  | "tts"
  | "realtime"
  | "quiz"
  | "vision"
  | "romanize";

export async function reserveV3AiGateway(
  request: Request | NextRequest,
  payload: {
    feature: AiGatewayFeature;
    siteId?: number | null;
    inputSize?: number;
    outputSize?: number;
    vendor?: string;
    model?: string;
  },
): Promise<NextResponse | null> {
  let cookie = request.headers.get("cookie") ?? "";
  if (!cookie) {
    return NextResponse.json({ error: "v3_session_required" }, { status: 401 });
  }

  const csrfToken = await csrf(cookie);
  cookie = csrfToken.cookie;

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/ai/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(csrfToken.token ? { "X-XSRF-TOKEN": csrfToken.token } : {}),
      },
      body: JSON.stringify({
        feature: payload.feature,
        siteId: payload.siteId ?? null,
        inputSize: payload.inputSize ?? 0,
        outputSize: payload.outputSize ?? 0,
        vendor: payload.vendor ?? null,
        model: payload.model ?? null,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "v3_ai_gateway_unreachable" }, { status: 503 });
  }

  if (upstream.ok) return null;
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function callV3AiVendor(
  request: Request | NextRequest,
  payload: {
    siteId: number;
    feature?: AiGatewayFeature;
    provider: "papago" | "google" | "openai" | "openai-prompt";
    sourceLanguage: string;
    targetLanguage: string;
    text: string;
    prompt?: string;
    maxOutputTokens?: number;
    temperature?: number;
  },
): Promise<{ text: string; vendor: string; model: string } | null> {
  let cookie = request.headers.get("cookie") ?? "";
  if (!cookie) return null;

  const csrfToken = await csrf(cookie);
  cookie = csrfToken.cookie;

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/ai/vendor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(csrfToken.token ? { "X-XSRF-TOKEN": csrfToken.token } : {}),
      },
      body: JSON.stringify({
        siteId: payload.siteId,
        feature: payload.feature ?? "translate",
        provider: payload.provider,
        sourceLanguage: payload.sourceLanguage,
        targetLanguage: payload.targetLanguage,
        text: payload.text,
        prompt: payload.prompt ?? null,
        maxOutputTokens: payload.maxOutputTokens ?? null,
        temperature: payload.temperature ?? null,
      }),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!upstream.ok) return null;
  const body = (await upstream.json().catch(() => null)) as { text?: string; vendor?: string; model?: string } | null;
  if (!body?.text) return null;
  return {
    text: body.text,
    vendor: body.vendor ?? payload.provider,
    model: body.model ?? "vendor",
  };
}

export async function callInternalAiTranslate(payload: {
  provider?: "auto" | "papago" | "google" | "openai";
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
}): Promise<{ text: string; vendor: string; model: string } | null> {
  const secret = process.env.TRAVEL_API_SECRET?.trim();
  if (!secret) return null;
  try {
    const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/ai/internal/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Safe-Link-Internal-Secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!upstream.ok) return null;
    const body = await upstream.json() as { translatedText?: string; vendor?: string; model?: string };
    if (!body.translatedText) return null;
    return {
      text: body.translatedText,
      vendor: body.vendor || payload.provider || "auto",
      model: body.model || "vendor",
    };
  } catch {
    return null;
  }
}

export async function callV3AiVision(
  request: Request | NextRequest,
  payload: {
    siteId: number;
    image: string;
    mimeType?: string;
    targetLanguage?: string;
    prompt: string;
  },
): Promise<Response | null> {
  let cookie = request.headers.get("cookie") ?? "";
  if (!cookie) return null;

  const csrfToken = await csrf(cookie);
  cookie = csrfToken.cookie;

  try {
    return await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/ai/vision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(csrfToken.token ? { "X-XSRF-TOKEN": csrfToken.token } : {}),
      },
      body: JSON.stringify({
        siteId: payload.siteId,
        image: payload.image,
        mimeType: payload.mimeType ?? "image/jpeg",
        targetLanguage: payload.targetLanguage ?? "ko",
        prompt: payload.prompt,
      }),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function callV3AiStt(
  request: Request | NextRequest,
  payload: {
    siteId: number;
    audio: string;
    mimeType?: string;
    languageCode: string;
    sampleRateHertz?: number;
    live: boolean;
    speechHints?: string[];
    prompt?: string;
    targetLanguages?: string[];
  },
): Promise<Response | null> {
  return callV3AiMedia(request, "/api/v1/ai/stt", payload);
}

export async function callV3AiTts(
  request: Request | NextRequest,
  payload: {
    siteId: number;
    text: string;
    voiceLanguageCode: string;
    voiceName: string;
    gender: string;
    preferOpenAi: boolean;
  },
): Promise<Response | null> {
  return callV3AiMedia(request, "/api/v1/ai/tts", payload);
}

async function callV3AiMedia(
  request: Request | NextRequest,
  path: string,
  payload: object,
): Promise<Response | null> {
  let cookie = request.headers.get("cookie") ?? "";
  if (!cookie) return null;
  const csrfToken = await csrf(cookie);
  cookie = csrfToken.cookie;
  try {
    return await fetch(`${SAFE_LINK_V3_API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...(csrfToken.token ? { "X-XSRF-TOKEN": csrfToken.token } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

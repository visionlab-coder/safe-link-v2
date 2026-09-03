import { NextResponse } from "next/server";
import { getCookieUser } from "@/utils/auth/cookie-user";
import { checkSttLimit } from "@/utils/rate-limit";
import { callV3AiStt } from "@/utils/ai/v3-ai-gateway";
import { CONSTRUCTION_SPEECH_HINTS, WHISPER_CONTEXT_PROMPT } from "@/constants/construction-terms";
import { CONSTRUCTION_GLOSSARY } from "@/constants/glossary";

export const runtime = "nodejs";

/**
 * 한국어 STT가 현장 소음에서 자주 만드는 명백한 오인식만 보정한다.
 *
 * `안전`을 말했는데 "안 센티미터" 또는 "안 미터"로 나오는 사례가 있어
 * 번역 전에 바로잡는다. 숫자와 함께 쓰인 실제 길이(예: "10센티미터")는
 * 대상이 아니므로 보존된다.
 */
function normalizeKoreanSttMisrecognitions(text: string): { normalized: string; changes: { from: string; to: string }[] } {
  const changes: { from: string; to: string }[] = [];
  const corrections: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /안\s*센티(?:미터)?/g, replacement: "안전" },
    { pattern: /안\s*미터/g, replacement: "안전" },
  ];

  let normalized = text;
  for (const { pattern, replacement } of corrections) {
    normalized = normalized.replace(pattern, (matched) => {
      changes.push({ from: matched, to: replacement });
      return replacement;
    });
  }
  return { normalized, changes };
}

function normalizeServerSide(text: string): { normalized: string; changes: { from: string; to: string }[] } {
  const sttCorrection = normalizeKoreanSttMisrecognitions(text);
  const changes: { from: string; to: string }[] = [...sttCorrection.changes];
  const sorted = Object.entries(CONSTRUCTION_GLOSSARY)
    .filter(([, standard]) => !standard.includes("("))
    .sort((a, b) => b[0].length - a[0].length);
  const placeholders: string[] = [];
  let result = sttCorrection.normalized;
  for (const [slang, standard] of sorted) {
    if (!result.includes(slang)) continue;
    changes.push({ from: slang, to: standard });
    const placeholder = `\x00${placeholders.length}\x00`;
    placeholders.push(standard);
    result = result.split(slang).join(placeholder);
  }
  placeholders.forEach((standard, index) => {
    result = result.split(`\x00${index}\x00`).join(standard);
  });
  return { normalized: result, changes };
}

const WAKE_WORD_RE = /^(ok\s*google|okay\s*google|hey\s*google|ok\s*구글|오케이\s*구글|hey\s*siri|하이\s*빅스비|hi\s*bixby|ok\s*bixby|알렉사|alexa)\.?$/i;
const JA_PHONETIC_IN_KO_RE = /고자이마스|고자이마시다|아리가또|아리가토|코니치와|고니치와|스미마셍|스미마센|와카리마스|와카리마셍|와카리마시타|나니?데스까|도코데스|도코카라|오하이오\s*고자|이키마스|이키마셍|오야스미/i;
const OPUS_SAMPLE_RATES = new Set([8000, 12000, 16000, 24000, 48000]);
const TBM_PROMPT_ECHO_RE = /오늘\s*TBM\s*안전교육을\s*시작합니다[.!。]?/i;

function isCrossTalkContamination(transcript: string, shortLang: string): boolean {
  const hasHangul = /[가-힣ㄱ-ㆎ]/.test(transcript);
  const hasKana = /[぀-ゟ゠-ヿ]/.test(transcript);
  if (shortLang === "ko") return hasKana || JA_PHONETIC_IN_KO_RE.test(transcript) || !hasHangul;
  if (shortLang === "ja") return hasHangul;
  if (shortLang === "zh") return hasHangul || hasKana;
  return false;
}

function normalizeOpusSampleRate(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && OPUS_SAMPLE_RATES.has(parsed) ? parsed : 48000;
}

function isTbmPromptEcho(transcript: string): boolean {
  // Whisper가 무음·잡음 청크에서 안내용 prompt를 그대로 돌려주는 경우를 차단한다.
  // 실제 짧은 대화가 우연히 포함되는 것은 막지 않도록, 문구와 충분한 길이를 함께 본다.
  return transcript.length > 80 && TBM_PROMPT_ECHO_RE.test(transcript);
}

export async function POST(request: Request) {
  const user = await getCookieUser({ allowV3: true });
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!(await checkSttLimit(user.id))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const siteId = user.siteIds?.[0];
  if (user.source !== "v3" || typeof siteId !== "number") {
    return NextResponse.json({ error: "V3_SITE_SESSION_REQUIRED" }, { status: 403 });
  }

  try {
    const { audio, lang, mimeType, live = false, sampleRateHertz, context = "safety", targetLanguages } = await request.json() as {
      audio?: string;
      lang?: string;
      mimeType?: string;
      live?: boolean;
      sampleRateHertz?: number;
      context?: "chat" | "safety";
      targetLanguages?: string[];
    };
    if (!audio) return NextResponse.json({ error: "No audio data" }, { status: 400 });
    if (typeof audio !== "string" || audio.length > 10 * 1024 * 1024 * (4 / 3)) {
      return NextResponse.json({ error: "Audio payload too large (max 10MB)" }, { status: 413 });
    }

    const languageCode = lang || "ko-KR";
    const shortLang = languageCode.split("-")[0];
    const isChatContext = context === "chat";
    const upstream = await callV3AiStt(request, {
      siteId,
      audio,
      mimeType,
      languageCode,
      sampleRateHertz: String(mimeType || "").includes("audio/pcm") ? 16000 : normalizeOpusSampleRate(sampleRateHertz),
      live: Boolean(live),
      speechHints: !isChatContext && shortLang === "ko" ? CONSTRUCTION_SPEECH_HINTS.slice(0, 500) : [],
      prompt: !isChatContext && shortLang === "ko" ? WHISPER_CONTEXT_PROMPT : undefined,
      targetLanguages: Array.isArray(targetLanguages) ? targetLanguages.filter((value): value is string => typeof value === "string").slice(0, 10) : [],
    });
    if (!upstream) return NextResponse.json({ error: "STT gateway unavailable" }, { status: 503 });
    if (!upstream.ok) {
      return new NextResponse(await upstream.text().catch(() => ""), {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
      });
    }

    const data = await upstream.json() as { transcript?: string; vendor?: string; translations?: Record<string, string> };
    const transcript = String(data.transcript || "").trim();
    // 무음/잡음 청크에서 Whisper가 안전 안내용 prompt 전체를 그대로 반환할 수 있다.
    // 채팅뿐 아니라 TBM·Live를 포함한 모든 한국어 STT 흐름에서 입력으로 취급하면 안 된다.
    if (!transcript || WAKE_WORD_RE.test(transcript) || isCrossTalkContamination(transcript, shortLang) || isTbmPromptEcho(transcript)) {
      return NextResponse.json({ transcript: "" });
    }
    const engine = data.vendor === "openai" ? "whisper" : data.vendor === "flitto" ? "flitto" : "google";
    const translations = data.translations && Object.keys(data.translations).length > 0 ? data.translations : undefined;
    if (shortLang !== "ko") return NextResponse.json({ transcript, engine, ...(translations && { translations }) });
    const { normalized, changes } = normalizeServerSide(transcript);
    return NextResponse.json({
      transcript: normalized,
      ...(changes.length > 0 && { normalized: true, changes }),
      engine,
      ...(translations && { translations }),
      ...(live && { live: true }),
    });
  } catch (error) {
    console.error("[STT API] Error:", error);
    return NextResponse.json({ error: "STT unavailable" }, { status: 500 });
  }
}

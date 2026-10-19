import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";
import { freeTalkGlossary, normalizeFreeTalk } from "@/utils/free-talk-glossary";
import { normalizeKoreanGlossary, GLOSSARY_POLICY_VERSION } from "@/utils/korean-glossary";
import { hangulize } from "@/utils/hangulize";

export const runtime = "nodejs";
const COOKIE = "SAFE_LINK_FREE_TALK";
const LANGS = new Set(["ko", "ja", "en", "zh", "vi"]);
const ACTIONS = new Set(["session", "room", "join", "signal", "translate", "stt", "tts", "events"]);
type Context = { params: Promise<{ action: string }> };

function sameOrigin(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  const publicUrl = process.env.SAFE_LINK_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SAFE_LINK_APP_URL;
  const expected = publicUrl ? new URL(publicUrl).origin : request.nextUrl.origin;
  // Audio/EventSource GETs may omit Origin; require their same-origin browser metadata.
  if (!origin) return request.method === "GET" && request.headers.get("sec-fetch-site") === "same-origin";
  return origin === expected || (process.env.NODE_ENV === "development" && origin === request.nextUrl.origin);
}

async function handle(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!ACTIONS.has(action) || (request.method === "GET" && action !== "events") || (request.method === "POST" && action === "events")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "origin_denied" }, { status: 403 });
  const secret = process.env.TRAVEL_API_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "free_talk_unavailable" }, { status: 503 });
  const token = request.cookies.get(COOKIE)?.value;
  if (action !== "session" && !token) return NextResponse.json({ error: "free_talk_session_expired" }, { status: 401 });
  // No SQ-LINK login cookies are forwarded: no site, role or account privileges in this feature.
  const peer = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  const headers = {
    "Content-Type": "application/json", "X-Safe-Link-Internal-Secret": secret,
    "X-Free-Talk-Session": token || "", "X-Free-Talk-Peer": createHash("sha256").update(peer).digest("hex"),
  };
  const upstream = (endpoint: string, body?: unknown, stream = false) => fetch(
    `${SAFE_LINK_V3_API_BASE_URL}/api/v1/free-talk/internal/${endpoint}`, {
      method: stream ? "GET" : "POST", headers, body: stream ? undefined : JSON.stringify(body || {}),
      cache: "no-store", signal: stream ? request.signal : AbortSignal.timeout(25_000),
    });
  try {
    if (action === "events") {
      const room = request.nextUrl.searchParams.get("room") || "";
      if (!/^\d{8}$/.test(room)) return NextResponse.json({ error: "invalid_room" }, { status: 400 });
      const res = await upstream(`events?room=${room}`, undefined, true);
      return new Response(res.body, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
    }
    const raw = request.method === "POST" ? await request.text() : "";
    if (raw.length > (action === "stt" ? 2_801_000 : 20000)) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    const body = request.method === "GET" ? Object.fromEntries(request.nextUrl.searchParams) : JSON.parse(raw || "{}");
    let stage: ReturnType<typeof normalizeFreeTalk> | undefined;
    if (action === "translate") {
      if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000 || !LANGS.has(body.from) || !LANGS.has(body.to)) {
        return NextResponse.json({ error: "invalid_translation_input" }, { status: 400 });
      }
      stage = normalizeFreeTalk(body.text, body.from, body.to, await freeTalkGlossary(SAFE_LINK_V3_API_BASE_URL));
    }
    const res = await upstream(action, stage ? { ...body, text: stage.normalized } : body);
    if (!res.ok) return NextResponse.json({ error: res.status === 401 ? "free_talk_session_expired" : res.status === 429 ? "free_talk_rate_limited" : "free_talk_request_failed" }, { status: res.status });
    const data = await res.json();
    if (action === "session") {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(COOKIE, data.handle, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/free-talk", maxAge: data.maxAge });
      return response;
    }
    if (action === "tts") return new Response(Buffer.from(data.audioBase64,"base64"), { headers: { "Content-Type": data.contentType || "audio/mpeg", "Cache-Control": "private, no-store" } });
    if (stage) {
      let translated = String(data.translated || "");
      if (body.to === "ko") translated = normalizeKoreanGlossary(translated, await freeTalkGlossary(SAFE_LINK_V3_API_BASE_URL)).normalized;
      let reverse_translated = "";
      if (body.learning && translated && translated.length <= 2000) {
        // Optional learning support must not discard an already successful primary translation.
        const reverse = await upstream("translate", { text: translated, from: body.to, to: body.from }).catch(() => null);
        if (reverse?.ok) reverse_translated = String((await reverse.json()).translated || "");
      }
      return NextResponse.json({ ...data, translated, originalText: stage.original, normalizedText: stage.normalized, glossaryChanges: stage.changes, glossaryPolicyVersion: GLOSSARY_POLICY_VERSION,
        pronunciation: body.learning && body.from === "ko" ? hangulize(translated, body.to) : "", reverse_translated });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "free_talk_unavailable" }, { status: 503 });
  }
}

export const POST = handle;
export const GET = handle;

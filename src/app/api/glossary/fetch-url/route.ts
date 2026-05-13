import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 1_000_000;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  let body: { url?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawUrl = String(body.url || "").trim();
  let target: URL;

  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }

  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "blocked_host" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "SAFE-LINK glossary importer/1.0",
        accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: response.status },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "response_too_large" }, { status: 413 });
    }

    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
    const text = contentType.includes("html") ? htmlToText(rawText) : rawText.trim();
    const title = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || target.hostname;

    return NextResponse.json({ title, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: "fetch_error", message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

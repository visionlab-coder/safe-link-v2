import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { promises as dns, lookup as dnsLookupCb, type LookupOptions } from "dns";
import * as http from "node:http";
import * as https from "node:https";

const MAX_BYTES = 1_000_000;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();

  // Exact-match blocklist and common private/loopback names
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) return true;

  // RFC-1918 private ranges
  if (
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) return true;

  // 169.254.x.x — link-local / AWS IMDS
  if (/^169\.254\./.test(host)) return true;

  // 100.64.x.x – 100.127.x.x — CGNAT shared address space (RFC 6598)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;

  // 0.x.x.x — "this" network
  if (/^0\./.test(host)) return true;

  // IPv4 decimal / hex encoding bypasses (e.g. 2130706433 = 127.0.0.1, 0x7f000001)
  if (/^(0x[0-9a-f]+|\d{8,10})$/i.test(host)) return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, ::ffff:169.254.169.254)
  // Recursive check: extract the embedded IPv4 address and re-run all rules.
  if (host.startsWith("::ffff:")) return isBlockedHost(host.slice(7));

  // IPv6 loopback / link-local / unique-local
  if (
    host.startsWith("fe80:") ||
    host.startsWith("fc00:") ||
    host.startsWith("fd00:") ||
    host === "::1"
  ) return true;

  return false;
}

async function resolveAndCheckHost(hostname: string): Promise<boolean> {
  try {
    const [v4Result, v6Result] = await Promise.allSettled([
      dns.lookup(hostname, { family: 4 }),
      dns.lookup(hostname, { family: 6 }),
    ]);
    if (v4Result.status === "fulfilled" && isBlockedHost(v4Result.value.address)) return true;
    if (v6Result.status === "fulfilled" && isBlockedHost(v6Result.value.address)) return true;
    if (v4Result.status === "rejected" && v6Result.status === "rejected") return true;
    return false;
  } catch {
    return true;
  }
}

// Socket-level IP pinning (ADV-003):
// Node.js http/https modules accept a custom `lookup` function that intercepts DNS resolution.
// By injecting our validation here, the socket connects to the IP we verified —
// DNS cannot change between our check and the actual TCP connection (no TOCTOU window).
function makeSafeLookup(hostname: string) {
  return function safeLookup(
    host: string,
    opts: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) {
    dnsLookupCb(host, { family: opts.family as 4 | 6 | 0 | undefined }, (err, address, family) => {
      if (err) return callback(err, "", 0);
      if (isBlockedHost(address)) {
        return callback(
          Object.assign(new Error(`blocked_host: ${hostname} resolved to ${address}`), { code: "EBLOCKED" }),
          "",
          0
        );
      }
      callback(null, address, family);
    });
  };
}

function fetchWithIpPinning(target: URL, signal: AbortSignal): Promise<{ status: number; headers: http.IncomingMessage["headers"]; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = target.protocol === "https:";
    const port = target.port ? parseInt(target.port) : (isHttps ? 443 : 80);
    const options = {
      hostname: target.hostname,
      port,
      path: target.pathname + target.search,
      method: "GET",
      headers: {
        "user-agent": "SAFE-LINK glossary importer/1.0",
        "accept": "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "host": target.host,
      },
      lookup: makeSafeLookup(target.hostname),
      // No redirect following — block SSRF via open redirects
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });

    req.on("error", reject);
    signal.addEventListener("abort", () => { req.destroy(); reject(new Error("aborted")); }, { once: true });
    req.end();
  });
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
  // Admin-only endpoint — reject unauthenticated or non-admin requests
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const ADMIN_ROLES = new Set(["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER", "SAFETY_OFFICER", "SITE_ADMIN"]);
  if (!profile || !ADMIN_ROLES.has(String(profile.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  // Pre-flight hostname check (catches obvious cases before TCP connection)
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "blocked_host" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    // ADV-003: fetchWithIpPinning uses Node.js http/https with a custom `lookup` that
    // validates the resolved IP before the socket connects. This closes the TOCTOU window
    // that existed with fetch() + post-fetch DNS re-resolution: the socket is bound to the
    // IP we vetted, so a DNS rebinding attack cannot redirect the connection mid-flight.
    const response = await fetchWithIpPinning(target, controller.signal);

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: "redirect_blocked" }, { status: 400 });
    }

    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    }

    if (response.body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "response_too_large" }, { status: 413 });
    }

    const contentType = String(response.headers["content-type"] || "");
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(response.body);
    const text = contentType.includes("html") ? htmlToText(rawText) : rawText.trim();
    const title = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || target.hostname;

    return NextResponse.json({ title, text });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "EBLOCKED") return NextResponse.json({ error: "blocked_host" }, { status: 400 });
    return NextResponse.json({ error: "fetch_error" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

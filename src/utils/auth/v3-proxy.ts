import "server-only";
import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

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

async function ensureCsrf(req: NextRequest, cookieHeader: string): Promise<{ cookie: string; csrf: string | null; setCookie: string | null }> {
  const existing = req.headers.get("x-xsrf-token");
  if (existing) {
    return { cookie: cookieHeader, csrf: existing, setCookie: null };
  }

  const csrfResponse = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { token?: string };
  const setCookie = csrfResponse.headers.get("set-cookie");
  return {
    cookie: mergeSetCookie(cookieHeader, setCookie),
    csrf: csrfBody.token ?? null,
    setCookie,
  };
}

export async function proxyV3Api(req: NextRequest, path: string, init: RequestInit = {}): Promise<NextResponse> {
  const method = (init.method || "GET").toUpperCase();
  let cookie = req.headers.get("cookie") ?? "";
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let csrfSetCookie: string | null = null;
  if (!SAFE_METHODS.has(method)) {
    const csrf = await ensureCsrf(req, cookie);
    cookie = csrf.cookie;
    csrfSetCookie = csrf.setCookie;
    if (cookie) headers.set("cookie", cookie);
    if (csrf.csrf) headers.set("X-XSRF-TOKEN", csrf.csrf);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}${path}`, {
      ...init,
      method,
      headers,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "v3_api_unreachable" }, { status: 503 });
  }

  const response = new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  if (csrfSetCookie) response.headers.append("set-cookie", csrfSetCookie);
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}

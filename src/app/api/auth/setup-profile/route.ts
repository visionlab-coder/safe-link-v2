import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.SAFE_LINK_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  let cookie = req.headers.get("cookie") ?? "";
  // 로그인 직후에는 session fixation 방어로 서버 세션이 교체될 수 있다.
  // 브라우저에 남은 이전 XSRF 토큰을 재사용하면 403이 될 수 있으므로,
  // profile 변경 전에는 현재 세션용 토큰을 항상 새로 받아 사용한다.
  let csrf: string | null = null;
  try {
    const csrfResponse = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    if (!csrfResponse.ok) {
      return NextResponse.json({ error: "csrf_unavailable" }, { status: 503 });
    }
    const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { token?: string };
    csrf = csrfBody.token ?? null;
    cookie = mergeSetCookie(cookie, csrfResponse.headers.get("set-cookie"));
  } catch {
    return NextResponse.json({ error: "auth_unreachable" }, { status: 503 });
  }

  if (!csrf) return NextResponse.json({ error: "csrf_unavailable" }, { status: 503 });

  const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/setup-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "X-XSRF-TOKEN": csrf } : {}),
    },
    body,
    cache: "no-store",
  });

  const response = new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}

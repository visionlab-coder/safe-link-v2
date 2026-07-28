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
  let cookie = req.headers.get("cookie") ?? "";
  const csrfResponse = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });
  const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { token?: string };
  const csrf = csrfBody.token ?? null;
  if (!csrfResponse.ok || !csrf) {
    return NextResponse.json({ error: "csrf_refresh_failed" }, { status: 503 });
  }
  cookie = mergeSetCookie(cookie, csrfResponse.headers.get("set-cookie"));

  const upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      "X-XSRF-TOKEN": csrf,
    },
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
  if (upstream.ok) {
    const expired = new Date(0);
    response.cookies.set("SAFE_LINK_SESSION", "", {
      path: "/",
      maxAge: 0,
      expires: expired,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    response.cookies.set("XSRF-TOKEN", "", {
      path: "/",
      maxAge: 0,
      expires: expired,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
  return response;
}

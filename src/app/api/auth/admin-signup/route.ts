import { NextRequest, NextResponse } from "next/server";
import { handleMobilePreflight } from "@/utils/auth/mobile-cors";
import { checkAdminSignupLimit } from "@/utils/rate-limit";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.SAFE_LINK_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

const ALLOWED_ADMIN_SIGNUP_DOMAINS = new Set(["seowonenc.co.kr"]);

const FORBIDDEN_ADMIN_SIGNUP_FIELDS = new Set([
  "role",
  "roles",
  "site",
  "sites",
  "siteid",
  "siteids",
  "accountstatus",
  "isadmin",
  "admin",
  "permission",
  "permissions",
  "claims",
]);

function hasForbiddenField(body: Record<string, unknown>): boolean {
  return Object.keys(body).some((key) =>
    FORBIDDEN_ADMIN_SIGNUP_FIELDS.has(key.replace(/[_-]/g, "").toLowerCase()),
  );
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

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

function backendUnavailableResponse(): NextResponse {
  return NextResponse.json({ error: "v3_backend_unreachable" }, { status: 503 });
}

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (hasForbiddenField(body)) {
    return NextResponse.json({ error: "admin_signup_role_fields_not_allowed" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.display_name ?? "").trim();
  const preferredLang = /^[a-z]{2,5}$/i.test(String(body.preferred_lang ?? ""))
    ? String(body.preferred_lang).toLowerCase()
    : "ko";

  if (!email || !password) {
    return NextResponse.json({ error: "email_password_required" }, { status: 400 });
  }

  const emailParts = email.split("@");
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }
  if (!ALLOWED_ADMIN_SIGNUP_DOMAINS.has(emailParts[1])) {
    return NextResponse.json({ error: "DOMAIN_NOT_ALLOWED" }, { status: 403 });
  }

  if (!(await checkAdminSignupLimit(ip, email))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let cookie = req.headers.get("cookie") ?? "";
  let csrf = req.headers.get("x-xsrf-token") ?? readCookieValue(cookie, "XSRF-TOKEN");

  if (!csrf) {
    try {
      const csrfResponse = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/csrf`, {
        headers: cookie ? { cookie } : undefined,
        cache: "no-store",
      });
      const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { token?: string };
      csrf = csrfBody.token ?? null;
      cookie = mergeSetCookie(cookie, csrfResponse.headers.get("set-cookie"));
    } catch {
      return backendUnavailableResponse();
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/admin-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { "X-XSRF-TOKEN": csrf } : {}),
      },
      body: JSON.stringify({
        email,
        password,
        preferred_lang: preferredLang,
        ...(displayName ? { display_name: displayName } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return backendUnavailableResponse();
  }

  const upstreamText = await upstream.text();
  const setCookie = upstream.headers.get("set-cookie");

  if (!upstream.ok) {
    let upstreamError: string | null = null;
    try {
      const parsed = JSON.parse(upstreamText) as { error?: unknown };
      upstreamError = typeof parsed.error === "string" ? parsed.error : null;
    } catch {
      upstreamError = null;
    }

    const response = NextResponse.json(
      {
        error:
          upstreamError ??
          (upstream.status === 403
            ? "admin_signup_forbidden_by_security_filter"
            : `v3_admin_signup_failed_${upstream.status}`),
      },
      { status: upstream.status },
    );
    if (setCookie) response.headers.append("set-cookie", setCookie);
    return response;
  }

  const response = new NextResponse(upstreamText, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });

  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}

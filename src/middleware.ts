import { NextResponse, type NextRequest } from "next/server";
import { canAccessSystem, hasAllowedRole, type ProfileRole } from "@/lib/roles";

const AI_API_PREFIXES = [
  "/api/stt",
  "/api/tts",
  "/api/romanize",
  "/api/vision",
];
const AI_API_EXACT_PATHS = new Set(["/api/quiz"]);

const V3_API_BASE_URL = process.env.SAFE_LINK_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";
const SAFE_LINK_PUBLIC_APP_URL = process.env.SAFE_LINK_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "production" ? "https://app.safe-link.co.kr" : "");

type V3AuthResult = {
  userId: number;
  roles: ProfileRole[];
};

async function resolveV3Auth(request: NextRequest): Promise<V3AuthResult | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  try {
    const res = await fetch(`${V3_API_BASE_URL}/api/v1/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: number; roles?: string[] };
    if (typeof data.id !== "number" || !Array.isArray(data.roles)) return null;
    return {
      userId: data.id,
      roles: data.roles.map((role) => role.toUpperCase() as ProfileRole),
    };
  } catch {
    return null;
  }
}

function publicRedirect(pathname: string, request: NextRequest): NextResponse {
  // A standalone Next.js server commonly sees its own internal host (localhost).
  // Never build a browser-facing redirect from that host in production.
  const origin = SAFE_LINK_PUBLIC_APP_URL || request.nextUrl.origin;
  return NextResponse.redirect(new URL(pathname, origin));
}

function needsV3AiAuth(pathname: string): boolean {
  return AI_API_EXACT_PATHS.has(pathname) ||
    AI_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function protectedResponse(request: NextRequest): NextResponse {
  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (needsV3AiAuth(pathname)) {
    const v3Auth = await resolveV3Auth(request);
    if (!v3Auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return protectedResponse(request);
  }

  const needsRoleCheck =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/worker") ||
    pathname.startsWith("/system") ||
    pathname.startsWith("/control");

  if (!needsRoleCheck) {
    return NextResponse.next({ request });
  }

  const v3Auth = await resolveV3Auth(request);
  if (!v3Auth) {
    return publicRedirect("/auth", request);
  }

  if (pathname.startsWith("/system")) {
    if (!v3Auth.roles.some((role) => canAccessSystem(role))) {
      return publicRedirect("/", request);
    }
  } else if (pathname.startsWith("/admin")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "admin"))) {
      return publicRedirect("/auth", request);
    }
  } else if (pathname.startsWith("/control")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "hq"))) {
      return publicRedirect("/auth", request);
    }
  } else if (pathname.startsWith("/worker")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "worker"))) {
      return publicRedirect("/auth", request);
    }
  }

  return protectedResponse(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/worker/:path*",
    "/system/:path*",
    "/control/:path*",
    "/api/stt/:path*",
    "/api/tts/:path*",
    "/api/romanize/:path*",
    "/api/vision/:path*",
    "/api/quiz",
  ],
};

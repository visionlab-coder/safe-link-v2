import { NextResponse, type NextRequest } from "next/server";
import { canAccessSystem, hasAllowedRole, type ProfileRole } from "@/lib/roles";

const AI_API_PREFIXES = [
  "/api/stt",
  "/api/tts",
  "/api/romanize",
  "/api/vision",
];
const AI_API_EXACT_PATHS = new Set(["/api/quiz"]);

const V3_API_BASE_URL = process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

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

function needsV3AiAuth(pathname: string): boolean {
  return AI_API_EXACT_PATHS.has(pathname) ||
    AI_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (needsV3AiAuth(pathname)) {
    const v3Auth = await resolveV3Auth(request);
    if (!v3Auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next({ request });
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
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (pathname.startsWith("/system")) {
    if (!v3Auth.roles.some((role) => canAccessSystem(role))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } else if (pathname.startsWith("/admin")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "admin"))) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  } else if (pathname.startsWith("/control")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "hq"))) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  } else if (pathname.startsWith("/worker")) {
    if (!v3Auth.roles.some((role) => hasAllowedRole(role, "worker"))) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  }

  return NextResponse.next({ request });
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

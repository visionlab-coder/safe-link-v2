import { NextRequest, NextResponse } from "next/server";
import { withMobileCors, handleMobilePreflight } from "@/utils/auth/mobile-cors";

export const runtime = "nodejs";

const SAFE_LINK_V3_API_BASE_URL =
  process.env.NEXT_PUBLIC_SAFE_LINK_API_BASE_URL || "http://localhost:8080";

const V3_ROLE_PRIORITY = ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER", "WORKER", "VIEWER"];

function pickV3PrimaryRole(roles: string[] | undefined): string | null {
  if (!Array.isArray(roles)) return null;
  return V3_ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}

async function handleV3Me(req: NextRequest): Promise<NextResponse> {
  const cookie = req.headers.get("cookie");
  if (!cookie) {
    return NextResponse.json({ error: "v3_session_required" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SAFE_LINK_V3_API_BASE_URL}/api/v1/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "v3_auth_unreachable" }, { status: 503 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "v3_session_required" }, { status: upstream.status });
  }

  const currentUser = (await upstream.json()) as {
    id?: number;
    email?: string | null;
    displayName?: string | null;
    preferredLanguage?: string | null;
    roles?: string[];
    siteIds?: number[];
  };
  if (typeof currentUser.id !== "number") {
    return NextResponse.json({ error: "v3_current_user_invalid" }, { status: 502 });
  }

  const role = pickV3PrimaryRole(currentUser.roles);
  const response = NextResponse.json({
    user: {
      id: String(currentUser.id),
      email: currentUser.email ?? null,
    },
    profile: role
      ? {
          role,
          preferred_lang: currentUser.preferredLanguage ?? null,
          display_name: currentUser.displayName ?? null,
          title: null,
          site_code: null,
          site_id: currentUser.siteIds?.[0] != null ? String(currentUser.siteIds[0]) : null,
          trade: null,
          nationality: null,
        }
      : null,
    v3: currentUser,
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }
  return response;
}

export async function OPTIONS(req: NextRequest) {
  return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function GET(req: NextRequest) {
  return withMobileCors(await handleV3Me(req), req.headers.get("origin"));
}

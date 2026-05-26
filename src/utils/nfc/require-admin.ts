import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SAFE-LINK — 관리자 전용 API 가드
 *
 * 인증 + 역할 검증은 raw 쿠키 파싱 + raw fetch (apikey URL param) 방식.
 * Workers 런타임의 @supabase/ssr · @supabase/supabase-js 불안정성 우회.
 *
 * service 클라이언트는 service_role_key 로 createClient — 기존 라우트 호환 유지.
 * (service 호출 시 Workers 헤더 손상 발생하면 해당 라우트별로 raw fetch 로 별도 우회)
 */

const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";
const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

const ADMIN_ROLES = new Set([
  "ROOT",
  "SUPER_ADMIN",
  "HQ_ADMIN",
  "HQ_OFFICER",
  "SAFETY_OFFICER",
  "SITE_ADMIN",
]);

export interface AdminContext {
  user: { id: string; email?: string | null; role: string; site_id?: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>;
}

export type AdminGuardResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

function unauthorized(): AdminGuardResult {
  return { ok: false, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
}

function forbidden(): AdminGuardResult {
  return { ok: false, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
}

function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminGuardResult> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawCookie) return unauthorized();

  // 쿠키 → session JSON
  let session: { access_token?: string } | null = null;
  try {
    const inner = rawCookie.startsWith("base64-")
      ? Buffer.from(rawCookie.slice(7), "base64").toString("utf-8")
      : rawCookie;
    session = JSON.parse(inner);
  } catch {
    return unauthorized();
  }

  const accessToken = session?.access_token;
  if (!accessToken) return unauthorized();

  // JWT payload — 만료/sub 확인 (서명 검증은 Supabase 가 RLS 호출 시 수행)
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.sub) return unauthorized();
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return unauthorized();

  const userId = payload.sub;
  const email = payload.email ?? null;

  // profile 조회 — apikey URL param + Bearer 사용자 JWT (RLS 적용)
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=role,site_id&id=eq.${userId}&limit=1&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!profileRes.ok) return unauthorized();

  const rows = (await profileRes.json()) as Array<{ role?: string; site_id?: string }>;
  const profile = rows[0];
  if (!profile?.role) return forbidden();

  const role = String(profile.role).toUpperCase();
  if (!ADMIN_ROLES.has(role)) return forbidden();

  // service client (기존 라우트 호환). Workers 헤더 손상 시 호출 부에서 raw fetch 로 우회.
  const serviceUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceUrl || !serviceKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient<any, any, any>(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    ok: true,
    ctx: {
      user: {
        id: userId,
        email,
        role,
        site_id: profile.site_id ?? null,
      },
      service,
    },
  };
}

export function isGlobalAdmin(role: string): boolean {
  return ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"].includes(role.toUpperCase());
}

export function canAccessSite(user: AdminContext["user"], siteId?: string | null): boolean {
  if (isGlobalAdmin(user.role)) return true;
  return Boolean(user.site_id && siteId && String(user.site_id) === String(siteId));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function requireSameSite(user: AdminContext["user"], siteId?: string | null): NextResponse | null {
  if (canAccessSite(user, siteId)) return null;
  if (!user.site_id) {
    return NextResponse.json({ error: "admin_site_required" }, { status: 409 });
  }
  return NextResponse.json({ error: "cross_site_access_denied" }, { status: 403 });
}

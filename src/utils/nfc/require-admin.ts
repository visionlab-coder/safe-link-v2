import "server-only";
import { NextResponse } from "next/server";
import { createClient as createServer } from "@/utils/supabase/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SAFE-LINK — 관리자 전용 API 가드
 * 통과 시 service-role supabase 클라이언트와 admin user 정보를 반환한다.
 */

const ADMIN_ROLES = new Set(["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER", "SAFETY_OFFICER"]);

export interface AdminContext {
  user: { id: string; email?: string | null; role: string; site_id?: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>;
}

export type AdminGuardResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const supa = await createServer();
  const { data: { user }, error: userErr } = await supa.auth.getUser();

  if (userErr || !user) {
    return { ok: false, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const { data: profile, error: profErr } = await supa
    .from("profiles")
    .select("role, site_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr || !profile || !ADMIN_ROLES.has(String(profile.role).toUpperCase())) {
    return { ok: false, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  const serviceUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
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
        id: user.id,
        email: user.email ?? null,
        role: String(profile.role),
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

export function requireSameSite(user: AdminContext["user"], siteId?: string | null): NextResponse | null {
  if (canAccessSite(user, siteId)) return null;
  if (!user.site_id) {
    return NextResponse.json({ error: "admin_site_required" }, { status: 409 });
  }
  return NextResponse.json({ error: "cross_site_access_denied" }, { status: 403 });
}

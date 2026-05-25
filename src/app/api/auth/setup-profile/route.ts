import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  getProfileRoleFromSetupRole,
  ROLE_HIERARCHY,
  type SetupRoleKey,
  type ProfileRole,
} from "@/lib/roles";

export const runtime = "nodejs";

type SetupBody = {
  setupRole: SetupRoleKey;
  display_name: string;
  preferred_lang?: string;
  phone_number?: string;
  trade?: string;
  title?: string;
  site_code?: string;
  site_id?: string | null;
};

function createService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * POST /api/auth/setup-profile
 * 프로필 초기 설정 — role/system_role은 서버에서만 기록 (C-3 fix)
 * REVOKE UPDATE(role, system_role) 이후 클라이언트가 직접 쓸 수 없으므로 이 엔드포인트 경유 필수
 *
 * 권한 상승 방지:
 *  - 기존 프로필이 있는 사용자는 자신보다 높은 tier로 변경 불가 (WORKER → HQ_ADMIN 차단)
 *  - root/hq_officer는 환경변수 이메일 화이트리스트 추가 검증
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: SetupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { setupRole, display_name } = body;
  if (!setupRole || !display_name?.trim()) {
    return NextResponse.json({ error: "setupRole_display_name_required" }, { status: 400 });
  }

  const VALID_SETUP_ROLES: SetupRoleKey[] = ["site_manager", "safety_officer", "gongmu", "worker", "root", "hq_officer"];
  if (!VALID_SETUP_ROLES.includes(setupRole)) {
    return NextResponse.json({ error: "invalid_setup_role" }, { status: 400 });
  }

  // 특권 역할(ROOT / HQ_OFFICER)은 서버 환경변수 이메일 목록과 대조
  const email = user.email ?? "";
  if (setupRole === "root" || setupRole === "hq_officer") {
    const masterEmails = (process.env.MASTER_EMAILS ?? "")
      .split(",").map((e) => e.trim()).filter(Boolean);
    const hqOfficerEmails = (process.env.HQ_OFFICER_EMAILS ?? "")
      .split(",").map((e) => e.trim()).filter(Boolean);

    if (setupRole === "root" && !masterEmails.includes(email)) {
      return NextResponse.json({ error: "unauthorized_role" }, { status: 403 });
    }
    if (setupRole === "hq_officer" && !hqOfficerEmails.includes(email)) {
      return NextResponse.json({ error: "unauthorized_role" }, { status: 403 });
    }
  }

  const targetRole = getProfileRoleFromSetupRole(setupRole);
  const service = createService();

  // 기존 프로필 조회 — 권한 상승 방지 (WORKER → HQ_ADMIN 등)
  const { data: existingProfile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile?.role) {
    const currentTier = ROLE_HIERARCHY[existingProfile.role as ProfileRole] ?? 0;
    const targetTier = ROLE_HIERARCHY[targetRole] ?? 0;
    // 기존 tier보다 높은 역할로 자체 변경 금지 (관리자 재배정은 별도 관리자 API 사용)
    if (targetTier > currentTier) {
      return NextResponse.json({ error: "role_escalation_denied" }, { status: 403 });
    }
  }

  const systemRole = (setupRole === "root" || setupRole === "hq_officer") ? "ROOT" : null;

  const { error } = await service.from("profiles").upsert({
    id: user.id,
    display_name: display_name.trim(),
    role: targetRole,
    system_role: systemRole,
    preferred_lang: body.preferred_lang ?? "ko",
    phone_number: body.phone_number?.trim() ?? null,
    trade: body.trade?.trim() ?? null,
    title: body.title?.trim() ?? null,
    site_code: body.site_code?.trim() ?? null,
    site_id: body.site_id ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "profile_upsert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: targetRole });
}

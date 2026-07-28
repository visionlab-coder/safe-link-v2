import { normalizeToV3Role, type V3Role } from "./v3-role-contract";

export type SetupRoleKey =
  | "site_manager"
  | "safety_officer"
  | "team_leader"   // 🆕 공종별 팀장 (철근·거푸집·콘크리트·마감·설비 등)
  | "gongmu"
  | "worker"
  | "root"
  | "hq_officer";

type LegacyProfileRole = "SAFETY_OFFICER" | "TEAM_LEADER" | "HQ_OFFICER" | "SUPER_ADMIN";

/** V3 canonical role plus legacy aliases accepted only during migration. */
export type ProfileRole =
  | V3Role
  | LegacyProfileRole;

export type AllowedRole = "admin" | "worker" | "hq" | "system";

/** 공종/팀 분류 — profiles.trade 컬럼에 저장.
 *  TEAM_LEADER 가 본인 팀 식별 + 워커 분류용. */
export type TradeType =
  | "rebar"       // 철근반
  | "formwork"    // 거푸집반
  | "concrete"    // 콘크리트반 / 타설
  | "scaffold"    // 비계반
  | "electrical"  // 전기반
  | "mep"         // 기계·설비·배관 (HVAC, plumbing)
  | "finishing"   // 마감반 (조적·미장·도장 등)
  | "earthwork"   // 토공·터파기
  | "structural"  // 구체조립
  | "general";    // 일반/공통

/** 역할별 권한 등급 (높을수록 상위 권한) */
export const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  VIEWER: 0,
  WORKER: 1,
  TEAM_LEADER: 2,
  SAFETY_MANAGER: 2,
  SAFETY_OFFICER: 2,
  SITE_ADMIN: 2,
  HQ_OFFICER: 2,
  HQ_ADMIN: 3,
  ROOT: 90,
  SUPER_ADMIN: 99,
};

export const SETUP_ROLE_TO_PROFILE_ROLE: Record<SetupRoleKey, ProfileRole> = {
  site_manager: "SITE_ADMIN",
  safety_officer: "SAFETY_MANAGER",
  team_leader: "SAFETY_MANAGER",
  gongmu: "SITE_ADMIN",
  worker: "WORKER",
  root: "ROOT",
  hq_officer: "HQ_ADMIN",
};

export const PROFILE_ROLE_DEFAULT_ROUTE: Record<ProfileRole, string> = {
  HQ_ADMIN: "/control",
  SITE_ADMIN: "/admin",
  SAFETY_MANAGER: "/admin",
  WORKER: "/worker",
  VIEWER: "/admin",
  ROOT: "/system",
  SAFETY_OFFICER: "/admin",
  TEAM_LEADER: "/admin",
  HQ_OFFICER: "/system",
  SUPER_ADMIN: "/system",
};

export function getProfileRoleFromSetupRole(role: SetupRoleKey): ProfileRole {
  return SETUP_ROLE_TO_PROFILE_ROLE[role];
}

export function getDefaultRouteForProfileRole(role: ProfileRole): string {
  const v3Role = normalizeToV3Role(role);
  if (v3Role) return PROFILE_ROLE_DEFAULT_ROUTE[v3Role];
  return PROFILE_ROLE_DEFAULT_ROUTE[role];
}

/** SUPER_ADMIN 여부 확인 */
export function isSuperAdmin(role: ProfileRole): boolean {
  return normalizeToV3Role(role) === "ROOT";
}

/** /system 진입 가능 여부 — V3에서는 ROOT만 허용한다. */
export function canAccessSystem(role: ProfileRole): boolean {
  return normalizeToV3Role(role) === "ROOT";
}

/** ROLE_HIERARCHY 기반 최소 권한 충족 여부 */
export function hasMinRole(role: ProfileRole, minRole: ProfileRole): boolean {
  const normalizedRole = normalizeToV3Role(role) ?? role;
  const normalizedMinRole = normalizeToV3Role(minRole) ?? minRole;
  return ROLE_HIERARCHY[normalizedRole] >= ROLE_HIERARCHY[normalizedMinRole];
}

export function hasAllowedRole(role: ProfileRole, allowedRole: AllowedRole): boolean {
  const v3Role = normalizeToV3Role(role);
  if (!v3Role) return false;

  if (v3Role === "ROOT") {
    return true;
  }

  if (allowedRole === "system") {
    return false;
  }

  if (allowedRole === "admin") {
    return v3Role === "HQ_ADMIN" || v3Role === "SITE_ADMIN" || v3Role === "SAFETY_MANAGER" || v3Role === "VIEWER";
  }

  if (allowedRole === "hq") {
    return v3Role === "HQ_ADMIN";
  }

  return v3Role === "WORKER";
}

/** TEAM_LEADER 여부 — admin 페이지에서 본인 팀(trade) 필터 적용에 사용 */
export function isTeamLeader(role: ProfileRole): boolean {
  return role === "TEAM_LEADER";
}

/** 공종 코드 → 한국어 표시명 */
export const TRADE_LABEL: Record<TradeType, string> = {
  rebar: "철근반",
  formwork: "거푸집반",
  concrete: "콘크리트반",
  scaffold: "비계반",
  electrical: "전기반",
  mep: "설비반",
  finishing: "마감반",
  earthwork: "토공반",
  structural: "구체조립반",
  general: "일반",
};

export const TRADE_TYPES: Array<{ code: TradeType; name: string }> = (
  Object.keys(TRADE_LABEL) as TradeType[]
).map((c) => ({ code: c, name: TRADE_LABEL[c] }));

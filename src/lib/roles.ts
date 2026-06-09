export type SetupRoleKey =
  | "site_manager"
  | "safety_officer"
  | "team_leader"   // 🆕 공종별 팀장 (철근·거푸집·콘크리트·마감·설비 등)
  | "gongmu"
  | "worker"
  | "root"
  | "hq_officer";

/** profiles.role 컬럼에 저장되는 실제 역할 값
 *  - WORKER: 외국인 근로자 (현장 작업자)
 *  - TEAM_LEADER: 공종별 팀장 (철근반/거푸집반/콘크리트반/마감반 등) — 본인 팀만 관리
 *  - SAFETY_OFFICER: 현장 안전관리자
 *  - SITE_ADMIN: 현장 공무 담당자 (계약·기성·서류 관리)
 *  - HQ_ADMIN: 본사 관리자
 *  - HQ_OFFICER: 본사 현장 안전관리 담당관
 *  - ROOT: 기존 최상위 권한 (레거시)
 *  - SUPER_ADMIN: 최상위 권한 (CTO/대표 직속, /system 진입 가능)
 */
export type ProfileRole =
  | "HQ_ADMIN"
  | "SAFETY_OFFICER"
  | "TEAM_LEADER"
  | "SITE_ADMIN"
  | "WORKER"
  | "ROOT"
  | "HQ_OFFICER"
  | "SUPER_ADMIN";

export type AllowedRole = "admin" | "worker" | "hq" | "system";

/** 공종/팀 분류 — profiles.trade 컬럼에 저장.
 *  TEAM_LEADER 가 본인 팀 식별 + 워커 분류용. */
export type TradeType =
  | "rebar"      // 철근반
  | "formwork"   // 거푸집반
  | "concrete"   // 콘크리트반 / 타설
  | "finishing"  // 마감반 (조적·미장·도장 등)
  | "mep"        // 기계·설비·전기 (Mechanical, Electrical, Plumbing)
  | "earthwork"  // 토공·터파기
  | "structural" // 구체조립
  | "general";   // 일반/공통

/** 역할별 권한 등급 (높을수록 상위 권한) */
export const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  WORKER: 1,
  TEAM_LEADER: 2,
  SAFETY_OFFICER: 2,
  SITE_ADMIN: 2,
  HQ_OFFICER: 2,
  HQ_ADMIN: 3,
  ROOT: 90,
  SUPER_ADMIN: 99,
};

export const SETUP_ROLE_TO_PROFILE_ROLE: Record<SetupRoleKey, ProfileRole> = {
  site_manager: "HQ_ADMIN",
  safety_officer: "SAFETY_OFFICER",
  team_leader: "TEAM_LEADER",
  gongmu: "SITE_ADMIN",
  worker: "WORKER",
  root: "ROOT",
  hq_officer: "HQ_OFFICER",
};

export const PROFILE_ROLE_DEFAULT_ROUTE: Record<ProfileRole, string> = {
  HQ_ADMIN: "/control",
  SAFETY_OFFICER: "/admin",
  TEAM_LEADER: "/admin",
  SITE_ADMIN: "/admin",
  WORKER: "/worker",
  ROOT: "/system",
  HQ_OFFICER: "/system",
  SUPER_ADMIN: "/system",
};

export function getProfileRoleFromSetupRole(role: SetupRoleKey): ProfileRole {
  return SETUP_ROLE_TO_PROFILE_ROLE[role];
}

export function getDefaultRouteForProfileRole(role: ProfileRole): string {
  return PROFILE_ROLE_DEFAULT_ROUTE[role];
}

/** SUPER_ADMIN 여부 확인 */
export function isSuperAdmin(role: ProfileRole): boolean {
  return role === "SUPER_ADMIN";
}

/** /system 진입 가능 여부 — SUPER_ADMIN·ROOT·HQ_OFFICER 허용 */
export function canAccessSystem(role: ProfileRole): boolean {
  return role === "SUPER_ADMIN" || role === "ROOT" || role === "HQ_OFFICER";
}

/** ROLE_HIERARCHY 기반 최소 권한 충족 여부 */
export function hasMinRole(role: ProfileRole, minRole: ProfileRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function hasAllowedRole(role: ProfileRole, allowedRole: AllowedRole): boolean {
  if (role === "ROOT" || role === "SUPER_ADMIN") {
    return true;
  }

  if (allowedRole === "system") {
    return role === "HQ_OFFICER";
  }

  if (allowedRole === "admin") {
    // TEAM_LEADER 도 /admin 진입 허용 — 본인 팀 워커만 보임 (UI 측 site_id + trade 필터)
    return (
      role === "HQ_ADMIN" ||
      role === "SAFETY_OFFICER" ||
      role === "TEAM_LEADER" ||
      role === "SITE_ADMIN" ||
      role === "HQ_OFFICER"
    );
  }

  if (allowedRole === "hq") {
    return role === "HQ_ADMIN";
  }

  return role === "WORKER";
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
  finishing: "마감반",
  mep: "설비반",
  earthwork: "토공반",
  structural: "구체조립반",
  general: "일반",
};

export const TRADE_TYPES: Array<{ code: TradeType; name: string }> = (
  Object.keys(TRADE_LABEL) as TradeType[]
).map((c) => ({ code: c, name: TRADE_LABEL[c] }));

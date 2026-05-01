export type SetupRoleKey =
  | "site_manager"
  | "safety_officer"
  | "worker"
  | "root"
  | "hq_officer";

/** profiles.role 컬럼에 저장되는 실제 역할 값
 *  - WORKER: 외국인 근로자 (현장 작업자)
 *  - SAFETY_OFFICER: 현장 안전관리자
 *  - HQ_ADMIN: 본사 관리자
 *  - HQ_OFFICER: 본사 현장 안전관리 담당관
 *  - ROOT: 기존 최상위 권한 (레거시)
 *  - SUPER_ADMIN: 최상위 권한 (CTO/대표 직속, /system 진입 가능)
 */
export type ProfileRole =
  | "HQ_ADMIN"
  | "SAFETY_OFFICER"
  | "WORKER"
  | "ROOT"
  | "HQ_OFFICER"
  | "SUPER_ADMIN";

export type AllowedRole = "admin" | "worker" | "hq" | "system";

/** 역할별 권한 등급 (높을수록 상위 권한) */
export const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  WORKER: 1,
  SAFETY_OFFICER: 2,
  HQ_OFFICER: 2,
  HQ_ADMIN: 3,
  ROOT: 90,
  SUPER_ADMIN: 99,
};

export const SETUP_ROLE_TO_PROFILE_ROLE: Record<SetupRoleKey, ProfileRole> = {
  site_manager: "HQ_ADMIN",
  safety_officer: "SAFETY_OFFICER",
  worker: "WORKER",
  root: "ROOT",
  hq_officer: "HQ_OFFICER",
};

export const PROFILE_ROLE_DEFAULT_ROUTE: Record<ProfileRole, string> = {
  HQ_ADMIN: "/control",
  SAFETY_OFFICER: "/admin",
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
    return role === "HQ_ADMIN" || role === "SAFETY_OFFICER" || role === "HQ_OFFICER";
  }

  if (allowedRole === "hq") {
    return role === "HQ_ADMIN";
  }

  return role === "WORKER";
}

export const V3_ROLES = [
  "ROOT",
  "HQ_ADMIN",
  "SITE_ADMIN",
  "SAFETY_MANAGER",
  "WORKER",
  "VIEWER",
] as const;

export type V3Role = (typeof V3_ROLES)[number];

export const V3_ROLE_LABELS: Record<V3Role, string> = {
  ROOT: "최상위 운영자",
  HQ_ADMIN: "본사 관리자",
  SITE_ADMIN: "현장 관리자",
  SAFETY_MANAGER: "안전 관리자",
  WORKER: "근로자",
  VIEWER: "조회 전용",
};

const V3_ROLE_SET = new Set<string>(V3_ROLES);

export function isV3Role(value: unknown): value is V3Role {
  return typeof value === "string" && V3_ROLE_SET.has(value);
}

export function isGlobalV3Role(role: V3Role): boolean {
  return role === "ROOT" || role === "HQ_ADMIN";
}

export function canSelfSelectV3Role(role: V3Role): boolean {
  return role === "WORKER";
}

export const LEGACY_ROLE_TO_V3_ROLE: Record<string, V3Role> = {
  ROOT: "ROOT",
  SUPER_ADMIN: "ROOT",
  HQ_ADMIN: "HQ_ADMIN",
  HQ_OFFICER: "HQ_ADMIN",
  SITE_ADMIN: "SITE_ADMIN",
  SAFETY_OFFICER: "SAFETY_MANAGER",
  TEAM_LEADER: "SAFETY_MANAGER",
  WORKER: "WORKER",
};

export function normalizeToV3Role(role: string | null | undefined): V3Role | null {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  if (isV3Role(upper)) return upper;
  return LEGACY_ROLE_TO_V3_ROLE[upper] ?? null;
}

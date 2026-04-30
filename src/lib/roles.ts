export type SetupRoleKey =
  | "site_manager"
  | "safety_officer"
  | "worker"
  | "root"
  | "hq_officer";

export type ProfileRole =
  | "HQ_ADMIN"
  | "SAFETY_OFFICER"
  | "WORKER"
  | "ROOT"
  | "HQ_OFFICER";

export type AllowedRole = "admin" | "worker" | "hq" | "system";

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
};

export function getProfileRoleFromSetupRole(role: SetupRoleKey): ProfileRole {
  return SETUP_ROLE_TO_PROFILE_ROLE[role];
}

export function getDefaultRouteForProfileRole(role: ProfileRole): string {
  return PROFILE_ROLE_DEFAULT_ROUTE[role];
}

export function hasAllowedRole(role: ProfileRole, allowedRole: AllowedRole): boolean {
  if (role === "ROOT") {
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

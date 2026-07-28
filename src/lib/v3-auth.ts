import type { V3Role } from "./v3-role-contract";

export type V3CurrentUser = {
  id: number;
  email: string | null;
  displayName: string;
  roles: V3Role[];
  siteIds: number[];
};

export type V3WorkerQuickLoginSite = {
  site_id: string;
  name: string;
  site_code: string | null;
};

export type V3WorkerQuickLoginResult =
  | { ok: true; user: V3CurrentUser }
  | { ok: false; status: 409; sites: V3WorkerQuickLoginSite[] }
  | { ok: false; status: number; error: string };

export type V3AdminSignupResult = {
  id: number;
  email: string | null;
  displayName: string;
  preferredLanguage: string;
  accountStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | string;
  approvalRequired: boolean;
};

export type V3ProfileSetupInput = {
  setupRole: string;
  displayName: string;
  preferredLang: string;
  phoneNumber?: string;
  trade?: string;
  title?: string;
  siteCode?: string;
  siteId?: string;
};

export async function getV3CurrentUser(): Promise<V3CurrentUser | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`v3_auth_me_failed_${response.status}`);
  const body = (await response.json()) as { v3?: V3CurrentUser } & Partial<V3CurrentUser>;
  if (body.v3) return body.v3;
  return body as V3CurrentUser;
}

export async function loginV3(email: string, password: string): Promise<V3CurrentUser> {
  const response = await fetch("/api/auth/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `v3_login_failed_${response.status}`);
  }
  return response.json() as Promise<V3CurrentUser>;
}

export async function adminSignupV3(input: {
  email: string;
  password: string;
  preferredLang: string;
  displayName?: string;
}): Promise<V3AdminSignupResult> {
  const response = await fetch("/api/auth/admin-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      preferred_lang: input.preferredLang,
      ...(input.displayName ? { display_name: input.displayName } : {}),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `v3_admin_signup_failed_${response.status}`,
    );
  }
  return response.json() as Promise<V3AdminSignupResult>;
}

export async function logoutV3(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`v3_logout_failed_${response.status}`);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("safe-link-session-active");
    window.sessionStorage.removeItem("safe-link-worker-active");
  }
}

export async function setupProfileV3(input: V3ProfileSetupInput): Promise<V3CurrentUser> {
  const response = await fetch("/api/auth/setup-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      setupRole: input.setupRole,
      display_name: input.displayName,
      preferred_lang: input.preferredLang,
      ...(input.phoneNumber ? { phone_number: input.phoneNumber } : {}),
      ...(input.trade ? { trade: input.trade } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.siteCode ? { site_code: input.siteCode } : {}),
      ...(input.siteId ? { site_id: input.siteId } : {}),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `v3_profile_setup_failed_${response.status}`,
    );
  }
  return response.json() as Promise<V3CurrentUser>;
}

export async function quickLoginWorkerV3(input: {
  nameInitials: string;
  phoneLast4: string;
  preferredLang: string;
  siteId?: string;
}): Promise<V3WorkerQuickLoginResult> {
  const response = await fetch("/api/auth/worker-quick-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name_initials: input.nameInitials,
      phone_last4: input.phoneLast4,
      preferred_lang: input.preferredLang,
      ...(input.siteId ? { site_id: input.siteId } : {}),
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (response.status === 409) {
    return {
      ok: false,
      status: 409,
      sites: Array.isArray(body.sites) ? body.sites : [],
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof body.error === "string" ? body.error : `v3_worker_quick_login_failed_${response.status}`,
    };
  }
  return { ok: true, user: body as V3CurrentUser };
}

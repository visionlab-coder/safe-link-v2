import { getRuntimeConfig } from "../../config/runtime";
import { saveSession, getAccessToken, clearSession } from "./token-store";

// 📱 M-005 — 모바일 인증 클라이언트.
// admin-login(mobile mode)으로 토큰 수령 → secure store 저장 → 이후 요청에 Bearer 주입.
// S-002 백엔드 계약(X-Safe-Link-Client: mobile + Capacitor origin CORS)과 짝.

const MOBILE_CLIENT_HEADER = "X-Safe-Link-Client";
const MOBILE_CLIENT_VALUE = "mobile";

function apiBase(): string {
    const base = getRuntimeConfig().apiBaseUrl;
    if (!base) throw new Error("VITE_SAFE_LINK_API_BASE_URL 미설정 — 모바일 API 베이스 필요");
    return base;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function adminLogin(email: string, password: string): Promise<LoginResult> {
    let res: Response;
    try {
        res = await fetch(`${apiBase()}/api/auth/admin-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE },
            credentials: "omit", // 모바일은 cookie 대신 token
            body: JSON.stringify({ email, password }),
        });
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network_error" };
    }
    const data = (await res.json().catch(() => ({}))) as { session?: { access_token?: string }; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `login_failed_${res.status}` };
    if (!data.session?.access_token) return { ok: false, error: "no_session_token" };
    await saveSession(data.session as Parameters<typeof saveSession>[0]);
    return { ok: true };
}

/** 인증 요청 — 저장된 토큰을 Bearer로 주입 + mobile 클라이언트 헤더 부착. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    headers.set(MOBILE_CLIENT_HEADER, MOBILE_CLIENT_VALUE);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${apiBase()}${path}`, { ...init, headers, credentials: "omit" });
}

export type MeResult = {
    user: { id: string; email: string | null };
    profile: { role?: string; display_name?: string | null; site_code?: string | null } | null;
} | null;

export async function getMe(): Promise<MeResult> {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) return null;
    return (await res.json()) as MeResult;
}

export async function isAuthenticated(): Promise<boolean> {
    return (await getAccessToken()) !== null;
}

export async function logout(): Promise<void> {
    await clearSession();
}

// 📱 M-006 — 근로자 로그인 (이니셜 + 휴대폰 뒷4자리) → 모바일 토큰 저장
export async function workerLogin(initials: string, phoneLast4: string): Promise<LoginResult> {
    let res: Response;
    try {
        res = await fetch(`${apiBase()}/api/auth/worker-quick-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE },
            credentials: "omit",
            body: JSON.stringify({ name_initials: initials, phone_last4: phoneLast4 }),
        });
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "network_error" };
    }
    const data = (await res.json().catch(() => ({}))) as { session?: { access_token?: string }; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `login_failed_${res.status}` };
    if (!data.session?.access_token) return { ok: false, error: "no_session_token" };
    await saveSession(data.session as Parameters<typeof saveSession>[0]);
    return { ok: true };
}

export type Tbm = { id: string; content_ko: string; site_id: string | null; created_at: string };

// 📱 M-006 — 근로자 TBM 조회 (Bearer 주입, RLS site 스코프)
export async function getTodayTbms(): Promise<Tbm[]> {
    const res = await authFetch("/api/tbm/today");
    if (!res.ok) return [];
    const data = (await res.json()) as { tbms?: Tbm[] };
    return data.tbms ?? [];
}

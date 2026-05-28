import "server-only";
import { cookies } from "next/headers";

// 🔒 P5 박제 헬퍼.
// @supabase/ssr 의 createServerClient.auth.getUser() 가 Workers 환경에서
// apikey 헤더 손상으로 간헐 실패하는 문제 우회.
//
// 모든 API 라우트의 인증 확인은 이 함수로 통일 — 쿠키 직접 파싱 + JWT 디코드.
// 서버측 호출에 사용자 JWT 가 필요한 경우 accessToken 도 함께 반환.

const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

export const COOKIE_USER_SUPABASE_URL = SUPABASE_URL;
export const COOKIE_USER_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";

export type CookieUser = {
    id: string;
    email: string | null;
    accessToken: string;
};

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

export async function getCookieUser(): Promise<CookieUser | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    try {
        const inner = raw.startsWith("base64-")
            ? Buffer.from(raw.slice(7), "base64").toString("utf-8")
            : raw;
        const session = JSON.parse(inner) as { access_token?: string };
        if (!session.access_token) return null;
        const payload = decodeJwtPayload(session.access_token);
        if (!payload?.sub) return null;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return {
            id: payload.sub,
            email: payload.email ?? null,
            accessToken: session.access_token,
        };
    } catch {
        return null;
    }
}

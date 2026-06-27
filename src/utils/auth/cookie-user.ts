import "server-only";
import { cookies } from "next/headers";
import { parseSessionCookie } from "@/utils/auth/access-token-core";
import { verifyAccessToken } from "@/utils/auth/verify-access-token";

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

export async function getCookieUser(): Promise<CookieUser | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    const session = parseSessionCookie(raw);
    if (!session?.access_token) return null;

    const verified = await verifyAccessToken(session.access_token);
    if (!verified) return null;

    return {
        id: verified.sub,
        email: verified.email,
        accessToken: session.access_token,
    };
}

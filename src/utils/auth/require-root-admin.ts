import "server-only";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/utils/auth/verify-access-token";

/**
 * 🔐 SAFE-LINK 루트 관리자(최상위) 전용 게이트 — JWT 서명검증 기반.
 *
 * 1) 쿠키에서 access_token 추출
 * 2) verifyAccessToken: Supabase JWKS(ES256) 로 **서명 실제 검증** → 위조 토큰 거부
 * 3) 검증된 email 이 MASTER_EMAILS 에 포함될 때만 통과
 *
 * → getCookieUser(서명 미검증)와 달리, 위조 토큰으로 MASTER 사칭 불가 = 진짜 "나만".
 */

const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

export async function requireRootAdmin(): Promise<{ id: string; email: string } | null> {
    const raw = (await cookies()).get(COOKIE_NAME)?.value;
    if (!raw) return null;

    let token: string | undefined;
    try {
        const inner = raw.startsWith("base64-")
            ? Buffer.from(raw.slice(7), "base64").toString("utf-8")
            : raw;
        token = (JSON.parse(inner) as { access_token?: string }).access_token;
    } catch {
        return null;
    }
    if (!token) return null;

    const claims = await verifyAccessToken(token);  // ✅ 서명 검증
    if (!claims?.email) return null;

    const masters = (process.env.MASTER_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (masters.length === 0) return null; // 미설정 시 안전하게 거부

    return masters.includes(claims.email.toLowerCase())
        ? { id: claims.sub, email: claims.email }
        : null;
}

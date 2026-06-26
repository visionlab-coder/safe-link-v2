import "server-only";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/utils/auth/verify-access-token";

/**
 * 🔐 SAFE-LINK 개발자(루트, "나만") 전용 게이트 — 마스터 관리자와 별개 등급.
 *
 * requireRootAdmin(MASTER_EMAILS)보다 상위/별개의 단독 등급:
 *   1) 쿠키 access_token 추출
 *   2) verifyAccessToken: Supabase 가 인정한 token 만 신뢰(위조 거부, fail-closed)
 *   3) 검증된 email 이 DEVELOPER_EMAILS 에 포함될 때만 통과
 *
 * → API 키 변경 같은 최상위 작업은 마스터 관리자도 못 하고 개발자(나)만 가능.
 *   DEVELOPER_EMAILS 미설정 시 안전하게 전원 거부.
 */

const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

export async function requireDeveloper(): Promise<{ id: string; email: string } | null> {
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

    const claims = await verifyAccessToken(token); // ✅ 서명/세션 검증
    if (!claims?.email) return null;

    const devs = (process.env.DEVELOPER_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (devs.length === 0) return null; // 미설정 시 fail-closed (전원 거부)

    return devs.includes(claims.email.toLowerCase())
        ? { id: claims.sub, email: claims.email }
        : null;
}

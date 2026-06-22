import "server-only";
import { getCookieUser } from "@/utils/auth/cookie-user";

/**
 * 🔐 루트 관리자(SAFE-LINK 최상위) 전용 게이트.
 * MASTER_EMAILS(env, 쉼표구분)에 포함된 이메일만 통과 — API 키/엔진 설정 등 최상위 권한.
 *
 * ⚠️ 한계: getCookieUser는 JWT 서명을 검증하지 않으므로(기존 취약점), 위조 토큰으로
 *    email 사칭이 이론상 가능. 일반/근로자 계정은 확실히 차단되나, 완전한 "나만" 보장은
 *    JWT 서명검증 수정([[safelink-jwt-signature-bypass]]) 선결 시 완성됨. 현재는 방어심층(defense-in-depth).
 */
export async function requireRootAdmin(): Promise<{ id: string; email: string } | null> {
    const user = await getCookieUser();
    if (!user?.email) return null;
    const masters = (process.env.MASTER_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (masters.length === 0) return null; // 미설정 시 안전하게 거부
    return masters.includes(user.email.toLowerCase())
        ? { id: user.id, email: user.email }
        : null;
}

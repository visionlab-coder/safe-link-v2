import "server-only";
import { decodeProtectedHeader } from "jose";
import {
    verifyAccessTokenWithAuthServer,
    type VerifiedAccessToken,
} from "@/utils/auth/access-token-core";

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";

export type VerifiedClaims = VerifiedAccessToken;

/**
 * Supabase access token을 fail-closed로 검증한다.
 * HS256 프로젝트는 JWKS가 비어 있을 수 있으므로 Supabase Auth `/user`
 * endpoint가 사용자로 인정한 token만 신뢰한다.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedClaims | null> {
    try {
        const header = decodeProtectedHeader(token);
        if (!["HS256", "ES256", "RS256"].includes(String(header.alg))) return null;
    } catch {
        return null;
    }

    return verifyAccessTokenWithAuthServer(token, {
        supabaseUrl: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
    });
}

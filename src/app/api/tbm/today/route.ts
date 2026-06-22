import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessToken } from "@/utils/auth/access-token-core";
import { verifyAccessToken } from "@/utils/auth/verify-access-token";
import { withMobileCors, handleMobilePreflight } from "@/utils/auth/mobile-cors";

export const runtime = "nodejs";

// 📱 M-006 — 근로자(모바일) TBM 조회.
// Bearer(또는 cookie) 인증 → 사용자 토큰으로 Supabase REST 조회 → RLS가 worker site로 스코프.
// 웹 호환: cookie도 허용. CORS는 허용 mobile origin에만 부착(웹 무영향).

const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";

export async function OPTIONS(req: NextRequest) {
    return handleMobilePreflight(req) ?? new NextResponse(null, { status: 405 });
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get("origin");
    const json = (body: unknown, status = 200) =>
        withMobileCors(NextResponse.json(body, { status }), origin);

    const resolved = resolveRequestAccessToken({
        authorization: req.headers.get("authorization"),
        rawCookie: req.cookies.get(COOKIE_NAME)?.value,
    });
    if (!resolved) return json({ error: "no_access_token" }, 401);

    const verified = await verifyAccessToken(resolved.accessToken);
    if (!verified) return json({ error: "invalid_access_token" }, 401);

    // 사용자 JWT 로 조회 → RLS(tbm_notices_select_policy)가 worker.site_id 와 일치하는 TBM만 반환.
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tbm_notices?select=id,content_ko,site_id,created_at&order=created_at.desc&limit=5&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
        { headers: { Authorization: `Bearer ${resolved.accessToken}` } }
    );
    if (!res.ok) return json({ error: "tbm_fetch_failed", status: res.status }, 500);

    const tbms = (await res.json()) as Array<{
        id: string;
        content_ko: string;
        site_id: string | null;
        created_at: string;
    }>;
    return json({ tbms });
}

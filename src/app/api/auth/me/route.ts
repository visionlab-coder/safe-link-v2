import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// /api/auth/me — 인증된 사용자 정보 + 프로필 조회.
//
// RoleGuard / 클라이언트 페이지가 createBrowserClient 의존 없이
// 인증 상태와 역할을 가져올 수 있도록 하는 단일 진실원(SSOT).
//
// Workers 런타임의 @supabase/ssr · @supabase/supabase-js 불안정성을
// 우회하기 위해 raw 쿠키 파싱 + raw fetch (+ apikey URL param) 사용.
//
// 🚨 세션 풀림 박제 (2026-06-08): access_token 1h 만료 시 refresh_token 으로
// 자동 갱신 + 응답에 새 cookie 세팅. 이전 버전은 만료 시 401 만 반환 →
// 로그인 1시간 후 자동 풀림 현상의 직접 원인이었음.
//
// anon key 는 클라이언트 번들에 이미 노출된 공개 값이라 하드코딩 안전.

const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";
const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

type StoredSession = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: Record<string, unknown>;
};

function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payloadB64 + "=".repeat((4 - payloadB64.length % 4) % 4);
        const json = Buffer.from(padded, "base64").toString("utf-8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

async function refreshSession(refreshToken: string): Promise<StoredSession | null> {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            }
        );
        if (!res.ok) return null;
        const next = (await res.json()) as StoredSession;
        return next.access_token ? next : null;
    } catch {
        return null;
    }
}

function sessionCookieValue(session: StoredSession): string {
    return `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
}

export async function GET(req: NextRequest) {
    const rawCookie = req.cookies.get(COOKIE_NAME)?.value;
    if (!rawCookie) {
        return NextResponse.json({ error: "no_cookie" }, { status: 401 });
    }

    let session: StoredSession | null = null;
    try {
        const inner = rawCookie.startsWith("base64-")
            ? Buffer.from(rawCookie.slice(7), "base64").toString("utf-8")
            : rawCookie;
        session = JSON.parse(inner);
    } catch {
        return NextResponse.json({ error: "invalid_cookie" }, { status: 401 });
    }

    let accessToken = session?.access_token;
    if (!accessToken) {
        return NextResponse.json({ error: "no_access_token" }, { status: 401 });
    }

    let payload = decodeJwtPayload(accessToken);
    if (!payload?.sub) {
        return NextResponse.json({ error: "invalid_jwt" }, { status: 401 });
    }

    let refreshedCookie: string | null = null;
    let refreshedMaxAge = 3600;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        const refreshToken = session?.refresh_token;
        if (!refreshToken) {
            return NextResponse.json({ error: "expired" }, { status: 401 });
        }
        const next = await refreshSession(refreshToken);
        if (!next?.access_token) {
            return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
        }
        accessToken = next.access_token;
        payload = decodeJwtPayload(accessToken);
        if (!payload?.sub) {
            return NextResponse.json({ error: "invalid_refreshed_jwt" }, { status: 401 });
        }
        refreshedCookie = sessionCookieValue(next);
        refreshedMaxAge = next.expires_in ?? 3600;
    }

    const userId = payload.sub;
    const email = payload.email ?? null;

    // 프로필 조회 — apikey URL param, Bearer = 사용자 JWT (RLS 적용)
    const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=role,preferred_lang,display_name,title,site_code,site_id&id=eq.${userId}&limit=1&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    );

    if (!profileRes.ok) {
        return NextResponse.json(
            { error: "profile_fetch_failed", status: profileRes.status },
            { status: 500 }
        );
    }

    const rows = (await profileRes.json()) as Array<{
        role?: string;
        preferred_lang?: string;
        display_name?: string;
        title?: string;
        site_code?: string;
        site_id?: string;
    }>;
    const profile = rows[0] ?? null;

    const response = NextResponse.json({
        user: { id: userId, email },
        profile: profile
            ? {
                  role: (profile.role ?? "").toUpperCase(),
                  preferred_lang: profile.preferred_lang ?? null,
                  display_name: profile.display_name ?? null,
                  title: profile.title ?? null,
                  site_code: profile.site_code ?? null,
                  site_id: profile.site_id ?? null,
              }
            : null,
        ...(refreshedCookie ? { refreshed: true } : {}),
    });

    if (refreshedCookie) {
        response.cookies.set(COOKIE_NAME, refreshedCookie, {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            maxAge: refreshedMaxAge,
            secure: process.env.NODE_ENV === "production",
        });
    }

    return response;
}

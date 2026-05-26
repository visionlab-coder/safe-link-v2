import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// @supabase/supabase-js와 @supabase/ssr 모두 Cloudflare Workers 런타임에서
// apikey 헤더 손상 문제가 있어 완전 제거.
// Supabase REST Auth API에 raw fetch로 직접 호출 — Workers에서 완전 검증됨.

export async function POST(req: NextRequest) {
    let body: { email?: string; password?: string };
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!email || !password) {
        return NextResponse.json({ error: "email_password_required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });

    // Supabase Auth REST API 직접 호출
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
        const errBody = await authRes.json().catch(() => ({})) as { error_description?: string; msg?: string };
        const errMsg = errBody.error_description ?? errBody.msg ?? "authentication_failed";
        const status = authRes.status === 429 ? 429 : 401;
        return NextResponse.json({ error: errMsg }, { status });
    }

    const session = await authRes.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        expires_at?: number;
        token_type: string;
        user: Record<string, unknown>;
    };

    // @supabase/ssr 미들웨어가 읽는 쿠키 형식으로 직접 구성
    // 형식: sb-{project-ref}-auth-token = base64-{btoa(JSON.stringify(session))}
    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
    const maxAge = session.expires_in ?? 3600;

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge,
        secure: process.env.NODE_ENV === "production",
    });
    return response;
}

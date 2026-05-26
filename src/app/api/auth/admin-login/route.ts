import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const runtime = "nodejs";

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

    // @supabase/ssr의 createServerClient는 Cloudflare Workers 런타임에서
    // apikey 헤더가 손상되어 "Invalid API key" 오류 발생.
    // @supabase/supabase-js의 createClient는 정상 작동 (worker-login 경로에서 검증됨).
    const authClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
        const status = error.message.includes("abort") ? 504 : 401;
        return NextResponse.json({ error: error.message }, { status });
    }

    const session = authData.session;
    if (!session) {
        return NextResponse.json({ error: "NO_SESSION" }, { status: 500 });
    }

    // setSession = 로컬 쿠키 기록만 수행 (네트워크 왕복 없음 — 토큰이 방금 발급됨)
    // @supabase/ssr이 미들웨어에서 읽을 수 있는 형식으로 쿠키를 설정한다.
    const cookieStore = await cookies();
    const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];

    const ssrClient = createServerClient(url, key, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                    pendingCookies.push({ name, value, options: options ?? {} });
                    try { cookieStore.set(name, value, options); } catch { /* read-only context */ }
                });
            },
        },
    });

    await ssrClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    });

    const response = NextResponse.json({ ok: true });
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
    });
    return response;
}

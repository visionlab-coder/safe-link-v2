import { NextRequest, NextResponse } from "next/server";
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

    const cookieStore = await cookies();

    // signInWithPassword가 설정하는 쿠키를 Response에 직접 복사하기 위해 캡처
    const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];

    const supabase = createServerClient(url, key, {
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        const status = error.message.includes("abort") ? 504 : 401;
        return NextResponse.json({ error: error.message }, { status });
    }

    // NextResponse.json()은 독립 Response 객체 — pendingCookies를 명시적으로 복사해야
    // Set-Cookie 헤더가 브라우저에 전달됨 (이것이 없으면 미들웨어가 세션을 못 읽어 /auth로 튕김)
    const response = NextResponse.json({ ok: true });
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
    });
    return response;
}

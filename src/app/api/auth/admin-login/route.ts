import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

    // signInWithPassword: 15초 타임아웃으로 Cloudflare Workers 무한 행 방지
    const supabase = createServerClient(url, key, {
        global: {
            fetch: (input, init) => {
                const ctrl = new AbortController();
                const id = setTimeout(() => ctrl.abort(), 15000);
                return fetch(input as RequestInfo, { ...(init ?? {}), signal: ctrl.signal })
                    .finally(() => clearTimeout(id));
            },
        },
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch { /* read-only context */ }
            },
        },
    });

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        const status = error.message.includes("abort") ? 504 : 401;
        return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ ok: true });
}

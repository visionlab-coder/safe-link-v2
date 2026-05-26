import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Cloudflare Workers 런타임은 `apikey` 같은 임의 헤더를 변형/제거할 수 있음.
// 이 때문에 @supabase/ssr · @supabase/supabase-js · raw fetch with apikey 헤더가
// 모두 간헐적으로 401 / "No API key found in request" 를 받음.
//
// → apikey 를 **URL 쿼리 파라미터**로 전달하면 헤더 가공을 완전 우회.
// Supabase 공식 게이트웨이가 query param 도 정상 인식하며 보안적으로 동일.
// (anon key 는 클라이언트 번들에도 이미 노출되어 있는 공개 값)

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
    if (!url || !key) {
        return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
    }

    // apikey 를 URL 파라미터로 전달 (Workers 헤더 손상 우회)
    const authUrl = `${url}/auth/v1/token?grant_type=password&apikey=${encodeURIComponent(key)}`;

    let authRes: Response;
    try {
        authRes = await fetch(authUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify({ email, password }),
        });
    } catch (e) {
        return NextResponse.json({
            error: "UPSTREAM_FETCH_FAILED",
            detail: e instanceof Error ? e.message : String(e),
        }, { status: 502 });
    }

    // 응답 본문은 항상 text 로 먼저 읽음 — JSON 파싱 실패해도 원본 보존
    const rawText = await authRes.text();

    if (!authRes.ok) {
        // Supabase 는 케이스마다 다른 필드명을 사용:
        //   - 잘못된 비밀번호: { msg, error_code }
        //   - 잘못된 apikey: { message, hint }
        //   - rate limit / 기타: { error, error_description }
        // 모두 흡수.
        let parsed: {
            error_description?: string;
            msg?: string;
            message?: string;
            error?: string;
            error_code?: string;
        } = {};
        try { parsed = JSON.parse(rawText); } catch { /* HTML / empty 등 */ }

        const errMsg =
            parsed.error_description ??
            parsed.msg ??
            parsed.message ??
            parsed.error ??
            parsed.error_code ??
            `auth_upstream_${authRes.status}`;

        // Supabase 가 보낸 실제 status 를 그대로 전달 (400=잘못된 입력, 401=인증실패, 429=rate limit)
        const status = authRes.status >= 400 && authRes.status < 600 ? authRes.status : 401;
        return NextResponse.json({ error: errMsg }, { status });
    }

    let session: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        expires_at?: number;
        token_type: string;
        user: Record<string, unknown>;
    };
    try {
        session = JSON.parse(rawText);
    } catch {
        return NextResponse.json({ error: "UPSTREAM_INVALID_JSON" }, { status: 502 });
    }

    // @supabase/ssr 표준 쿠키 형식: sb-{project-ref}-auth-token = base64-{btoa(JSON.stringify(session))}
    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
    const maxAge = session.expires_in ?? 3600;

    // 🚨 httpOnly: false 필수 — @supabase/ssr 의 createBrowserClient 는
    // document.cookie 로 세션을 읽어 RoleGuard / getUser() 등을 수행함.
    // httpOnly:true 면 브라우저 JS 가 쿠키를 못 봐서 클라이언트 측이 "세션 없음" 으로 판단,
    // 로그인 직후 즉시 /auth 로 강제 리다이렉트되는 무한 튕김 발생.
    // 이 형식 / 속성은 @supabase/ssr 표준과 동일하며 절대 변경 금지.
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, cookieValue, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge,
        secure: process.env.NODE_ENV === "production",
    });
    return response;
}

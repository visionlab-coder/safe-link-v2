import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// /api/tbm/sign — 워커 TBM 서명 제출.
//
// 워커 페이지의 createBrowserClient 의존을 제거하고 서버측에서 raw 쿠키 파싱 +
// service role 로 안전하게 tbm_ack insert 처리.
//
// Workers 환경에서 클라이언트 측 supabase 호출이 간헐적으로 실패하던 문제 해결.

const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0";
const PROJECT_REF = "wzmzpuxpcpuvuacwmslj";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    } catch { return null; }
}

function parseAccessTokenFromCookie(req: NextRequest): { accessToken: string; userId: string } | null {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    try {
        const inner = raw.startsWith("base64-")
            ? Buffer.from(raw.slice(7), "base64").toString("utf-8")
            : raw;
        const session = JSON.parse(inner) as { access_token?: string };
        if (!session.access_token) return null;
        const payload = decodeJwtPayload(session.access_token);
        if (!payload?.sub) return null;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return { accessToken: session.access_token, userId: payload.sub };
    } catch { return null; }
}

export async function POST(req: NextRequest) {
    const auth = parseAccessTokenFromCookie(req);
    if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    let body: { tbm_id?: string; signature_data?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

    const tbmId = String(body.tbm_id ?? "").trim();
    const signatureData = String(body.signature_data ?? "").trim();
    if (!tbmId) return NextResponse.json({ error: "tbm_id_required" }, { status: 400 });
    if (!signatureData) return NextResponse.json({ error: "signature_required" }, { status: 400 });

    // 중복 서명 체크 — 사용자 JWT 로 본인 데이터만 조회 (RLS 통과)
    const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/tbm_ack?select=id&tbm_id=eq.${encodeURIComponent(tbmId)}&worker_id=eq.${encodeURIComponent(auth.userId)}&limit=1&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
    );

    if (existingRes.ok) {
        const rows = (await existingRes.json()) as Array<{ id: string }>;
        if (rows.length > 0) {
            return NextResponse.json({ ok: true, already_signed: true });
        }
    }

    // 신규 서명 insert — 사용자 JWT (RLS 정책상 본인만 가능)
    const insertRes = await fetch(
        `${SUPABASE_URL}/rest/v1/tbm_ack?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${auth.accessToken}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
            },
            body: JSON.stringify({
                tbm_id: tbmId,
                worker_id: auth.userId,
                signature_data: signatureData,
                ack_at: new Date().toISOString(),
            }),
        }
    );

    if (!insertRes.ok) {
        const text = await insertRes.text();
        // unique 충돌은 이미 서명된 것 → 성공으로 처리
        if (insertRes.status === 409 || text.includes("duplicate") || text.includes("unique")) {
            return NextResponse.json({ ok: true, already_signed: true });
        }
        return NextResponse.json({
            error: "sign_insert_failed",
            status: insertRes.status,
            detail: text.slice(0, 200),
        }, { status: 500 });
    }

    return NextResponse.json({ ok: true, signed_at: new Date().toISOString() });
}

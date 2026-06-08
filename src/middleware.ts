import { NextResponse, type NextRequest } from 'next/server'
import { canAccessSystem, hasAllowedRole, type ProfileRole } from '@/lib/roles'

// AI API 엔드포인트 — 미인증 외부 호출 차단 대상
// /api/translate 제외: Travel Talk 비인증 사용자도 호출함 (travel_token 전용 흐름)
const AI_API_PREFIXES = [
    '/api/stt',
    '/api/tts',
    '/api/romanize',
    '/api/vision',
    '/api/quiz',
    '/api/tbm/ai-tips',
]

// Workers 가 process.env 를 손상시키는 케이스가 있어 NEXT_PUBLIC 값은 하드코딩.
// 이 키는 클라이언트 번들에도 그대로 노출된 공개 anon key 라 보안 영향 없음.
const SUPABASE_URL = "https://wzmzpuxpcpuvuacwmslj.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0"

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

// @supabase/ssr / @supabase/supabase-js 는 Cloudflare Workers 런타임에서
// apikey 헤더를 손상시켜 intermittent 401이 발생함.
// 미들웨어는 raw cookie 파싱 + raw fetch만 사용 — Vercel / Workers 모두 완전 검증.
//
// 🚨 세션 풀림 박제 (2026-06-08): access_token 만료 감지 시 refresh_token 으로
// GoTrue /auth/v1/token 호출 → 새 세션 받아 응답 cookie 갱신.
// 이전 버전은 만료 즉시 /auth 로 redirect → 사용자 1시간마다 로그인 풀림.

type StoredSession = {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    expires_at?: number
    token_type?: string
    user?: Record<string, unknown>
}

function readSessionCookie(request: NextRequest): StoredSession | null {
    try {
        const raw = request.cookies.get(COOKIE_NAME)?.value
        if (!raw) return null
        const jsonStr = raw.startsWith('base64-')
            ? Buffer.from(raw.slice(7), 'base64').toString('utf-8')
            : raw
        return JSON.parse(jsonStr) as StoredSession
    } catch {
        return null
    }
}

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
    try {
        const payloadStr = Buffer.from(
            token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
        ).toString('utf-8')
        return JSON.parse(payloadStr)
    } catch {
        return null
    }
}

async function refreshSession(refreshToken: string): Promise<StoredSession | null> {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            }
        )
        if (!res.ok) return null
        const next = await res.json() as StoredSession
        return next.access_token ? next : null
    } catch {
        return null
    }
}

function sessionCookieValue(session: StoredSession): string {
    return `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`
}

type AuthResult = {
    userId: string
    accessToken: string
    refreshed: StoredSession | null
}

async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
    const session = readSessionCookie(request)
    if (!session?.access_token) return null

    let payload = decodeJwtPayload(session.access_token)
    if (!payload?.sub) return null

    // 토큰 유효 → 그대로 사용
    if (!payload.exp || payload.exp >= Date.now() / 1000) {
        return { userId: payload.sub, accessToken: session.access_token, refreshed: null }
    }

    // 만료 → refresh_token 으로 자동 갱신
    if (!session.refresh_token) return null
    const next = await refreshSession(session.refresh_token)
    if (!next?.access_token) return null

    payload = decodeJwtPayload(next.access_token)
    if (!payload?.sub) return null

    return { userId: payload.sub, accessToken: next.access_token, refreshed: next }
}

async function getProfileRole(userId: string, accessToken: string): Promise<string | null> {
    try {
        // 🚨 apikey 는 URL 쿼리로 전달 — Workers 가 임의 헤더(apikey)를 변형/제거하는 이슈 우회.
        // Authorization 헤더만 사용해 사용자 JWT 검증 → RLS 정상 적용.
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${userId}&limit=1&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        )
        if (!res.ok) return null
        const rows = await res.json() as Array<{ role?: string }>
        return rows[0]?.role?.toUpperCase() ?? null
    } catch {
        return null
    }
}

function withRefreshedCookie(response: NextResponse, refreshed: StoredSession | null): NextResponse {
    if (!refreshed) return response
    response.cookies.set(COOKIE_NAME, sessionCookieValue(refreshed), {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshed.expires_in ?? 3600,
        secure: process.env.NODE_ENV === 'production',
    })
    return response
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // AI API: 세션 여부만 확인 (역할 불필요)
    if (AI_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        const auth = await resolveAuth(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return withRefreshedCookie(NextResponse.next({ request }), auth.refreshed)
    }

    // /admin, /worker, /system: 역할 기반 접근 제어
    const needsRoleCheck =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/worker') ||
        pathname.startsWith('/system')

    if (needsRoleCheck) {
        const auth = await resolveAuth(request)
        if (!auth) {
            return NextResponse.redirect(new URL('/auth', request.url))
        }

        const role = (await getProfileRole(auth.userId, auth.accessToken)) as ProfileRole | null

        if (pathname.startsWith('/system')) {
            if (!role || !canAccessSystem(role)) {
                return NextResponse.redirect(new URL('/', request.url))
            }
        } else if (pathname.startsWith('/admin')) {
            if (!role || !hasAllowedRole(role, 'admin')) {
                return NextResponse.redirect(new URL('/auth', request.url))
            }
        } else if (pathname.startsWith('/worker')) {
            if (!role || !hasAllowedRole(role, 'worker')) {
                return NextResponse.redirect(new URL('/auth', request.url))
            }
        }

        return withRefreshedCookie(NextResponse.next({ request }), auth.refreshed)
    }

    return NextResponse.next({ request })
}

export const config = {
    matcher: [
        // 정적 파일, _next 제외 — 페이지 네비게이션 처리
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
        // /admin, /worker 서버 가드
        '/admin/:path*',
        '/worker/:path*',
        // AI API 엔드포인트 — 미인증 외부 호출 차단 (/api/translate 제외)
        '/api/stt/:path*',
        '/api/tts/:path*',
        '/api/romanize/:path*',
        '/api/vision/:path*',
        '/api/quiz/:path*',
        '/api/tbm/ai-tips/:path*',
    ],
}

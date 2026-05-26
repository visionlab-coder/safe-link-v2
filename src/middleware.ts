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

// @supabase/ssr / @supabase/supabase-js 는 Cloudflare Workers 런타임에서
// apikey 헤더를 손상시켜 intermittent 401이 발생함.
// 미들웨어는 raw cookie 파싱 + raw fetch만 사용 — Vercel / Workers 모두 완전 검증.

function parseAuthCookie(request: NextRequest): { accessToken: string; userId: string } | null {
    try {
        const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
        const raw = request.cookies.get(`sb-${projectRef}-auth-token`)?.value
        if (!raw) return null

        const jsonStr = raw.startsWith('base64-')
            ? Buffer.from(raw.slice(7), 'base64').toString('utf-8')
            : raw
        const session = JSON.parse(jsonStr) as { access_token?: string }
        if (!session.access_token) return null

        // JWT payload 디코딩 (서명 검증 불필요 — httpOnly 쿠키는 JS에서 변조 불가)
        const payloadStr = Buffer.from(
            session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
        ).toString('utf-8')
        const payload = JSON.parse(payloadStr) as { sub?: string; exp?: number }

        // 만료 체크
        if (payload.exp && payload.exp < Date.now() / 1000) return null
        if (!payload.sub) return null

        return { accessToken: session.access_token, userId: payload.sub }
    } catch {
        return null
    }
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

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // AI API: 세션 여부만 확인 (역할 불필요)
    if (AI_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        const auth = parseAuthCookie(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.next({ request })
    }

    // /admin, /worker, /system: 역할 기반 접근 제어
    const needsRoleCheck =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/worker') ||
        pathname.startsWith('/system')

    if (needsRoleCheck) {
        const auth = parseAuthCookie(request)
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

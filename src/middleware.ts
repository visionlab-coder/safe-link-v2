import { createServerClient } from '@supabase/ssr'
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

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })
    const { pathname } = request.nextUrl

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // getSession(): 쿠키 기반 JWT 파싱만 수행 (네트워크 왕복 없음)
    // 토큰 갱신은 Supabase SSR이 setAll 콜백에서 자동 처리
    const { data: { session } } = await supabase.auth.getSession()

    // AI API 엔드포인트: 미인증 외부 호출 차단
    // getSession()은 이미 위에서 호출됨 — 추가 네트워크 비용 없음
    if (AI_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return supabaseResponse
    }

    // /admin, /worker, /system 경로: 역할 기반 접근 제어
    const needsRoleCheck =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/worker') ||
        pathname.startsWith('/system')

    if (needsRoleCheck) {
        if (!session) {
            return NextResponse.redirect(new URL('/auth', request.url))
        }

        // getUser(): 서버에서 JWT 검증 (세션 위변조 방지)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.redirect(new URL('/auth', request.url))
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const role = (profile?.role as string | undefined)?.toUpperCase() as ProfileRole | undefined

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

    return supabaseResponse
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

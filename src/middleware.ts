import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessSystem, type ProfileRole } from '@/lib/roles'

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

    // /system 경로: SUPER_ADMIN·ROOT·HQ_OFFICER 전용 보호
    if (pathname.startsWith('/system')) {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.redirect(new URL('/auth', request.url))
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !canAccessSystem(profile.role as ProfileRole)) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        // 정적 파일, _next 제외 — 페이지 네비게이션 처리
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
        // AI API 엔드포인트 — 미인증 외부 호출 차단 (/api/translate 제외)
        '/api/stt/:path*',
        '/api/tts/:path*',
        '/api/romanize/:path*',
        '/api/vision/:path*',
        '/api/quiz/:path*',
        '/api/tbm/ai-tips/:path*',
    ],
}

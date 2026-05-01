import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessSystem, type ProfileRole } from '@/lib/roles'

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
    // getUser()는 매번 Auth 서버 왕복 → 모든 요청에 +50-200ms 지연 유발
    // 토큰 갱신은 Supabase SSR이 setAll 콜백에서 자동 처리
    await supabase.auth.getSession()

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
        // 정적 파일, _next, API routes 제외 — 페이지 네비게이션만 처리
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

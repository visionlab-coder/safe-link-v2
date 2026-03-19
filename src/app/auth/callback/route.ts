import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type CookieOptions = {
    domain?: string
    expires?: Date
    httpOnly?: boolean
    maxAge?: number
    path?: string
    sameSite?: true | false | 'lax' | 'strict' | 'none'
    secure?: boolean
    priority?: 'low' | 'medium' | 'high'
    partitioned?: boolean
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/auth/setup'
    // 오픈 리다이렉트 방지: 반드시 /로 시작하고 //로 시작하지 않아야 함
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/auth/setup'

    if (code) {
        const cookieHeader = request.headers.get('cookie') ?? '';
        const responseCookies: { name: string; value: string; options: CookieOptions }[] = [];

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieHeader.split(';').map(c => {
                            const [name, ...rest] = c.trim().split('=');
                            return { name, value: rest.join('=') };
                        }).filter(c => c.name);
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            responseCookies.push({ name, value, options });
                        });
                    },
                },
            }
        )
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const redirectResponse = NextResponse.redirect(`${origin}${next}`);
            responseCookies.forEach(({ name, value, options }) => {
                redirectResponse.cookies.set(name, value, options);
            });
            return redirectResponse;
        }
    }

    return NextResponse.redirect(`${origin}/auth`)
}


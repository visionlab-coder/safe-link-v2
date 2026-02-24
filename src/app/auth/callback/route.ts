import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/auth/setup'

    if (code) {
        const cookieHeader = request.headers.get('cookie') ?? '';
        const responseCookies: { name: string; value: string; options: any }[] = [];

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


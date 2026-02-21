import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    // 클라이언트(브라우저)에서 안심하고 쓸 수 있는 Supabase 친구를 만듭니다!
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

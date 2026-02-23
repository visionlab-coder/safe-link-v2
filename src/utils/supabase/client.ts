import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    // 빌드 타임(환경 변수가 없을 때)에 크래시가 나지 않도록 방어합니다.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

    return createBrowserClient(url, key);
}

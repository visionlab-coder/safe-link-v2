import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 싱글턴: 매번 재생성하지 않고 동일 인스턴스 재사용
// → 27곳에서 호출해도 커넥션 1개, realtime 채널 공유
let _client: SupabaseClient | null = null;

export function createClient() {
    if (_client) return _client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    _client = createBrowserClient(url, key);
    return _client;
}

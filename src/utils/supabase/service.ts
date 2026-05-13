import "server-only";
import { createClient } from '@supabase/supabase-js';

/** 서버사이드 전용 — RLS 우회. API Route에서만 사용할 것 */
export function createServiceClient() {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
    return createClient(url, key);
}

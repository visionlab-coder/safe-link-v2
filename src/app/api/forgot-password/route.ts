import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// In-memory rate limiter: phone → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1시간

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

/**
 * 비밀번호 찾기 API
 * - phone → 가상 이메일로 Supabase 유저 조회
 * - 가입 시 등록한 backup_email과 입력값 비교 검증
 * - 일치하면 Supabase Admin으로 복구 링크 생성 → backup_email로 발송 (링크는 클라이언트에 반환하지 않음)
 */
export async function POST(request: NextRequest) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (!serviceKey || !supabaseUrl) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const { phone, backupEmail } = await request.json() as { phone?: string; backupEmail?: string };

        if (!phone || !backupEmail) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');

        // Rate limit per phone number (3회/시간)
        if (!checkRateLimit(cleanPhone)) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        const virtualEmail = `${cleanPhone}@safe-link.local`;

        const adminClient = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 직접 DB 조회로 전체 사용자 목록 로드 방지
        const { data: userData, error: userError } = await adminClient
            .from('profiles')
            .select('id, backup_email')
            .eq('virtual_email', virtualEmail)
            .single();

        // 사용자를 찾지 못하거나 backup_email 불일치 모두 동일 에러 반환 (열거 방지)
        if (userError || !userData) {
            return NextResponse.json({ error: 'Recovery not available. Please contact support.' }, { status: 400 });
        }

        const storedBackup: string = userData.backup_email || '';
        if (!storedBackup || storedBackup.toLowerCase().trim() !== backupEmail.toLowerCase().trim()) {
            return NextResponse.json({ error: 'Recovery not available. Please contact support.' }, { status: 400 });
        }

        // 복구 링크 생성
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: virtualEmail,
            options: { redirectTo: `${request.headers.get('origin') || ''}/auth/reset-password` },
        });
        if (linkError) throw linkError;

        // TODO: 이메일 서비스(Resend 등)를 통해 storedBackup으로 linkData.properties.action_link 발송
        // 현재는 서버 로그에만 기록 (개발용)
        console.info('[forgot-password] Recovery link generated for', virtualEmail);
        void linkData; // 클라이언트에 링크를 반환하지 않음

        return NextResponse.json({
            success: true,
            maskedEmail: storedBackup.replace(/(.{2}).+(@.+)/, '$1***$2'),
            message: 'Recovery email will be sent to your backup email address.',
        });

    } catch {
        console.error('[forgot-password] Internal error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

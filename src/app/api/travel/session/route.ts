import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { generateTravelToken } from '@/lib/travel-auth';

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 5;

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (entry && now < entry.resetAt) {
        if (entry.count >= RATE_LIMIT_MAX) {
            return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
        }
        entry.count += 1;
    } else {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    try {
        const token = generateTravelToken();
        return NextResponse.json({ token });
    } catch {
        return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { generateTravelToken } from '@/lib/travel-auth';
import { checkTravelSessionLimit } from '@/utils/rate-limit';

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    if (!(await checkTravelSessionLimit(ip))) {
        return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    try {
        const token = generateTravelToken();
        const response = NextResponse.json({ token });
        response.cookies.set("SAFE_LINK_TRAVEL", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/api/travel",
            maxAge: 24 * 60 * 60,
        });
        return response;
    } catch {
        return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }
}

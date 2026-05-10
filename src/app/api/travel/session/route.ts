import { NextResponse } from 'next/server';
export const runtime = "nodejs";
import { generateTravelToken } from '@/lib/travel-auth';

export async function POST() {
    try {
        const token = generateTravelToken();
        return NextResponse.json({ token });
    } catch {
        return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }
}

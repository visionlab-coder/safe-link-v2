import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.TRAVEL_API_SECRET!;
const TTL_MS = 24 * 60 * 60 * 1000; // 24시간

export function generateTravelToken(): string {
    if (!SECRET) throw new Error('TRAVEL_API_SECRET not configured');
    const exp = (Date.now() + TTL_MS).toString();
    const sig = createHmac('sha256', SECRET).update(exp).digest('hex');
    return `${exp}.${sig}`;
}

export function verifyTravelToken(token: string | null | undefined): boolean {
    if (!SECRET || !token) return false;
    const dot = token.lastIndexOf('.');
    if (dot === -1) return false;
    const exp = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (Date.now() > parseInt(exp, 10)) return false;
    const expected = createHmac('sha256', SECRET).update(exp).digest('hex');
    try {
        return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
        return false;
    }
}

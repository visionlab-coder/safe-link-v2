import { NextResponse } from 'next/server';

export async function GET() {
    const key = process.env.GOOGLE_CLOUD_API_KEY || "MISSING";
    const keyLength = key.length;
    const keyStart = key.substring(0, 7);
    const keyEnd = key.substring(key.length - 4);

    return NextResponse.json({
        hasKey: key !== "MISSING",
        keyLength,
        keyStart: key === "MISSING" ? "N/A" : keyStart,
        keyEnd: key === "MISSING" ? "N/A" : keyEnd,
        envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('API')),
        timestamp: new Date().toISOString()
    });
}

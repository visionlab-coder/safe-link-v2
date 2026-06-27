import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { getCookieUser } from "@/utils/auth/cookie-user";

// ⚙️ Flitto 실시간 통역(RTT) 테스트 전용 토큰 발급 라우트.
// 운영 PoC와 격리: FLITTO_RTT_TOKEN 환경변수가 없으면 비활성(500)이며,
// 운영 환경에는 이 변수를 설정하지 않는다. (node:fs/하드코딩 경로 제거 — Workers 호환)
const DEFAULT_RTT_URL = "wss://ai-realtime-dev.flit.to/v1/realtime/speech-session";

export async function GET() {
    const user = await getCookieUser();
    if (!user) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const token = process.env.FLITTO_RTT_TOKEN?.trim();
    const url = process.env.FLITTO_RTT_URL?.trim() || DEFAULT_RTT_URL;

    if (!token) {
        return NextResponse.json(
            { error: "Missing FLITTO_RTT_TOKEN (테스트 전용 — .env.local 에 설정)" },
            { status: 500 },
        );
    }

    return NextResponse.json({
        url,
        token,
        supported_langs: ["ko", "en", "ja", "zh-CN", "zh-TW", "ru", "vi", "fr", "it", "ar", "es"],
    });
}

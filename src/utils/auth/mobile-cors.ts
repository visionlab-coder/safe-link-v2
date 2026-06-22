import "server-only";
import { NextResponse } from "next/server";

/**
 * 📱 모바일(Capacitor WebView) 인증용 CORS·클라이언트 게이트 공통 helper. [S-002]
 *
 * Capacitor origin:
 *  - Android (androidScheme=https) → "https://localhost"
 *  - iOS                            → "capacitor://localhost"
 *  - 일부 환경                       → "ionic://localhost"
 * 추가 origin은 env MOBILE_ALLOWED_ORIGINS(쉼표)로 확장.
 *
 * 규칙(S-002): 토큰 응답은 `X-Safe-Link-Client: mobile` + 허용 origin 을 모두 만족할 때만.
 */

const BASE_ALLOWED = ["https://localhost", "capacitor://localhost", "ionic://localhost"];

function allowedOrigins(): Set<string> {
    const extra = (process.env.MOBILE_ALLOWED_ORIGINS || "")
        .split(",").map(s => s.trim()).filter(Boolean);
    return new Set([...BASE_ALLOWED, ...extra]);
}

export function isAllowedMobileOrigin(origin: string | null | undefined): boolean {
    return !!origin && allowedOrigins().has(origin);
}

/** 모바일 토큰 응답 자격: X-Safe-Link-Client: mobile + 허용 origin 동시 충족 */
export function isMobileClient(req: Request): boolean {
    return req.headers.get("x-safe-link-client") === "mobile"
        && isAllowedMobileOrigin(req.headers.get("origin"));
}

export function mobileCorsHeaders(origin: string | null | undefined): Record<string, string> {
    if (!isAllowedMobileOrigin(origin)) return {};
    return {
        "Access-Control-Allow-Origin": origin as string,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Safe-Link-Client",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
    };
}

/** 허용 origin이면 응답에 CORS 헤더 부착(웹/비허용 origin은 무변경 → 웹 호환). */
export function withMobileCors<T extends NextResponse>(res: T, origin: string | null | undefined): T {
    for (const [k, v] of Object.entries(mobileCorsHeaders(origin))) res.headers.set(k, v);
    return res;
}

/** OPTIONS preflight 처리: 허용 origin → 204+CORS, 그 외 → 403. (OPTIONS 아니면 null) */
export function handleMobilePreflight(req: Request): NextResponse | null {
    if (req.method !== "OPTIONS") return null;
    const origin = req.headers.get("origin");
    if (!isAllowedMobileOrigin(origin)) {
        return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, { status: 204, headers: mobileCorsHeaders(origin) });
}

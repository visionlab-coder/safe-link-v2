import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { getCookieUser } from "@/utils/auth/cookie-user";
import { getErrorMessage } from "@/utils/errors";
import {
    isLabMode,
    getLabConfigMasked,
    setLabConfig,
    type LabConfigInput,
    type TranslateEngine,
} from "@/utils/lab/engine-config";

// ⚠️ 배포 전 강화 필요: 기존 JWT 서명 미검증 취약점 때문에, 운영 승격 전
//    LAB_SECRET 추가 게이트 + JWT 서명검증을 반드시 선결할 것. (현재는 lab+login 게이트)
const VALID_ENGINES: TranslateEngine[] = ["papago", "google", "gemini", "flitto"];

export async function GET() {
    if (!isLabMode()) {
        return NextResponse.json({ labMode: false, config: null });
    }
    const user = await getCookieUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const config = await getLabConfigMasked();
    return NextResponse.json({ labMode: true, config });
}

export async function POST(req: Request) {
    if (!isLabMode()) {
        return NextResponse.json({ error: "Lab mode disabled (APP_MODE!=lab)" }, { status: 403 });
    }
    const user = await getCookieUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const body = await req.json() as LabConfigInput;
        const patch: LabConfigInput = {};

        if (body.translateEngine !== undefined) {
            const te = String(body.translateEngine);
            if (te !== "" && !VALID_ENGINES.includes(te as TranslateEngine)) {
                return NextResponse.json({ error: "Invalid translateEngine" }, { status: 400 });
            }
            patch.translateEngine = te;
        }
        // 키 필드: 문자열만 허용(빈 문자열 = 삭제). 길이 상한으로 남용 방지.
        for (const f of ["papagoId", "papagoSecret", "googleKey", "geminiKey", "flittoToken"] as const) {
            const v = body[f];
            if (v === undefined) continue;
            if (typeof v !== "string" || v.length > 2000) {
                return NextResponse.json({ error: `Invalid ${f}` }, { status: 400 });
            }
            patch[f] = v.trim();
        }

        await setLabConfig(patch);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

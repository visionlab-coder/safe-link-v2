import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { requireRootAdmin } from "@/utils/auth/require-root-admin";
import { getErrorMessage } from "@/utils/errors";
import {
    getLabConfigMasked,
    setLabConfig,
    type LabConfigInput,
    type TranslateEngine,
} from "@/utils/lab/engine-config";

// 🔐 AI 엔진/API키 설정 — SAFE-LINK 루트 관리자(MASTER_EMAILS)만 접근.
// ⚠️ 완전한 "나만" 보장은 JWT 서명검증 수정이 선결(현재는 MASTER 이메일 게이트 = 방어심층).
const VALID_ENGINES: TranslateEngine[] = ["m2m100", "papago", "google", "gemini", "flitto"];

export async function GET() {
    const root = await requireRootAdmin();
    if (!root) {
        // 루트관리자 아님 → 권한 없음(페이지가 안내). 설정 노출 안 함.
        return NextResponse.json({ rootAdmin: false, config: null });
    }
    const config = await getLabConfigMasked();
    return NextResponse.json({ rootAdmin: true, config });
}

export async function POST(req: Request) {
    const root = await requireRootAdmin();
    if (!root) {
        return NextResponse.json({ error: "FORBIDDEN_ROOT_ADMIN_ONLY" }, { status: 403 });
    }

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

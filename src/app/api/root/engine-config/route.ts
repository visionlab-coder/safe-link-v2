import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { requireDeveloper } from "@/utils/auth/require-developer";
import { getErrorMessage } from "@/utils/errors";
import {
    getLabConfigMasked,
    setLabConfig,
    appendKeyChangeAudit,
    getKeyChangeAudit,
    type LabConfigInput,
    type TranslateEngine,
} from "@/utils/lab/engine-config";

// 🔐 개발자(루트, "나만") 전용 — API 키 런타임 교체. DEVELOPER_EMAILS 게이트(마스터와 별개).
//    프로덕션 상시 동작(APP_MODE 무관). 저장은 AES-256-GCM 암호화, 응답은 마스킹(쓰기전용).
const VALID_ENGINES: TranslateEngine[] = ["m2m100", "papago", "google"];
const SECRET_FIELDS = ["papagoId", "papagoSecret", "googleKey"] as const;

export async function GET() {
    const dev = await requireDeveloper();
    if (!dev) {
        // 개발자 아님 → 설정 노출 안 함. 페이지가 "권한 없음" 안내.
        return NextResponse.json({ developer: false, config: null, audit: [] });
    }
    const [config, audit] = await Promise.all([getLabConfigMasked(), getKeyChangeAudit()]);
    return NextResponse.json({ developer: true, email: dev.email, config, audit });
}

export async function POST(req: Request) {
    const dev = await requireDeveloper();
    if (!dev) {
        return NextResponse.json({ error: "FORBIDDEN_DEVELOPER_ONLY" }, { status: 403 });
    }

    try {
        const body = (await req.json()) as LabConfigInput;
        const patch: LabConfigInput = {};

        if (body.translateEngine !== undefined) {
            const te = String(body.translateEngine);
            if (te !== "" && !VALID_ENGINES.includes(te as TranslateEngine)) {
                return NextResponse.json({ error: "Invalid translateEngine" }, { status: 400 });
            }
            patch.translateEngine = te;
        }

        const changedFields: string[] = [];
        for (const f of SECRET_FIELDS) {
            const v = body[f];
            if (v === undefined) continue;
            patch[f] = v;
            changedFields.push(v === "" ? `${f}(삭제)` : f);
        }

        if (patch.translateEngine === undefined && changedFields.length === 0) {
            return NextResponse.json({ error: "변경 사항 없음" }, { status: 400 });
        }

        await setLabConfig(patch, dev.email);
        // 감사: 누가/언제/무엇(필드명·엔진)만 기록 — 키 값은 절대 남기지 않음.
        await appendKeyChangeAudit({
            at: new Date().toISOString(),
            by: dev.email,
            engine: patch.translateEngine || undefined,
            fields: changedFields,
        });

        return NextResponse.json({ ok: true, appliedAt: new Date().toISOString() });
    } catch (e) {
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}

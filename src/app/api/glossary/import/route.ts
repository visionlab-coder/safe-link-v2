import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

type ImportRow = { slang: string; standard: string; category: string };

export async function POST(req: NextRequest) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let rows: ImportRow[];
    try {
        rows = await req.json();
    } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "rows_empty" }, { status: 400 });
    }

    const valid = rows.filter(r => r.slang?.trim() && r.standard?.trim());
    if (valid.length === 0) {
        return NextResponse.json({ error: "no_valid_rows" }, { status: 400 });
    }

    const sb = createServiceClient();

    // 기존 은어 목록 조회 (중복 체크)
    const slugs = valid.map(r => r.slang.trim());
    const { data: existing } = await sb
        .from("construction_glossary")
        .select("slang")
        .in("slang", slugs);

    const existingSet = new Set((existing ?? []).map((e: { slang: string }) => e.slang));

    const toInsert = valid
        .filter(r => !existingSet.has(r.slang.trim()))
        .map(r => ({
            slang: r.slang.trim(),
            standard: r.standard.trim(),
            category: r.category?.trim() || "기타",
            is_active: true,
        }));

    const dupCount = valid.length - toInsert.length;

    if (toInsert.length === 0) {
        return NextResponse.json({
            ok: 0,
            dup: dupCount,
            message: `모두 이미 등록된 항목입니다 (${dupCount}개 중복).`,
        });
    }

    const { error } = await sb.from("construction_glossary").insert(toInsert);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        ok: toInsert.length,
        dup: dupCount,
        message: `${toInsert.length}개 저장 완료 (${dupCount}개 중복 건너뜀).`,
    });
}

// ⚠️ 임시 진단 엔드포인트 — POC 테스트 완료 후 즉시 삭제할 것
import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

const TEST_EMAIL = "test-poc-admin@safe-link.local";
const TEST_PASSWORD = "TestPOC2026!";

export async function GET() {
    const service = createServiceClient();

    // 기존 테스트 계정 삭제 (있으면)
    const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = usersData?.users?.find((u) => u.email === TEST_EMAIL);
    if (existing) {
        await service.auth.admin.deleteUser(existing.id);
    }

    // 이메일 인증 완료 상태로 계정 생성
    const { data, error: createErr } = await service.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
    });

    if (createErr || !data.user) {
        return NextResponse.json({ error: createErr?.message ?? "계정 생성 실패" }, { status: 500 });
    }

    // 청주센텀푸르지오자이 현장 찾기
    const { data: site } = await service
        .from("sites")
        .select("id, name")
        .ilike("name", "%청주%")
        .limit(1)
        .maybeSingle();

    // SAFETY_OFFICER 프로필 생성
    const { error: profileErr } = await service.from("profiles").upsert({
        id: data.user.id,
        display_name: "POC 테스트 안전관리자",
        role: "SAFETY_OFFICER",
        site_id: site?.id ?? null,
        preferred_lang: "ko",
    });

    if (profileErr) {
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        message: "테스트 계정 생성 완료. 아래 계정으로 관리자 로그인 테스트 후 즉시 이 엔드포인트를 삭제하세요.",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        site: site?.name ?? "(현장 없음 — site_id null)",
        userId: data.user.id,
    });
}

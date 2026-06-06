import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";

export const runtime = "nodejs";

// /api/admin/testbed-health
// 테스트베드 두 현장(청주센텀·과천G-TOWN)의 데이터 무결성을 한 번에 점검.
// 운영자 + 자동수리 스킬 모두 호출 가능. ROOT/HQ_ADMIN 만 접근.

type SiteAuditResult = {
    site_id: string;
    name: string;
    admins: Array<{ display_name: string; role: string; lang: string | null }>;
    workers_active: number;
    workers: Array<{
        name_initials: string | null;
        phone_last4: string | null;
        phone: string | null;
        full_name: string | null;
        preferred_lang: string | null;
        has_auth: boolean;
        flags: string[];
    }>;
    issues: string[];
    duplicates: { by_initials_last4: string[]; by_phone: string[] };
};

const TESTBED_SITES = [
    { site_id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀푸르지오자이" },
    { site_id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const results: SiteAuditResult[] = [];

    for (const site of TESTBED_SITES) {
        // 관리자 (role !== 'WORKER')
        const { data: profileRows } = await guard.ctx.service
            .from("profiles")
            .select("display_name, role, preferred_lang")
            .eq("site_id", site.site_id);

        const allProfiles = (profileRows ?? []) as Array<{
            display_name: string | null;
            role: string | null;
            preferred_lang: string | null;
        }>;

        const admins = allProfiles
            .filter((p) => p.role && p.role !== "WORKER")
            .map((p) => ({
                display_name: p.display_name ?? "?",
                role: p.role ?? "?",
                lang: p.preferred_lang,
            }));

        // 활성 워커
        const { data: workerRows } = await guard.ctx.service
            .from("nfc_workers")
            .select("name_initials, phone_last4, phone, full_name, preferred_lang, auth_user_id, site_id, assigned_site_id")
            .eq("assigned_site_id", site.site_id)
            .eq("is_active", true);

        const workersRaw = (workerRows ?? []) as Array<{
            name_initials: string | null;
            phone_last4: string | null;
            phone: string | null;
            full_name: string | null;
            preferred_lang: string | null;
            auth_user_id: string | null;
            site_id: string | null;
            assigned_site_id: string;
        }>;

        const byInitLast = new Map<string, number>();
        const byPhone = new Map<string, number>();
        const issues: string[] = [];

        const workers = workersRaw.map((w) => {
            const flags: string[] = [];
            if (!w.name_initials) flags.push("INIT_NULL");
            if (!w.phone_last4) flags.push("LAST4_NULL");
            if (!w.phone) flags.push("PHONE_NULL");
            if (!w.full_name) flags.push("NAME_NULL");
            if (w.site_id && w.site_id !== w.assigned_site_id) flags.push("SITE_MISMATCH");
            if (!w.auth_user_id) flags.push("NO_AUTH");

            const key = `${w.name_initials}|${w.phone_last4}`;
            byInitLast.set(key, (byInitLast.get(key) ?? 0) + 1);
            if (w.phone) byPhone.set(w.phone, (byPhone.get(w.phone) ?? 0) + 1);

            // QR V2 자동가입 정책: phone 은 저장하지 않고 phone_last4 만 받음
            //   → PHONE_NULL 은 자동가입 워커의 정상 상태 (false positive)
            // NO_AUTH 도 첫 QR 진입 전 정상 상태.
            // 위 둘을 제외한 flag 가 있을 때만 진짜 issue 로 카운트.
            const INFORMATIONAL_FLAGS = new Set(["NO_AUTH", "PHONE_NULL"]);
            const realFlags = flags.filter((f) => !INFORMATIONAL_FLAGS.has(f));
            if (realFlags.length > 0) {
                issues.push(`${w.name_initials}/${w.phone_last4}: ${realFlags.join(",")}`);
            }

            return {
                name_initials: w.name_initials,
                phone_last4: w.phone_last4,
                phone: w.phone,
                full_name: w.full_name,
                preferred_lang: w.preferred_lang,
                has_auth: !!w.auth_user_id,
                flags,
            };
        });

        const dupInitLast = Array.from(byInitLast.entries())
            .filter(([, n]) => n > 1)
            .map(([k]) => k);
        const dupPhone = Array.from(byPhone.entries())
            .filter(([, n]) => n > 1)
            .map(([k]) => k);

        if (dupInitLast.length > 0) issues.push(`DUPLICATE(initials+last4): ${dupInitLast.join(", ")}`);
        if (dupPhone.length > 0) issues.push(`DUPLICATE(phone): ${dupPhone.join(", ")}`);

        results.push({
            site_id: site.site_id,
            name: site.name,
            admins,
            workers_active: workers.length,
            workers,
            issues,
            duplicates: { by_initials_last4: dupInitLast, by_phone: dupPhone },
        });
    }

    const total_issues = results.reduce((s, r) => s + r.issues.length, 0);

    return NextResponse.json({
        ok: total_issues === 0,
        total_issues,
        sites: results,
        checked_at: new Date().toISOString(),
    });
}

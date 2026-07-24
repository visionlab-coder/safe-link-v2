// /admin/tbm/create 페이지가 의존하는 모든 데이터 소스 실시간 점검.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TESTBED = [
  { id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀푸르지오자이" },
  { id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

console.log("=".repeat(70));
console.log("/admin/tbm/create  데이터 소스 점검");
console.log("=".repeat(70));

// 1) safety_education_library (기초교육 라이브러리 모달)
const { count: edu_count } = await sb
  .from("safety_education_library")
  .select("*", { count: "exact", head: true });
console.log(`\n[1] safety_education_library 전체 row 수: ${edu_count ?? "?"}`);

const { data: edu_sample, error: edu_err } = await sb
  .from("safety_education_library")
  .select("id, category, subcategory, title, is_critical, crew_type, worksite_type, ppe_required")
  .limit(3);
if (edu_err) console.log("  ERROR:", edu_err.message);
else console.log("  샘플 3개:", JSON.stringify(edu_sample, null, 2));

// 2) tbm_notices (발송 이력) - 사이트별
for (const site of TESTBED) {
  const { count } = await sb
    .from("tbm_notices")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id);
  console.log(`\n[2-${site.name}] tbm_notices 사이트별 row 수: ${count ?? "?"}`);
}
const { count: tbm_total } = await sb
  .from("tbm_notices")
  .select("*", { count: "exact", head: true });
console.log(`    tbm_notices 전체 row 수: ${tbm_total ?? "?"}`);

// 3) profiles - 두 사이트 관리자 (페이지가 profile 로드 후 site_id 결정)
for (const site of TESTBED) {
  const { data: admins } = await sb
    .from("profiles")
    .select("id, display_name, role, preferred_lang, site_id")
    .eq("site_id", site.id)
    .neq("role", "WORKER");
  console.log(`\n[3-${site.name}] admin profiles: ${admins?.length ?? 0}명`);
  if (admins?.length) {
    for (const a of admins.slice(0, 3)) {
      console.log(`    ${a.display_name} (${a.role}, ${a.preferred_lang ?? "?"})`);
    }
  }
}

// 4) RLS 확인 — anon 으로 조회 시 어떤 결과가 나오나
const anonSb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const { count: anon_edu, error: anon_err } = await anonSb
  .from("safety_education_library")
  .select("*", { count: "exact", head: true });
console.log(`\n[4] anon 으로 safety_education_library 조회: ${anon_err?.message ?? `${anon_edu}건`}`);

// 5) P3 마이그레이션 적용 검증 — 새 컬럼 존재 여부
const { error: cols_err } = await sb
  .from("safety_education_library")
  .select("id, crew_type, worksite_type, applicable_time_window, ppe_required, inspection_checklist, site_id")
  .limit(1);
console.log(`\n[5] P3 마이그레이션 새 컬럼: ${cols_err ? "❌ " + cols_err.message : "✅ 정상 존재"}`);

console.log("\n" + "=".repeat(70));

// 스크린샷 두 페이지 정확한 데이터 진단:
//   /admin/chat → profiles WHERE role='WORKER' (사이트별)
//   /admin/glossary → construction_glossary
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TESTBED = [
  { id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀" },
  { id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

console.log("=".repeat(70));
console.log("스크린샷 2개 페이지 정확한 데이터 진단");
console.log("=".repeat(70));

// 1) /admin/chat 의 워커 리스트 — profiles 테이블 기준
console.log("\n[A] /admin/chat 데이터 소스 = profiles WHERE role='WORKER'");
for (const site of TESTBED) {
  const { data: workers, count } = await sb
    .from("profiles")
    .select("id, display_name, preferred_lang, role, site_id", { count: "exact" })
    .eq("role", "WORKER")
    .eq("site_id", site.id);
  console.log(`  ${site.name}: profiles WORKER ${count ?? 0}명`);
  if (workers?.length) {
    for (const w of workers.slice(0, 5)) console.log(`     - ${w.display_name} (${w.preferred_lang})`);
  }
}
const { count: total_workers_profile } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("role", "WORKER");
console.log(`  전체 profiles WORKER: ${total_workers_profile ?? 0}명`);

// 1-b) nfc_workers 와 profiles 의 차이 검증
console.log("\n[A'] 비교: nfc_workers (QR 자동가입) vs profiles WORKER");
for (const site of TESTBED) {
  const { data: nfc } = await sb
    .from("nfc_workers")
    .select("id, full_name, name_initials, auth_user_id")
    .eq("assigned_site_id", site.id)
    .eq("is_active", true);
  const withAuth = (nfc ?? []).filter((w) => w.auth_user_id);
  const withoutAuth = (nfc ?? []).filter((w) => !w.auth_user_id);
  console.log(`  ${site.name}: nfc_workers ${nfc?.length ?? 0}명 (auth 있음 ${withAuth.length}, auth 없음 ${withoutAuth.length})`);
}

// 2) /admin/glossary 의 용어 목록 — construction_glossary 테이블
console.log("\n[B] /admin/glossary 데이터 소스 = construction_glossary");
const { count: gloss_count, error: gloss_err } = await sb
  .from("construction_glossary")
  .select("*", { count: "exact", head: true });
if (gloss_err) {
  console.log(`  ❌ ERROR: ${gloss_err.message}`);
} else {
  console.log(`  construction_glossary 전체 row 수: ${gloss_count ?? 0}`);
}
const { data: gloss_sample } = await sb
  .from("construction_glossary")
  .select("slang, standard, is_active")
  .limit(5);
console.log(`  샘플 (최대 5건):`, JSON.stringify(gloss_sample, null, 2));

// 3) RLS anon 확인 (실제 client 가 어떻게 조회될지)
console.log("\n[C] RLS anon 조회 — 실제 클라이언트 시뮬레이션");
const anonSb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const { count: anon_workers, error: aw_err } = await anonSb
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("role", "WORKER");
console.log(`  anon profiles WORKER 조회: ${aw_err ? "❌ " + aw_err.message : `${anon_workers}건`}`);
const { count: anon_gloss, error: ag_err } = await anonSb
  .from("construction_glossary")
  .select("*", { count: "exact", head: true });
console.log(`  anon construction_glossary 조회: ${ag_err ? "❌ " + ag_err.message : `${anon_gloss}건`}`);

console.log("\n" + "=".repeat(70));

// 3가지 이슈 정밀 진단:
//   1. 교육 현장 5명 — 어느 admin 이 봄?
//   2. 청주센텀 admin/chat 12명 vs nfc_workers 6명 차이 원인
//   3. 국가 표시 'GB' 출처 — nfc_workers.nationality vs preferred_lang
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SITES = {
  cheongju: "757c7630-8fb0-4c38-b76e-3129bf15b356",
  gwacheon: "38e35a02-d470-41ae-a169-82ba5bae4a5c",
};

// SAFE-LINK 교육 현장 site_id 찾기
const { data: edu } = await sb.from("sites").select("id, name").ilike("name", "%교육%");
const eduSiteId = edu?.[0]?.id;
console.log("=".repeat(75));
console.log("이슈 1. 교육 현장 — site_id + 누가 봄?");
console.log("=".repeat(75));
console.log(`SAFE-LINK 교육 현장 site_id: ${eduSiteId ?? "?"}`);

const { data: eduAdmins } = await sb
  .from("profiles")
  .select("display_name, role, title")
  .eq("site_id", eduSiteId)
  .neq("role", "WORKER")
  .neq("role", "DEACTIVATED");

console.log(`\n교육 현장 admin (site_id 매칭): ${eduAdmins?.length ?? 0}명`);
for (const a of (eduAdmins ?? [])) console.log(`  ${a.role.padEnd(15)} | ${a.display_name} (${a.title ?? "-"})`);

console.log("\n본사/전사 admin (site_id null, 전 현장 봄):");
const { data: hqAdmins } = await sb
  .from("profiles")
  .select("display_name, role, title")
  .is("site_id", null)
  .in("role", ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"]);
for (const a of (hqAdmins ?? [])) console.log(`  ${a.role.padEnd(15)} | ${a.display_name} (${a.title ?? "-"})`);

console.log("\n→ 결론: 교육 현장 워커 5명을 보는 사람 = 위 본사 + 교육 현장 admin");

// ─────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(75));
console.log("이슈 2. 청주센텀 12명 vs 6명 차이");
console.log("=".repeat(75));

const { data: cheongjuProfiles } = await sb
  .from("profiles")
  .select("id, display_name, preferred_lang, phone_number, created_at")
  .eq("site_id", SITES.cheongju)
  .eq("role", "WORKER")
  .order("created_at");

console.log(`\nprofiles WORKER (admin/chat 노출 기준): ${cheongjuProfiles?.length ?? 0}명`);
cheongjuProfiles?.forEach((p, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. ${p.display_name.padEnd(10)} | lang=${p.preferred_lang ?? "?"} | phone=${p.phone_number ?? "없음"} | ${p.created_at?.slice(0, 10)} | id=${p.id.slice(0, 8)}…`);
});

const { data: cheongjuNfc } = await sb
  .from("nfc_workers")
  .select("id, name_initials, phone_last4, full_name, nationality, auth_user_id, created_at")
  .eq("assigned_site_id", SITES.cheongju)
  .eq("is_active", true)
  .order("created_at");

console.log(`\nnfc_workers (active): ${cheongjuNfc?.length ?? 0}명`);
cheongjuNfc?.forEach((w, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. ${w.name_initials}/${w.phone_last4} | nationality=${w.nationality ?? "?"} | auth=${w.auth_user_id ? w.auth_user_id.slice(0, 8) + "…" : "없음"} | ${w.created_at?.slice(0, 10)}`);
});

// 차이 분석
const nfcAuthIds = new Set((cheongjuNfc ?? []).map((w) => w.auth_user_id).filter(Boolean));
const orphans = (cheongjuProfiles ?? []).filter((p) => !nfcAuthIds.has(p.id));
console.log(`\n🔍 nfc_workers 매칭 없는 profile (= 옛 잔존 데이터): ${orphans.length}명`);
orphans.forEach((p) => console.log(`     ${p.display_name} | phone=${p.phone_number ?? "없음"} | ${p.created_at?.slice(0, 10)} | id=${p.id.slice(0, 8)}…`));

// ─────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(75));
console.log("이슈 3. 국가표시 'GB' 출처 — nationality 컬럼 분포");
console.log("=".repeat(75));

const { data: nationalities } = await sb
  .from("nfc_workers")
  .select("nationality, preferred_lang")
  .eq("is_active", true);

const counts = {};
const langByNat = {};
for (const w of (nationalities ?? [])) {
  const key = w.nationality ?? "NULL";
  counts[key] = (counts[key] ?? 0) + 1;
  if (!langByNat[key]) langByNat[key] = new Set();
  langByNat[key].add(w.preferred_lang ?? "?");
}

console.log("\nnfc_workers.nationality 컬럼 분포:");
for (const [nat, cnt] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  const langs = Array.from(langByNat[nat]).join(",");
  console.log(`  ${nat.padEnd(8)} | ${cnt}명 | preferred_lang: ${langs}`);
}

const { data: gbList } = await sb
  .from("nfc_workers")
  .select("name_initials, phone_last4, full_name, preferred_lang, assigned_site_id")
  .eq("nationality", "GB")
  .eq("is_active", true);

console.log(`\n🔍 nationality='GB' 워커 상세: ${gbList?.length ?? 0}명`);
gbList?.forEach((w) => {
  const site = w.assigned_site_id === SITES.cheongju ? "청주센텀" : w.assigned_site_id === SITES.gwacheon ? "과천" : "?";
  console.log(`     ${w.name_initials}/${w.phone_last4} | ${w.full_name} | lang=${w.preferred_lang} | site=${site}`);
});

console.log("\n📌 추정: 'GB' = United Kingdom (영국) ISO 3166-1 alpha-2 코드.");
console.log("    QR 자동가입에서 preferred_lang='en' 인 워커가 nationality 어디로 잡혔는지 확인됨.");
console.log("    실제 영국 국적 워커가 아니면 잘못된 매핑 — 수정 필요.");

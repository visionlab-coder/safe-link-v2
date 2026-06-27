// 사이트 격리 진단:
//   1) profiles WORKER 중 site_id NULL 인 워커 수 (현장 격리 풀림 원인)
//   2) site_id 가 있더라도 nfc_workers.assigned_site_id 와 불일치 인 워커
//   3) 각 admin 의 site_id 상태 + 본인 site 워커 가시성
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

console.log("=".repeat(70));
console.log("사이트 격리 진단");
console.log("=".repeat(70));

// 1) profiles WORKER 전체 + site_id 상태
const { data: workers } = await sb
  .from("profiles")
  .select("id, display_name, role, site_id, phone_number, preferred_lang, created_at")
  .eq("role", "WORKER")
  .order("created_at", { ascending: false });

const total = workers?.length ?? 0;
const withSite = (workers ?? []).filter((w) => w.site_id);
const withoutSite = (workers ?? []).filter((w) => !w.site_id);

console.log(`\n[1] 전체 profiles WORKER: ${total}명`);
console.log(`    site_id 있음: ${withSite.length}명`);
console.log(`    site_id 없음: ${withoutSite.length}명 ← 현장 분리 풀림 원인`);

if (withoutSite.length) {
  console.log(`\n    site_id NULL 워커 목록:`);
  withoutSite.forEach((w, i) => {
    const phone = w.phone_number ? `📞${w.phone_number.slice(-4)}` : "📞없음";
    console.log(`      ${i + 1}. ${w.display_name ?? "?"} (${w.preferred_lang ?? "?"}) ${phone}`);
  });
}

// 2) phone_number 로 nfc_workers 매칭 — site_id 복구 가능한 워커
console.log(`\n[2] site_id NULL 워커 중 nfc_workers 매칭 가능 (백필 후보):`);
let backfillable = 0;
for (const w of withoutSite) {
  if (!w.phone_number) continue;
  const { data: nfc } = await sb
    .from("nfc_workers")
    .select("id, assigned_site_id, name_initials, phone_last4")
    .eq("phone", w.phone_number)
    .eq("is_active", true)
    .maybeSingle();
  if (nfc?.assigned_site_id) {
    const { data: site } = await sb
      .from("sites")
      .select("name")
      .eq("id", nfc.assigned_site_id)
      .maybeSingle();
    console.log(`      ${w.display_name ?? "?"} → ${nfc.name_initials}/${nfc.phone_last4} → ${site?.name ?? nfc.assigned_site_id}`);
    backfillable++;
  }
}
console.log(`    백필 가능: ${backfillable}명 / ${withoutSite.length}명`);

// 3) site_id vs nfc_workers.assigned_site_id 불일치
const { data: mismatchCheck } = await sb
  .from("profiles")
  .select("id, display_name, site_id, phone_number")
  .eq("role", "WORKER")
  .not("site_id", "is", null)
  .not("phone_number", "is", null);

let mismatchCount = 0;
for (const p of (mismatchCheck ?? [])) {
  const { data: nfc } = await sb
    .from("nfc_workers")
    .select("assigned_site_id")
    .eq("phone", p.phone_number)
    .eq("is_active", true)
    .maybeSingle();
  if (nfc?.assigned_site_id && nfc.assigned_site_id !== p.site_id) {
    if (mismatchCount === 0) console.log(`\n[3] site_id 불일치 (profiles vs nfc_workers):`);
    console.log(`      ${p.display_name}: profiles=${p.site_id?.slice(0, 8)} ≠ nfc=${nfc.assigned_site_id.slice(0, 8)}`);
    mismatchCount++;
  }
}
if (mismatchCount === 0) console.log(`\n[3] site_id 불일치 없음 ✅`);

console.log("\n" + "=".repeat(70));
console.log(`결론: site_id NULL ${withoutSite.length}명 → 자동 백필 시 ${backfillable}명 복구 가능`);
console.log("=".repeat(70));

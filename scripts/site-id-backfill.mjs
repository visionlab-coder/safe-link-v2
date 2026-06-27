// 사이트 격리 자동 복구: profiles WORKER 의 site_id NULL → nfc_workers.assigned_site_id 백필.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

console.log("=".repeat(70));
console.log("site_id 백필 실행");
console.log("=".repeat(70));

const { data: workers } = await sb
  .from("profiles")
  .select("id, display_name, phone_number")
  .eq("role", "WORKER")
  .is("site_id", null)
  .not("phone_number", "is", null);

let updated = 0;
let skipped = 0;

for (const w of (workers ?? [])) {
  const { data: nfc } = await sb
    .from("nfc_workers")
    .select("assigned_site_id, name_initials, phone_last4")
    .eq("phone", w.phone_number)
    .eq("is_active", true)
    .maybeSingle();

  if (!nfc?.assigned_site_id) {
    console.log(`  ⏭️  ${w.display_name}: nfc_workers 매칭 없음 — 스킵`);
    skipped++;
    continue;
  }

  const { error } = await sb
    .from("profiles")
    .update({ site_id: nfc.assigned_site_id })
    .eq("id", w.id);

  if (error) {
    console.log(`  ❌ ${w.display_name}: ${error.message}`);
    skipped++;
  } else {
    console.log(`  ✅ ${w.display_name} (${nfc.name_initials}/${nfc.phone_last4}) → site ${nfc.assigned_site_id.slice(0, 8)}…`);
    updated++;
  }
}

console.log("\n" + "=".repeat(70));
console.log(`백필 완료: ${updated}명 업데이트, ${skipped}명 스킵`);
console.log("=".repeat(70));

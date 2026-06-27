// profiles.nationality 백필 — nfc_workers.nationality 와 매칭하여 일괄 채움.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// 1. 컬럼 존재 검증
const { error: colErr } = await sb.from("profiles").select("nationality").limit(1);
if (colErr) {
  console.error("❌ profiles.nationality 컬럼 없음 — 마이그레이션 SQL 실행 확인 필요");
  console.error("   ", colErr.message);
  process.exit(1);
}
console.log("✅ profiles.nationality 컬럼 확인");

// 2. nfc_workers 의 auth_user_id ↔ nationality 매핑 일괄 백필
const { data: nfcWorkers } = await sb
  .from("nfc_workers")
  .select("auth_user_id, nationality, name_initials, phone_last4, full_name")
  .eq("is_active", true)
  .not("auth_user_id", "is", null)
  .not("nationality", "is", null);

console.log(`\n📥 백필 대상: ${nfcWorkers?.length ?? 0}명 (NFC 활성 + auth 연결 + nationality 있음)\n`);

let success = 0;
let skip = 0;
for (const w of (nfcWorkers ?? [])) {
  const { error } = await sb
    .from("profiles")
    .update({ nationality: w.nationality })
    .eq("id", w.auth_user_id);
  if (error) {
    console.log(`  ❌ ${w.name_initials}/${w.phone_last4}: ${error.message}`);
    skip++;
  } else {
    console.log(`  ✅ ${w.name_initials}/${w.phone_last4} (${w.full_name}) → nationality=${w.nationality}`);
    success++;
  }
}

console.log(`\n📊 백필 완료: ${success}건 / 실패 ${skip}건`);

// 3. 검증 — 현장별 nationality 분포
const { data: sites } = await sb.from("sites").select("id, name");
const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));

const TESTBED = ["757c7630-8fb0-4c38-b76e-3129bf15b356", "38e35a02-d470-41ae-a169-82ba5bae4a5c"];

console.log("\n" + "=".repeat(72));
console.log("검증 — 테스트베드 워커 nationality 현황");
console.log("=".repeat(72));

for (const sid of TESTBED) {
  const { data: list } = await sb
    .from("profiles")
    .select("display_name, preferred_lang, nationality")
    .eq("site_id", sid)
    .eq("role", "WORKER");
  console.log(`\n📍 ${siteMap.get(sid)} — ${list?.length ?? 0}명`);
  list?.forEach((p, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${p.display_name.padEnd(8)} | lang=${p.preferred_lang ?? "?"} | nationality=${p.nationality ?? "NULL"}`);
  });
}

// 1. 청주센텀 잔존 6명 DEACTIVATED 처리
// 2. profiles.nationality 컬럼 추가 (없으면) + nfc_workers 매칭으로 백필
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CHEONGJU_SITE = "757c7630-8fb0-4c38-b76e-3129bf15b356";

// ── Step 1: 청주 잔존 6명 식별 + DEACTIVATED ─────────────────────
const { data: profiles } = await sb
  .from("profiles")
  .select("id, display_name")
  .eq("site_id", CHEONGJU_SITE)
  .eq("role", "WORKER");

const { data: nfc } = await sb
  .from("nfc_workers")
  .select("auth_user_id")
  .eq("assigned_site_id", CHEONGJU_SITE)
  .eq("is_active", true);

const validIds = new Set((nfc ?? []).map((w) => w.auth_user_id).filter(Boolean));
const orphans = (profiles ?? []).filter((p) => !validIds.has(p.id));

console.log("=".repeat(72));
console.log(`Step 1: 청주센텀 잔존 ${orphans.length}명 DEACTIVATED 처리`);
console.log("=".repeat(72));

for (const p of orphans) {
  const { error } = await sb
    .from("profiles")
    .update({
      role: "DEACTIVATED",
      display_name: `${p.display_name} [잔존정리 ${new Date().toISOString().slice(0, 10)}]`,
    })
    .eq("id", p.id);
  console.log(error ? `❌ ${p.display_name}: ${error.message}` : `✅ ${p.display_name} → DEACTIVATED`);
}

// ── Step 2: profiles 의 nationality 백필 (이미 컬럼 있다고 가정) ─────
console.log("\n" + "=".repeat(72));
console.log("Step 2: profiles 의 nationality 컬럼 확인 + nfc_workers 매칭 백필");
console.log("=".repeat(72));

const { data: nationalitySample, error: colErr } = await sb
  .from("profiles")
  .select("nationality")
  .limit(1);

if (colErr && colErr.message.includes("nationality")) {
  console.log("⚠️ profiles.nationality 컬럼 없음 — Supabase 대시보드에서 다음 SQL 실행 필요:");
  console.log(`
  alter table public.profiles
    add column if not exists nationality text;
  comment on column public.profiles.nationality is
    'ISO 3166-1 alpha-2. NFC 가입 시 nfc_workers.nationality 동기화';
  `);
  process.exit(0);
}

// 모든 활성 nfc_workers 의 auth_user_id ↔ nationality 매핑
const { data: allNfc } = await sb
  .from("nfc_workers")
  .select("auth_user_id, nationality")
  .eq("is_active", true)
  .not("auth_user_id", "is", null);

console.log(`\n매칭 가능 NFC 워커: ${allNfc?.length ?? 0}명`);

let updated = 0;
for (const w of (allNfc ?? [])) {
  if (!w.nationality) continue;
  const { error } = await sb
    .from("profiles")
    .update({ nationality: w.nationality })
    .eq("id", w.auth_user_id);
  if (!error) updated++;
}
console.log(`✅ profiles.nationality 백필 완료: ${updated}명`);

// 검증
const { data: finalCheck } = await sb
  .from("profiles")
  .select("display_name, preferred_lang, nationality")
  .eq("site_id", CHEONGJU_SITE)
  .eq("role", "WORKER");

console.log("\n청주센텀 활성 워커 nationality 현황:");
for (const p of (finalCheck ?? [])) {
  console.log(`  ${p.display_name.padEnd(10)} | lang=${p.preferred_lang ?? "?"} | nationality=${p.nationality ?? "NULL"}`);
}

// 중복 머지 계획 dry-run.
//   - 같은 사이트 내 같은 이니셜 + 다른 phone 상태 의 워커들 식별
//   - "정본" = nfc_workers 와 매칭된 profile (phone_number 있음)
//   - "후보 삭제" = 같은 이니셜, phone_number=null, 가입일이 정본보다 빠름 또는 같음
//   - 외래키 cascade 영향 dry-run (messages, tbm_quiz_responses 등)
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SITES = [
  { id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀" },
  { id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

// profiles 스키마 확인
const { data: sample } = await sb.from("profiles").select("*").limit(1);
console.log("profiles 컬럼:", Object.keys(sample?.[0] ?? {}).join(", "));
console.log();

// 외래키 영향 확인할 테이블들
const FK_TABLES = [
  "messages",
  "tbm_quiz_responses",
  "nfc_worker_daily_access",
  "claim13_pledges",
  "nfc_tbm_sessions",
];

console.log("=".repeat(72));
console.log("중복 머지 계획");
console.log("=".repeat(72));

for (const site of SITES) {
  console.log(`\n📍 ${site.name}`);

  const { data: workers } = await sb
    .from("profiles")
    .select("id, display_name, preferred_lang, phone_number, created_at")
    .eq("role", "WORKER")
    .eq("site_id", site.id)
    .order("display_name")
    .order("created_at");

  const byName = new Map();
  for (const w of workers ?? []) {
    const key = (w.display_name ?? "?").toUpperCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(w);
  }

  for (const [name, list] of byName) {
    if (list.length === 1) continue; // 중복 없음

    // 정본 = phone_number 있는 것 (NFC 매칭본). 없으면 최신.
    const canonical = list.find((w) => w.phone_number) ?? list[list.length - 1];
    const dups = list.filter((w) => w.id !== canonical.id);

    console.log(`\n  🔸 ${name} — ${list.length}건 (정본 1 + 중복 ${dups.length})`);
    console.log(`     정본 (유지): id=${canonical.id.slice(0, 8)}… phone=${canonical.phone_number ?? "없음"} ${canonical.created_at?.slice(0, 10)}`);

    for (const d of dups) {
      let fkSum = 0;
      const fkBreakdown = [];
      for (const t of FK_TABLES) {
        try {
          const col = t === "messages" ? "from_user" : t === "tbm_quiz_responses" ? "user_id" : t === "claim13_pledges" ? "worker_id" : "worker_id";
          // 다양한 컬럼명 시도 — 못 찾으면 0
          const { count } = await sb.from(t).select("*", { count: "exact", head: true }).eq(col, d.id);
          if (count && count > 0) {
            fkSum += count;
            fkBreakdown.push(`${t}=${count}`);
          }
        } catch {
          /* 컬럼명 다르면 무시 */
        }
      }
      console.log(`     ❌ 후보삭제: id=${d.id.slice(0, 8)}… phone=${d.phone_number ?? "없음"} ${d.created_at?.slice(0, 10)} | 외래키 ${fkSum}건 ${fkBreakdown.length ? "(" + fkBreakdown.join(", ") + ")" : ""}`);
    }
  }
}

// 김무빈 SAFETY_OFFICER 중복 검증
console.log("\n" + "=".repeat(72));
console.log("김무빈 관련 프로필 — 통합 계획");
console.log("=".repeat(72));

const { data: kims } = await sb
  .from("profiles")
  .select("id, display_name, role, site_id, title, created_at, preferred_lang")
  .ilike("display_name", "%김무빈%")
  .order("created_at");

for (const k of kims ?? []) {
  console.log(`  ${k.role.padEnd(15)} | ${k.display_name.padEnd(15)} | ${k.title ?? "-"} | site=${k.site_id?.slice(0, 8) ?? "본사"} | ${k.created_at?.slice(0, 10)} | id=${k.id.slice(0, 8)}…`);
}

console.log("\n권고:");
console.log("  ✅ 유지 1: ROOT 김무빈 (본사 마스터) — 변경 없음");
console.log("  ✅ 유지 2: SAFETY_OFFICER 1개 — 가장 최신/현장 활성 계정");
console.log("  🗑️  비활성화: 나머지 SAFETY_OFFICER (role → 'DEACTIVATED' 또는 site_id null)");
console.log("\n⚠️  실제 본인 활성 계정이 어느 건지 확정 위해 사용자 확인 필요");

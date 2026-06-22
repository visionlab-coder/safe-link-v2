// A + B 자동 정리:
//   A. 중복 워커 머지 — nfc_workers.auth_user_id 기준 정본 + 외래키 UPDATE + 옛 profile DELETE
//   B. 김무빈 SAFETY_OFFICER 1개로 통합 (가장 오래된 것 DEACTIVATED)
//   + 비번 표시 한계 명시
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const FK_TARGETS = [
  { table: "messages", col: "from_user" },
  { table: "messages", col: "to_user" },
  { table: "tbm_quiz_responses", col: "user_id" },
  { table: "claim13_pledges", col: "worker_id" },
  { table: "nfc_worker_daily_access", col: "worker_id" },
];

async function fkCount(table, col, id) {
  try {
    const { count } = await sb.from(table).select("*", { count: "exact", head: true }).eq(col, id);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function fkRemap(table, col, fromId, toId) {
  try {
    const { error } = await sb.from(table).update({ [col]: toId }).eq(col, fromId);
    return error ? `❌ ${error.message}` : "ok";
  } catch (e) {
    return `❌ ${e.message ?? e}`;
  }
}

console.log("=".repeat(72));
console.log("A. 중복 워커 자동 머지 (nfc_workers.auth_user_id 기준 정본)");
console.log("=".repeat(72));

// 1) nfc_workers 의 auth_user_id 가 진짜 정본 profile
const { data: nfcAll } = await sb
  .from("nfc_workers")
  .select("id, name_initials, phone_last4, phone, full_name, assigned_site_id, auth_user_id")
  .eq("is_active", true);

const canonicalIds = new Set((nfcAll ?? []).map((w) => w.auth_user_id).filter(Boolean));

// 2) profiles WORKER 중 같은 site_id + 같은 display_name 그룹
const { data: workerProfiles } = await sb
  .from("profiles")
  .select("id, display_name, site_id, phone_number, created_at")
  .eq("role", "WORKER");

const byKey = new Map();
for (const p of workerProfiles ?? []) {
  const k = `${p.site_id ?? "_"}|${(p.display_name ?? "?").toUpperCase()}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(p);
}

let mergedCount = 0;
let deletedCount = 0;

for (const [k, list] of byKey) {
  if (list.length === 1) continue;

  // 정본: canonicalIds 에 포함되는 것. 없으면 가장 최근 phone_number 있는 것. 없으면 가장 최근.
  const canonical =
    list.find((p) => canonicalIds.has(p.id)) ??
    list.find((p) => p.phone_number) ??
    list[list.length - 1];
  const dups = list.filter((p) => p.id !== canonical.id);

  console.log(`\n🔸 ${k.split("|")[1]} (site ${k.split("|")[0].slice(0, 8)}…)`);
  console.log(`   정본 유지: ${canonical.id.slice(0, 8)}… phone=${canonical.phone_number ?? "없음"} ${canonical.created_at?.slice(0, 10)}`);

  for (const d of dups) {
    let total = 0;
    const remaps = [];
    for (const { table, col } of FK_TARGETS) {
      const cnt = await fkCount(table, col, d.id);
      if (cnt > 0) {
        const r = await fkRemap(table, col, d.id, canonical.id);
        remaps.push(`${table}.${col}=${cnt}→${r}`);
        if (r === "ok") total += cnt;
      }
    }

    const { error: delErr } = await sb.from("profiles").delete().eq("id", d.id);
    if (delErr) {
      console.log(`   ⚠️  ${d.id.slice(0, 8)}… DELETE 실패: ${delErr.message} (FK remap: ${remaps.join(", ") || "없음"})`);
    } else {
      console.log(`   ✅ ${d.id.slice(0, 8)}… 머지 완료. FK ${total}건 이전 (${remaps.join(", ") || "외래키 없음"})`);
      mergedCount += total;
      deletedCount++;
    }
  }
}

console.log(`\n✅ A 결과: 중복 ${deletedCount}건 머지/삭제 / 외래키 ${mergedCount}건 정본으로 이전\n`);

// ─────────────────────────────────────────────────────────────────────
// B. 김무빈 SAFETY_OFFICER 1개로 통합
// ─────────────────────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("B. 김무빈 SAFETY_OFFICER 통합 — 가장 최신 1개 유지");
console.log("=".repeat(72));

const { data: kims } = await sb
  .from("profiles")
  .select("id, display_name, role, site_id, created_at, title")
  .ilike("display_name", "%김무빈%")
  .eq("role", "SAFETY_OFFICER")
  .order("created_at", { ascending: false });

if ((kims ?? []).length > 1) {
  const keep = kims[0]; // 최신
  const deactivate = kims.slice(1);
  console.log(`\n✅ 유지: ${keep.display_name} (${keep.created_at?.slice(0, 10)}) id=${keep.id.slice(0, 8)}…`);
  for (const k of deactivate) {
    // role 을 'DEACTIVATED' 로 — 향후 로그인 시 미들웨어 거부
    const { error } = await sb
      .from("profiles")
      .update({
        role: "DEACTIVATED",
        display_name: `${k.display_name} [중복비활성 ${new Date().toISOString().slice(0, 10)}]`,
      })
      .eq("id", k.id);
    console.log(`${error ? "⚠️" : "🗑️ "} 비활성화: ${k.display_name} (${k.created_at?.slice(0, 10)}) → ${error ? error.message : "DEACTIVATED"}`);
  }
} else {
  console.log("중복 없음");
}

console.log("\n" + "=".repeat(72));
console.log("✅ A + B 자동 정리 완료. 다음 단계: user-roster-full 재실행으로 최종 리스트 확인");
console.log("=".repeat(72));

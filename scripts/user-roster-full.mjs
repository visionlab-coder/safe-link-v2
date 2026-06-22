// 전체 사용자 분류 리스트:
//   1) 관리자 — role 등급별
//   2) 근로자 — 현장별
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ROLE_LABEL = {
  ROOT: "🟣 ROOT (레거시 최상위)",
  SUPER_ADMIN: "🟣 SUPER_ADMIN (CTO/대표)",
  HQ_ADMIN: "🔵 HQ_ADMIN (본사 관리자)",
  HQ_OFFICER: "🔵 HQ_OFFICER (본사 안전담당)",
  SAFETY_OFFICER: "🟢 SAFETY_OFFICER (현장 안전관리)",
  SITE_ADMIN: "🟢 SITE_ADMIN (현장 공무)",
  WORKER: "🟡 WORKER",
};

const ROLE_RANK = {
  SUPER_ADMIN: 1, ROOT: 2,
  HQ_ADMIN: 3, HQ_OFFICER: 4,
  SAFETY_OFFICER: 5, SITE_ADMIN: 6,
  WORKER: 99,
};

const LANG_LABEL = {
  ko: "🇰🇷한국", vi: "🇻🇳베트남", zh: "🇨🇳중국", th: "🇹🇭태국", uz: "🇺🇿우즈벡",
  ph: "🇵🇭필리핀", km: "🇰🇭캄보디아", id: "🇮🇩인니", mn: "🇲🇳몽골", my: "🇲🇲미얀마",
  ne: "🇳🇵네팔", bn: "🇧🇩방글라", kk: "🇰🇿카자흐", ru: "🇷🇺러시아", en: "🇺🇸영어",
  jp: "🇯🇵일본", ar: "🇸🇦아랍", hi: "🇮🇳힌디",
};

// ──────────────────────────────────────────────────────────
// 1) 관리자 — 등급별
// ──────────────────────────────────────────────────────────
const { data: admins } = await sb
  .from("profiles")
  .select("id, display_name, role, preferred_lang, site_id, title, created_at")
  .neq("role", "WORKER")
  .order("role")
  .order("created_at", { ascending: true });

const { data: sites } = await sb
  .from("sites")
  .select("id, name, site_code");
const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));

const byRole = new Map();
for (const a of admins ?? []) {
  const role = (a.role ?? "?").toUpperCase();
  if (!byRole.has(role)) byRole.set(role, []);
  byRole.get(role).push(a);
}

const sortedRoles = Array.from(byRole.keys()).sort(
  (a, b) => (ROLE_RANK[a] ?? 50) - (ROLE_RANK[b] ?? 50)
);

console.log("=".repeat(72));
console.log(`🛡️  관리자 등급별 리스트 — 전체 ${admins?.length ?? 0}명`);
console.log("=".repeat(72));

for (const role of sortedRoles) {
  const list = byRole.get(role);
  const label = ROLE_LABEL[role] ?? `🔸 ${role}`;
  console.log(`\n${label} — ${list.length}명`);
  list.forEach((a, i) => {
    const lang = LANG_LABEL[a.preferred_lang] ?? a.preferred_lang ?? "?";
    const site = a.site_id ? siteMap.get(a.site_id) ?? "?" : "본사(전 현장)";
    const title = a.title ? ` · ${a.title}` : "";
    const date = a.created_at ? new Date(a.created_at).toLocaleDateString("ko-KR") : "?";
    console.log(`  ${(i + 1).toString().padStart(2)}. ${(a.display_name ?? "?").padEnd(20)} | ${lang.padEnd(8)} | ${site}${title} | ${date}`);
  });
}

// ──────────────────────────────────────────────────────────
// 2) 근로자 — 현장별
// ──────────────────────────────────────────────────────────
const { data: workers } = await sb
  .from("profiles")
  .select("id, display_name, preferred_lang, site_id, phone_number, created_at")
  .eq("role", "WORKER")
  .order("site_id")
  .order("created_at", { ascending: true });

const bySite = new Map();
for (const w of workers ?? []) {
  const sid = w.site_id ?? "_NONE_";
  if (!bySite.has(sid)) bySite.set(sid, []);
  bySite.get(sid).push(w);
}

console.log("\n" + "=".repeat(72));
console.log(`👷 근로자 현장별 리스트 — 전체 ${workers?.length ?? 0}명`);
console.log("=".repeat(72));

const sortedSites = Array.from(bySite.entries()).sort((a, b) => {
  if (a[0] === "_NONE_") return 1;
  if (b[0] === "_NONE_") return -1;
  const aName = siteMap.get(a[0]) ?? "";
  const bName = siteMap.get(b[0]) ?? "";
  return aName.localeCompare(bName);
});

for (const [sid, list] of sortedSites) {
  const name = sid === "_NONE_" ? "⚠️  사이트 미배정" : siteMap.get(sid) ?? `❓ ${sid.slice(0, 8)}…`;
  console.log(`\n📍 ${name} — ${list.length}명`);
  list.forEach((w, i) => {
    const lang = LANG_LABEL[w.preferred_lang] ?? w.preferred_lang ?? "?";
    const phone = w.phone_number ? `📞${w.phone_number.slice(-4)}` : "📞없음";
    const date = w.created_at ? new Date(w.created_at).toLocaleDateString("ko-KR") : "?";
    console.log(`  ${(i + 1).toString().padStart(2)}. ${(w.display_name ?? "?").padEnd(15)} | ${lang.padEnd(8)} | ${phone} | ${date}`);
  });
}

console.log("\n" + "=".repeat(72));
console.log(`📊 요약: 관리자 ${admins?.length ?? 0}명 / 근로자 ${workers?.length ?? 0}명 / 사이트 ${sites?.length ?? 0}개`);
console.log("=".repeat(72));

// 최종 마스터 리스트 — 로그인 정보 포함.
//   관리자: 이메일(ID) + 비번 정책 안내
//   근로자: 이니셜 + 휴대전화 뒷4자리 (로그인 정보 자체)
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ROLE_LABEL = {
  ROOT: "🟣 ROOT",
  SUPER_ADMIN: "🟣 SUPER_ADMIN",
  HQ_ADMIN: "🔵 HQ_ADMIN",
  HQ_OFFICER: "🔵 HQ_OFFICER",
  SAFETY_OFFICER: "🟢 SAFETY_OFFICER",
  SITE_ADMIN: "🟢 SITE_ADMIN",
};

const LANG = {
  ko: "🇰🇷", vi: "🇻🇳", zh: "🇨🇳", th: "🇹🇭", uz: "🇺🇿", ph: "🇵🇭",
  km: "🇰🇭", id: "🇮🇩", mn: "🇲🇳", my: "🇲🇲", ne: "🇳🇵", bn: "🇧🇩",
  kk: "🇰🇿", ru: "🇷🇺", en: "🇺🇸", jp: "🇯🇵", ar: "🇸🇦", hi: "🇮🇳",
};

// auth.users 에서 이메일 가져오기
const { data: authUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? []);

const { data: sites } = await sb.from("sites").select("id, name");
const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));

// ──────────────────────────────────────────────────────────────────
// 관리자 — 등급별 + 이메일(ID)
// ──────────────────────────────────────────────────────────────────
const { data: admins } = await sb
  .from("profiles")
  .select("id, display_name, role, preferred_lang, site_id, title, created_at")
  .neq("role", "WORKER")
  .neq("role", "DEACTIVATED")
  .order("role")
  .order("created_at");

console.log("=".repeat(95));
console.log("🛡️  관리자 등급별 — 로그인 정보 포함 (전체 " + (admins?.length ?? 0) + "명)");
console.log("=".repeat(95));
console.log("🔐 비밀번호 정책: Supabase Auth bcrypt 해시 저장 — 복호화 불가.");
console.log("    분실 시 https://safe-link-v2.vercel.app/auth/reset-password 로 본인 재설정.");
console.log("    또는 SUPER_ADMIN 이 admin reset 후 새 비번 발급 가능.");
console.log("=".repeat(95));

const RANK = { SUPER_ADMIN: 1, ROOT: 2, HQ_ADMIN: 3, HQ_OFFICER: 4, SAFETY_OFFICER: 5, SITE_ADMIN: 6 };
const groupedAdmins = new Map();
for (const a of admins ?? []) {
  const r = (a.role ?? "?").toUpperCase();
  if (!groupedAdmins.has(r)) groupedAdmins.set(r, []);
  groupedAdmins.get(r).push(a);
}
const sortedRoles = Array.from(groupedAdmins.keys()).sort((x, y) => (RANK[x] ?? 50) - (RANK[y] ?? 50));

for (const role of sortedRoles) {
  const list = groupedAdmins.get(role);
  console.log(`\n${ROLE_LABEL[role] ?? "🔸 " + role} — ${list.length}명`);
  list.forEach((a, i) => {
    const email = emailMap.get(a.id) ?? "(이메일 미연결)";
    const lang = LANG[a.preferred_lang] ?? "?";
    const site = a.site_id ? siteMap.get(a.site_id) ?? "?" : "본사";
    const title = a.title ? ` · ${a.title}` : "";
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${(a.display_name ?? "?").padEnd(18)} ${lang} | 📧 ${email.padEnd(35)} | ${site}${title}`
    );
  });
}

// ──────────────────────────────────────────────────────────────────
// 근로자 — 현장별 + 이니셜+last4 (로그인 정보)
// ──────────────────────────────────────────────────────────────────
const { data: nfcAll } = await sb
  .from("nfc_workers")
  .select("name_initials, phone_last4, phone, full_name, assigned_site_id, auth_user_id, preferred_lang, nationality")
  .eq("is_active", true)
  .order("assigned_site_id");

console.log("\n" + "=".repeat(95));
console.log("👷 근로자 현장별 — 로그인 정보 (이니셜 + 휴대전화 뒷4자리) — 전체 " + (nfcAll?.length ?? 0) + "명");
console.log("=".repeat(95));
console.log("🔐 로그인 흐름: https://safe-link-v2.vercel.app/auth → 근로자 → 이니셜 + last4 입력");
console.log("=".repeat(95));

const bySite = new Map();
for (const w of nfcAll ?? []) {
  const sid = w.assigned_site_id ?? "_NONE_";
  if (!bySite.has(sid)) bySite.set(sid, []);
  bySite.get(sid).push(w);
}
for (const [sid, list] of bySite) {
  const name = sid === "_NONE_" ? "⚠️ 미배정" : siteMap.get(sid) ?? `❓ ${sid.slice(0, 8)}…`;
  console.log(`\n📍 ${name} — ${list.length}명`);
  list.forEach((w, i) => {
    const lang = LANG[w.preferred_lang] ?? "?";
    const fullPhone = w.phone ? w.phone : `***-****-${w.phone_last4 ?? "????"}`;
    const auth = w.auth_user_id ? "🔓" : "🔒";
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${auth} 이니셜 ${(w.name_initials ?? "?").padEnd(7)} | last4 ${w.phone_last4 ?? "?"}  ${lang} | 📞 ${fullPhone.padEnd(15)} | ${w.full_name ?? "?"}`
    );
  });
}

console.log("\n" + "=".repeat(95));
console.log(`📊 최종 요약: 관리자 ${admins?.length ?? 0}명 (등급 ${sortedRoles.length}개) / 근로자(NFC 활성) ${nfcAll?.length ?? 0}명`);
console.log("=".repeat(95));

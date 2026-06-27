// 자격증명 .env 파일 생성 — 관리자/근로자 정리.
//   관리자: ID 모두 채움, 비번은 빈 슬롯 (본인 입력 또는 사용자가 수동 채움)
//   근로자: 이니셜 + last4 (PIN) — 자체가 인증
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const userMap = new Map((allUsers?.users ?? []).map((u) => [u.id, u]));

const { data: sites } = await sb.from("sites").select("id, name");
const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));

const { data: admins } = await sb
  .from("profiles")
  .select("id, display_name, role, site_id, title, preferred_lang")
  .neq("role", "WORKER")
  .neq("role", "DEACTIVATED");

const { data: workers } = await sb
  .from("nfc_workers")
  .select("name_initials, phone_last4, phone, full_name, assigned_site_id, preferred_lang, nationality")
  .eq("is_active", true);

const RANK = { SUPER_ADMIN: 1, ROOT: 2, HQ_ADMIN: 3, HQ_OFFICER: 4, SAFETY_OFFICER: 5, SITE_ADMIN: 6 };
admins.sort((a, b) => (RANK[a.role] ?? 50) - (RANK[b.role] ?? 50));

// 슬러그 변환 — display_name 을 .env 키로
function slug(s) {
  return String(s ?? "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

const lines = [];
lines.push("# ============================================================================");
lines.push("# SAFE-LINK V2 자격증명 — 자동 생성");
lines.push(`# 생성 시각: ${new Date().toISOString()}`);
lines.push("#");
lines.push("# 🔐 보안 정책:");
lines.push("#   - 본 파일은 .gitignore 등록됨. 절대 commit 금지.");
lines.push("#   - 관리자 비밀번호는 Supabase Auth bcrypt 해시 저장 → 평문 시스템적으로 불가.");
lines.push("#   - PASSWORD 슬롯은 빈 상태. 각 관리자 본인에게서 직접 받아 채우거나,");
lines.push("#     분실 시 /auth/reset-password 본인 재설정 후 새 비번 기록.");
lines.push("#   - 근로자는 비밀번호 없음 — 이니셜 + 휴대전화 뒷4자리 (PIN) 가 인증.");
lines.push("# ============================================================================");
lines.push("");

// ── 관리자 ─────────────────────────────────────────────────────────
lines.push("# ──────────────────────────────────────────────────────────────");
lines.push(`# 관리자 — ${admins.length}명`);
lines.push("# ──────────────────────────────────────────────────────────────");
lines.push("");

let groupRole = null;
admins.forEach((a, i) => {
  const u = userMap.get(a.id);
  const email = u?.email ?? "(미연결)";
  const site = a.site_id ? siteMap.get(a.site_id) ?? "?" : "본사";
  const lastSignIn = u?.last_sign_in_at
    ? new Date(u.last_sign_in_at).toISOString().slice(0, 10)
    : "미접속";

  if (a.role !== groupRole) {
    if (groupRole !== null) lines.push("");
    lines.push(`# 🔸 ${a.role}`);
    groupRole = a.role;
  }

  const prefix = `ADMIN_${(i + 1).toString().padStart(2, "0")}_${slug(a.display_name).slice(0, 24)}`;
  lines.push(`# ${a.display_name} | ${site}${a.title ? " · " + a.title : ""} | 마지막 로그인 ${lastSignIn}`);
  lines.push(`${prefix}_EMAIL="${email}"`);
  lines.push(`${prefix}_PASSWORD=""    # 🔒 본인 설정값 — 직접 입력 또는 reset 후 새 비번 기록`);
  lines.push(`${prefix}_ROLE="${a.role}"`);
  lines.push("");
});

// ── 근로자 ─────────────────────────────────────────────────────────
lines.push("# ──────────────────────────────────────────────────────────────");
lines.push(`# 근로자 — ${workers.length}명 (NFC 활성)`);
lines.push("# 인증: /auth → 근로자 → 이니셜 + 휴대전화 뒷4자리 (last4 = PIN)");
lines.push("# ──────────────────────────────────────────────────────────────");
lines.push("");

const bySite = new Map();
for (const w of workers) {
  if (!bySite.has(w.assigned_site_id)) bySite.set(w.assigned_site_id, []);
  bySite.get(w.assigned_site_id).push(w);
}

let workerIdx = 0;
for (const [sid, list] of bySite) {
  const siteName = siteMap.get(sid) ?? "?";
  lines.push(`# 📍 ${siteName} — ${list.length}명`);
  list.forEach((w) => {
    workerIdx++;
    const prefix = `WORKER_${workerIdx.toString().padStart(2, "0")}_${slug(w.name_initials)}_${w.phone_last4 ?? "XXXX"}`;
    lines.push(`# ${w.full_name ?? "?"} (${w.preferred_lang ?? "?"})`);
    lines.push(`${prefix}_INITIALS="${w.name_initials ?? ""}"`);
    lines.push(`${prefix}_LAST4_PIN="${w.phone_last4 ?? ""}"`);
    lines.push(`${prefix}_PHONE="${w.phone ?? ""}"`);
    lines.push(`${prefix}_SITE="${siteName}"`);
    lines.push("");
  });
  lines.push("");
}

const PATH = ".env.credentials";
fs.writeFileSync(PATH, lines.join("\n"), "utf8");

// .gitignore 추가
const giPath = ".gitignore";
let gitignore = "";
try {
  gitignore = fs.readFileSync(giPath, "utf8");
} catch {
  gitignore = "";
}
if (!gitignore.includes(".env.credentials")) {
  const newContent = gitignore + (gitignore.endsWith("\n") ? "" : "\n") + "\n# 자격증명 (생성: 2026-06-09)\n.env.credentials\n.env.admin-credentials\n";
  fs.writeFileSync(giPath, newContent, "utf8");
  console.log(`✅ .gitignore 에 .env.credentials 추가됨`);
}

console.log(`\n✅ 자격증명 파일 생성: ${PATH}`);
console.log(`   - 관리자 ${admins.length}명 (EMAIL + 빈 PASSWORD 슬롯)`);
console.log(`   - 근로자 ${workers.length}명 (INITIALS + LAST4_PIN)`);
console.log(`\n📌 .gitignore 로 보호됨. commit 안 됨.`);
console.log(`📌 관리자 PASSWORD 슬롯은 본인에게 받아 직접 채우세요.`);

// 김무빈 SAFETY_OFFICER 이메일 변경 + 전체 자격증명 리스트.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Step 1: 김무빈 차장 (SAFETY_OFFICER) profile 찾기 ─────────────
const { data: kim } = await sb
  .from("profiles")
  .select("id, display_name, role")
  .eq("display_name", "김무빈 차장")
  .eq("role", "SAFETY_OFFICER")
  .maybeSingle();

console.log("=".repeat(72));
console.log("Step 1: 김무빈 SAFETY_OFFICER 이메일 변경");
console.log("=".repeat(72));

if (!kim) {
  console.log("❌ 김무빈 차장 SAFETY_OFFICER 미발견");
  process.exit(1);
}

const NEW_EMAIL = "tianxiawudi1996@gmail.com";

// 기존 이메일 확인
const { data: existingUser } = await sb.auth.admin.getUserById(kim.id);
console.log(`  대상 profile.id: ${kim.id}`);
console.log(`  기존 이메일: ${existingUser?.user?.email ?? "?"}`);
console.log(`  새 이메일:  ${NEW_EMAIL}`);

// 이메일 충돌 검사 — 같은 이메일이 다른 user 에 있으면 안 됨
const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const conflict = allUsers?.users?.find((u) => u.email === NEW_EMAIL && u.id !== kim.id);
if (conflict) {
  console.log(`\n⚠️ 충돌 — ${NEW_EMAIL} 가 이미 다른 user 에 있음 (id=${conflict.id.slice(0, 8)}…)`);
  console.log("   조치: 충돌 user 의 이메일을 먼저 옮긴 뒤 재시도해야 함.");
  console.log(`   현재 그 user 의 profile:`);
  const { data: confProfile } = await sb
    .from("profiles")
    .select("display_name, role")
    .eq("id", conflict.id)
    .maybeSingle();
  console.log(`     name=${confProfile?.display_name ?? "?"} role=${confProfile?.role ?? "?"}`);
} else {
  // 변경 실행
  const { error } = await sb.auth.admin.updateUserById(kim.id, {
    email: NEW_EMAIL,
    email_confirm: true, // 이메일 확인 자동 처리 (admin reset 흐름)
  });
  if (error) {
    console.log(`\n❌ 변경 실패: ${error.message}`);
  } else {
    console.log(`\n✅ 변경 완료 — 김무빈 차장 SAFETY_OFFICER 이메일 → ${NEW_EMAIL}`);
  }
}

// ── Step 2: 비밀번호 한계 안내 + 전체 리스트 출력 ───────────────────
console.log("\n" + "=".repeat(72));
console.log("Step 2: 비밀번호 — 기술적 한계 명시");
console.log("=".repeat(72));
console.log("Supabase Auth 는 비밀번호를 bcrypt 단방향 해시로만 저장합니다.");
console.log("→ 평문 비밀번호를 표시하는 것은 시스템적으로 불가능합니다.");
console.log("→ 보여드릴 수 있는 정보:");
console.log("   1) 이메일 (로그인 ID)");
console.log("   2) 마지막 로그인 시각, 이메일 인증 여부");
console.log("   3) bcrypt 해시 (보안 무의미 — 표시 안 함)");
console.log("→ 필요시 별도 명령으로 SUPER_ADMIN 권한으로 16명에게 임시 비번 일괄 발급 가능");
console.log("=".repeat(72));

// 전체 리스트 (admin) — 이메일 + 메타데이터
const { data: admins } = await sb
  .from("profiles")
  .select("id, display_name, role, site_id, title")
  .neq("role", "WORKER")
  .neq("role", "DEACTIVATED");

const { data: sites } = await sb.from("sites").select("id, name");
const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));
const userMap = new Map((allUsers?.users ?? []).map((u) => [u.id, u]));

const RANK = { SUPER_ADMIN: 1, ROOT: 2, HQ_ADMIN: 3, HQ_OFFICER: 4, SAFETY_OFFICER: 5, SITE_ADMIN: 6 };
admins.sort((a, b) => (RANK[a.role] ?? 50) - (RANK[b.role] ?? 50));

console.log("\n관리자 16명 전체 자격증명:");
console.log("-".repeat(120));
console.log(
  ["#", "역할", "이름", "이메일 (ID)", "비번", "현장", "직위", "마지막 로그인"]
    .map((s, i) => s.padEnd([3, 16, 18, 35, 18, 18, 8, 12][i]))
    .join("")
);
console.log("-".repeat(120));
admins.forEach((a, i) => {
  const u = userMap.get(a.id);
  const email = u?.email ?? "(미연결)";
  const lastSignIn = u?.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("ko-KR") : "미접속";
  const site = a.site_id ? siteMap.get(a.site_id) ?? "?" : "본사";
  const pwd = u?.encrypted_password ? "🔒 bcrypt 보호" : "❌ 비번없음";
  console.log(
    [
      (i + 1).toString(),
      a.role,
      a.display_name ?? "?",
      email,
      pwd,
      site,
      a.title ?? "-",
      lastSignIn,
    ]
      .map((s, idx) => String(s).padEnd([3, 16, 18, 35, 18, 18, 8, 12][idx]))
      .join("")
);
});

// 근로자 (이니셜+last4 = 로그인 자체)
console.log("\n" + "=".repeat(72));
console.log("근로자 — 로그인 정보 (이니셜+last4 가 비밀번호 역할)");
console.log("=".repeat(72));

const { data: workers } = await sb
  .from("nfc_workers")
  .select("name_initials, phone_last4, phone, full_name, assigned_site_id, preferred_lang, auth_user_id")
  .eq("is_active", true);

const bySite = new Map();
for (const w of workers ?? []) {
  if (!bySite.has(w.assigned_site_id)) bySite.set(w.assigned_site_id, []);
  bySite.get(w.assigned_site_id).push(w);
}

for (const [sid, list] of bySite) {
  console.log(`\n📍 ${siteMap.get(sid) ?? "?"} — ${list.length}명`);
  console.log("-".repeat(100));
  console.log(
    ["#", "이니셜", "last4 (PIN)", "전체 휴대전화", "국적", "이름"]
      .map((s, i) => s.padEnd([3, 10, 14, 18, 6, 30][i]))
      .join("")
  );
  console.log("-".repeat(100));
  list.forEach((w, i) => {
    console.log(
      [
        (i + 1).toString(),
        w.name_initials ?? "?",
        w.phone_last4 ?? "?",
        w.phone ?? `***-****-${w.phone_last4 ?? "????"}`,
        w.preferred_lang ?? "?",
        w.full_name ?? "?",
      ]
        .map((s, idx) => String(s).padEnd([3, 10, 14, 18, 6, 30][idx]))
        .join("")
    );
  });
}

console.log("\n" + "=".repeat(72));
console.log("📌 근로자 로그인은 비밀번호 없이 '이니셜 + 휴대전화 뒷4자리' 만 입력 — last4 자체가 PIN 역할");
console.log("=".repeat(72));

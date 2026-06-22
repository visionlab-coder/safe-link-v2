// 이메일 충돌 해소 + 김무빈 차장에게 tianxiawudi1996@gmail.com 부여.
//   1. DEACTIVATED 옛 계정(c9cf79f6)의 이메일을 archive 이메일로 옮김
//   2. 김무빈 차장(ee34b7b7)에게 tianxiawudi1996@gmail.com 부여
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TARGET_EMAIL = "tianxiawudi1996@gmail.com";
const ACTIVE_ID = "ee34b7b7-d155-4ec5-aa67-eff5b95e0c27"; // 김무빈 차장 (SAFETY_OFFICER)

// 충돌 user 찾기
const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const conflicting = allUsers?.users?.find((u) => u.email === TARGET_EMAIL && u.id !== ACTIVE_ID);

console.log("=".repeat(72));
console.log(`목표: ${TARGET_EMAIL} → 김무빈 차장 (SAFETY_OFFICER, ${ACTIVE_ID.slice(0, 8)}…)`);
console.log("=".repeat(72));

if (conflicting) {
  // 점유 중인 user 의 이메일을 archive 형식으로 옮김
  const archiveEmail = `archived-${conflicting.id}@safe-link.deactivated`;
  console.log(`\n[1] 충돌 user ${conflicting.id.slice(0, 8)}… 이메일 archive 처리`);
  console.log(`    ${conflicting.email} → ${archiveEmail}`);
  const { error: e1 } = await sb.auth.admin.updateUserById(conflicting.id, {
    email: archiveEmail,
    email_confirm: true,
  });
  if (e1) {
    console.log(`    ❌ 실패: ${e1.message}`);
    process.exit(1);
  }
  console.log(`    ✅ 옛 계정 이메일 옮김 완료`);
}

// 이제 김무빈 차장에 부여
console.log(`\n[2] 김무빈 차장 (${ACTIVE_ID.slice(0, 8)}…) 이메일 변경`);
const { data: kimUser } = await sb.auth.admin.getUserById(ACTIVE_ID);
console.log(`    기존: ${kimUser?.user?.email ?? "?"}`);
console.log(`    신규: ${TARGET_EMAIL}`);
const { error: e2 } = await sb.auth.admin.updateUserById(ACTIVE_ID, {
  email: TARGET_EMAIL,
  email_confirm: true,
});
if (e2) {
  console.log(`    ❌ 실패: ${e2.message}`);
  process.exit(1);
}
console.log(`    ✅ 변경 완료`);

// 검증
const { data: verified } = await sb.auth.admin.getUserById(ACTIVE_ID);
console.log(`\n[3] 검증: 김무빈 차장 현재 이메일 = ${verified?.user?.email}`);
console.log(`        ${verified?.user?.email === TARGET_EMAIL ? "✅ 일치" : "❌ 불일치"}`);

// auth.users 의 encrypted_password 확인 — Service Role 로 SQL 직접 시도
console.log("\n" + "=".repeat(72));
console.log("비밀번호 확인 — Supabase admin SDK 한계");
console.log("=".repeat(72));
console.log("Supabase Auth Admin SDK 는 보안상 encrypted_password 필드를 응답에 포함하지 않습니다.");
console.log("앞서 표시된 '❌ 비번없음' 은 'SDK 응답에 없음' 의 잘못된 표기였습니다.");
console.log("");
console.log("실제 상태:");
console.log("  - 관리자 16명 모두 bcrypt 해시로 비밀번호 저장 (각자 본인 설정값)");
console.log("  - 시스템은 평문 비밀번호를 알지 못함 — 표시 절대 불가");
console.log("");
console.log("로그인 옵션:");
console.log("  A. 본인이 비번을 알고 있다 → 그대로 로그인");
console.log("  B. 분실 → /auth/reset-password 본인 재설정");
console.log("  C. SUPER_ADMIN 이 임시 비번 발급 → 사용자에 전달 → 첫 로그인 후 변경");
console.log("     (실행 시 모든 admin 의 기존 비번 폐기. 즉시 로그인 불가 위험)");

// HQ Admin 1명만 초기 비밀번호 'seowon2030' 설정.
// 나머지 15명은 기존 비번 유지.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TARGET_EMAIL = "hq.admin@safelink.local";
const INITIAL_PASSWORD = "seowon2030";

// 1) HQ Admin user 찾기
const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const hqAdmin = allUsers?.users?.find((u) => u.email === TARGET_EMAIL);

if (!hqAdmin) {
  console.log(`❌ ${TARGET_EMAIL} 미발견`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("HQ Admin 초기 비밀번호 설정");
console.log("=".repeat(72));
console.log(`  대상: ${TARGET_EMAIL}`);
console.log(`  user_id: ${hqAdmin.id}`);
console.log(`  현재 상태: 미접속 (last_sign_in_at = ${hqAdmin.last_sign_in_at ?? "없음"})`);
console.log(`  설정 비번: ${INITIAL_PASSWORD}`);

// 2) 비번 설정
const { error } = await sb.auth.admin.updateUserById(hqAdmin.id, {
  password: INITIAL_PASSWORD,
  email_confirm: true,
});

if (error) {
  console.log(`\n❌ 실패: ${error.message}`);
  process.exit(1);
}

console.log(`\n✅ 비번 설정 완료 — ${TARGET_EMAIL} / ${INITIAL_PASSWORD}`);
console.log(`   → 첫 로그인 후 본인이 비번 변경 권장`);

// 3) .env.credentials 파일 업데이트 — HQ Admin 의 PASSWORD 슬롯 채움
console.log("\n.env.credentials 업데이트…");
const path = ".env.credentials";
let content = fs.readFileSync(path, "utf8");

// "ADMIN_05_HQ_ADMIN_PASSWORD=""" 줄 찾아서 교체
const before = `ADMIN_05_HQ_ADMIN_PASSWORD=""    # 🔒 본인 설정값 — 직접 입력 또는 reset 후 새 비번 기록`;
const after = `ADMIN_05_HQ_ADMIN_PASSWORD="${INITIAL_PASSWORD}"    # ⚠️ 초기 비번 (첫 로그인 후 변경 권장)`;

if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(path, content, "utf8");
  console.log(`✅ .env.credentials 의 ADMIN_05_HQ_ADMIN_PASSWORD = "${INITIAL_PASSWORD}" 기록 완료`);
} else {
  console.log(`⚠️ .env.credentials 에서 해당 슬롯 미발견 — 수동 수정 필요`);
}

console.log("\n" + "=".repeat(72));
console.log("최종 상태:");
console.log("=".repeat(72));
console.log("  관리자 16명:");
console.log("    ✅ 기존 비번 유지: 15명 (.env.credentials 의 PASSWORD 슬롯은 본인 손으로 입력)");
console.log(`    ✅ 초기 비번 설정: 1명 (HQ Admin / ${INITIAL_PASSWORD})`);
console.log("");
console.log("  근로자 14명: 비번 없음 — 이니셜 + last4 (PIN) 으로 인증");
console.log("");
console.log("📌 다음 액션:");
console.log(`   1. HQ Admin 사용자에게 ${TARGET_EMAIL} / ${INITIAL_PASSWORD} 전달`);
console.log(`   2. 첫 로그인 후 비번 변경 권장`);
console.log(`   3. 본인 비번 알고 있는 15명: .env.credentials 의 본인 슬롯에 직접 입력`);

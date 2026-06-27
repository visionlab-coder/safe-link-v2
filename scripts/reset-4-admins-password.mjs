// 4명 관리자 비밀번호 일괄 'seowon2030' 으로 변경 + .env.credentials 업데이트.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const NEW_PASSWORD = "seowon2030";

const TARGETS = [
  { email: "visionlab@seowonenc.co.kr", label: "ROOT 김무빈 (본인)" },
  { email: "wubinkim@gmail.com", label: "Test Safety Manager" },
  { email: "test-poc-admin@safe-link.local", label: "POC Test Admin" },
  { email: "training-admin@safe-link.local", label: "교육용 관리자" },
];

console.log("=".repeat(72));
console.log(`4명 관리자 비밀번호 일괄 'seowon2030' 변경`);
console.log("=".repeat(72));

const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const userMap = new Map(allUsers?.users?.map((u) => [u.email, u]) ?? []);

const results = [];
for (const t of TARGETS) {
  const u = userMap.get(t.email);
  if (!u) {
    console.log(`❌ ${t.label} (${t.email}) — 미발견`);
    results.push({ ...t, status: "NOT_FOUND" });
    continue;
  }

  const { error } = await sb.auth.admin.updateUserById(u.id, {
    password: NEW_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    console.log(`❌ ${t.label} (${t.email}) — ${error.message}`);
    results.push({ ...t, status: "ERROR", error: error.message });
  } else {
    console.log(`✅ ${t.label} (${t.email}) — 비번 변경 완료`);
    results.push({ ...t, status: "OK", user_id: u.id });
  }
}

// .env.credentials 업데이트 — 4명의 PASSWORD 슬롯 채움
console.log("\n.env.credentials 업데이트…");
const path = ".env.credentials";
let content = fs.readFileSync(path, "utf8");

// 매핑: 이메일 → .env 변수 prefix
const ENV_PREFIX_BY_EMAIL = {
  "visionlab@seowonenc.co.kr": "ADMIN_04_김무빈",
  "wubinkim@gmail.com": "ADMIN_10_Test_Safety_Manager",
  "test-poc-admin@safe-link.local": "ADMIN_15_POC_Test_Admin",
  "training-admin@safe-link.local": "ADMIN_13_교육용_관리자",
};

let updates = 0;
for (const t of results.filter((r) => r.status === "OK")) {
  const prefix = ENV_PREFIX_BY_EMAIL[t.email];
  if (!prefix) {
    console.log(`⚠️  ${t.email} — .env prefix 매핑 없음 — 수동 확인 필요`);
    continue;
  }

  // 빈 PASSWORD 슬롯 정규식으로 매칭 (prefix_PASSWORD="" 다음 주석 줄까지)
  const pattern = new RegExp(`(${prefix}_PASSWORD=)"[^"]*"(\\s*#[^\\n]*)?`, "u");
  const replacement = `$1"${NEW_PASSWORD}"    # ⚠️ 일괄 변경 (첫 로그인 후 변경 권장)`;
  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    console.log(`✅ ${prefix}_PASSWORD = "${NEW_PASSWORD}" 기록`);
    updates++;
  } else {
    console.log(`⚠️  ${prefix} 슬롯 미발견 (정규식 미매칭)`);
  }
}

fs.writeFileSync(path, content, "utf8");

console.log("\n" + "=".repeat(72));
console.log("최종 상태");
console.log("=".repeat(72));
console.log(`  변경 완료: ${results.filter((r) => r.status === "OK").length}명`);
console.log(`  실패:     ${results.filter((r) => r.status !== "OK").length}명`);
console.log(`  .env.credentials 업데이트: ${updates}건`);
console.log("");
console.log("📌 다음 액션:");
console.log("  1. 본인(visionlab) 즉시 https://safe-link-v2.vercel.app/auth 에서");
console.log(`     visionlab@seowonenc.co.kr / ${NEW_PASSWORD} 로 로그인 가능`);
console.log("  2. Test Safety Manager, POC Test Admin, 교육용 관리자에게 새 비번 전달");
console.log("  3. 각자 첫 로그인 후 비번 변경 권장");

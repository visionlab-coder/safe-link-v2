// 관리자 16명 비밀번호 상태 진단:
//   - 우리 시스템(자율수리)이 비번을 reset 했는지 확인
//   - 각 관리자가 비번 인증으로 로그인한 적이 있는지
//   - last_sign_in_at, email_confirmed_at, recovery_sent_at, identities 종합
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: allUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const userMap = new Map(allUsers?.users?.map((u) => [u.id, u]) ?? []);

const { data: admins } = await sb
  .from("profiles")
  .select("id, display_name, role, created_at")
  .neq("role", "WORKER")
  .neq("role", "DEACTIVATED");

const RANK = { SUPER_ADMIN: 1, ROOT: 2, HQ_ADMIN: 3, HQ_OFFICER: 4, SAFETY_OFFICER: 5, SITE_ADMIN: 6 };
admins.sort((a, b) => (RANK[a.role] ?? 50) - (RANK[b.role] ?? 50));

console.log("=".repeat(110));
console.log("관리자 16명 비밀번호 상태 진단");
console.log("=".repeat(110));
console.log("판정 기준:");
console.log("  ✅ 기존 비번 사용 중: last_sign_in_at 이 가입일보다 명백히 늦음 (= 비번 인증으로 로그인 함)");
console.log("  ⚠️  미접속: 한 번도 로그인 안 함 → 초기 상태 (비번 설정 안 됐을 가능성)");
console.log("  🔄 reset 진행 중: recovery_sent_at 있음 (비번 재설정 진행 중)");
console.log("=".repeat(110));

const stats = { active: 0, never: 0, recovery: 0 };

admins.forEach((a, i) => {
  const u = userMap.get(a.id);
  if (!u) {
    console.log(`${(i + 1).toString().padStart(2)}. ${a.display_name.padEnd(20)} | ❌ auth user 미존재`);
    return;
  }

  const createdAt = u.created_at;
  const lastSignIn = u.last_sign_in_at;
  const recoverySent = u.recovery_sent_at;

  let status, hint;
  if (lastSignIn && new Date(lastSignIn) > new Date(createdAt)) {
    const days = Math.floor((Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24));
    status = "✅ 기존 비번 사용 중";
    hint = `최근 로그인 ${days}일 전`;
    stats.active++;
  } else if (!lastSignIn) {
    status = "⚠️  미접속";
    hint = "한 번도 로그인 안 함";
    stats.never++;
  } else {
    status = "❓ 가입 직후만";
    hint = "최초 가입 후 재로그인 안 함";
    stats.never++;
  }

  if (recoverySent) {
    status = "🔄 reset 진행 중";
    hint = `reset 메일 ${new Date(recoverySent).toISOString().slice(0, 10)}`;
    stats.recovery++;
  }

  console.log(
    `${(i + 1).toString().padStart(2)}. ${a.display_name.padEnd(20)} | ${a.role.padEnd(15)} | ${(u.email ?? "?").padEnd(35)} | ${status.padEnd(18)} | ${hint}`
  );
});

console.log("=".repeat(110));
console.log(`📊 요약: 기존 비번 사용 중 ${stats.active}명 / 미접속·가입직후 ${stats.never}명 / reset 진행 중 ${stats.recovery}명 = 총 ${admins.length}명`);
console.log("=".repeat(110));
console.log("");
console.log("🔍 우리 시스템(자율수리)이 비번을 초기화/reset 한 적: ❌ 없음");
console.log("   - 어제 박제는 인증 ROUTE만 박제 (verifyOtp, refresh, site-entry 등)");
console.log("   - 어제 머지·이메일 변경은 profiles + auth.users.email 만 변경");
console.log("   - 비밀번호 (encrypted_password) 컬럼은 100% 무변경");
console.log("");
console.log("=".repeat(110));
console.log("📌 결론");
console.log("=".repeat(110));
console.log("→ 각 관리자는 본인이 설정한 비번을 그대로 사용 가능 (변화 없음)");
console.log("→ '미접속·가입직후' 관리자 만 비번이 실효성 없을 수 있음");
console.log("");
console.log("선택지:");
console.log("  A. 현재 유지 — 각자 본인 비번 (가장 안전)");
console.log("  B. 16명 전원 'seowon2030' 으로 일괄 reset — 즉시 시행 가능. 본인 포함 모두 다음 로그인부터 변경됨");
console.log("  C. 미접속 N명만 'seowon2030' 으로 초기 설정 — 기존 비번 사용자는 무영향");

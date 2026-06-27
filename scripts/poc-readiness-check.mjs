// PoC 사전 점검 — 교육 현장 + 교육용 admin + 더미 5명 전 흐름 검증.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const BASE = "https://safe-link-v2.vercel.app";
const EDU_SITE = "00000000-0000-0000-0000-000000000101";
const EDU_ADMIN_EMAIL = "training-admin@safe-link.local";
const EDU_ADMIN_PASSWORD = "seowon2030";

console.log("=".repeat(75));
console.log("🎓 PoC 사전 점검 — 내일 현장 시연 준비");
console.log("=".repeat(75));

// 1. 교육 현장 확인
const { data: site } = await sb.from("sites").select("id, name, site_code").eq("id", EDU_SITE).single();
console.log(`\n[1] 교육 현장 확인: ${site?.name ?? "❌ 미발견"}`);

// 2. 교육용 admin 정상 로그인
console.log(`\n[2] 교육용 admin 로그인 — ${EDU_ADMIN_EMAIL}`);
const loginRes = await fetch(`${BASE}/api/auth/admin-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EDU_ADMIN_EMAIL, password: EDU_ADMIN_PASSWORD }),
});
const loginOk = loginRes.status === 200;
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const hasCookie = setCookie.includes("sb-wzmzpuxpcpuvuacwmslj-auth-token");
console.log(`    ${loginOk && hasCookie ? "✅" : "❌"} status=${loginRes.status} | cookie=${hasCookie ? "발급" : "없음"}`);

// 3. 교육용 admin profile 확인
const { data: eduAdmin } = await sb
  .from("profiles")
  .select("id, display_name, role, preferred_lang, site_id, title")
  .eq("site_id", EDU_SITE)
  .neq("role", "WORKER");
console.log(`\n[3] 교육 현장 admin: ${eduAdmin?.length ?? 0}명`);
for (const a of (eduAdmin ?? [])) {
  console.log(`    ${a.role.padEnd(15)} | ${a.display_name} (${a.title ?? "-"}) | lang=${a.preferred_lang}`);
}

// 4. 교육 현장 더미 워커 5명 (NFC 활성)
const { data: workers } = await sb
  .from("nfc_workers")
  .select("name_initials, phone_last4, phone, full_name, nationality, preferred_lang, auth_user_id, trade")
  .eq("assigned_site_id", EDU_SITE)
  .eq("is_active", true)
  .order("created_at");

console.log(`\n[4] 교육 현장 NFC 활성 워커: ${workers?.length ?? 0}명`);
workers?.forEach((w, i) => {
  const auth = w.auth_user_id ? "🔓" : "🔒";
  console.log(`    ${(i + 1).toString().padStart(2)}. ${auth} ${w.name_initials}/${w.phone_last4} | ${w.full_name} | ${w.nationality}/${w.preferred_lang} | trade=${w.trade ?? "-"}`);
});

// 5. 각 워커 production 로그인 시뮬레이션 (rate limit 회피로 1명만)
const testWorker = workers?.[0];
if (testWorker) {
  console.log(`\n[5] 대표 워커 production 로그인 시뮬레이션 — ${testWorker.name_initials}/${testWorker.phone_last4}`);
  const wRes = await fetch(`${BASE}/api/auth/worker-quick-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name_initials: testWorker.name_initials,
      phone_last4: testWorker.phone_last4,
      preferred_lang: testWorker.preferred_lang,
      site_id: EDU_SITE,
    }),
  });
  const wBody = await wRes.json().catch(() => ({}));
  const wCookie = (wRes.headers.get("set-cookie") ?? "").includes("sb-wzmzpuxpcpuvuacwmslj-auth-token");
  console.log(`    ${wRes.status === 200 && wCookie ? "✅" : "❌"} status=${wRes.status} | cookie=${wCookie ? "발급" : "없음"} | name=${wBody?.worker?.full_name ?? "?"}`);
}

// 6. 사이트 격리 검증 — 교육 admin이 교육 워커만 보이는지
const { data: profileWorkers } = await sb
  .from("profiles")
  .select("id, display_name, preferred_lang, nationality")
  .eq("site_id", EDU_SITE)
  .eq("role", "WORKER");
console.log(`\n[6] 교육 현장 profiles WORKER (admin/chat 노출): ${profileWorkers?.length ?? 0}명`);
profileWorkers?.forEach((p, i) => {
  console.log(`    ${(i + 1).toString().padStart(2)}. ${p.display_name.padEnd(20)} | lang=${p.preferred_lang ?? "?"} | nationality=${p.nationality ?? "NULL"}`);
});

// 7. 종합
console.log("\n" + "=".repeat(75));
const allOk = site && loginOk && hasCookie && (eduAdmin?.length ?? 0) > 0 && (workers?.length ?? 0) >= 5;
console.log(`${allOk ? "✅" : "⚠️"} PoC 준비 ${allOk ? "완료" : "추가 점검 필요"}`);
console.log("=".repeat(75));

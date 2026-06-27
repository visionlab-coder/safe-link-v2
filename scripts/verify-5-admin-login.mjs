// 5명 관리자 (HQ Admin 기존 + 신규 4명) 모두 seowon2030 으로 production 로그인 검증.
const BASE = "https://safe-link-v2.vercel.app";
const PASSWORD = "seowon2030";

const TARGETS = [
  { email: "hq.admin@safelink.local", label: "HQ Admin (어제 설정)" },
  { email: "visionlab@seowonenc.co.kr", label: "ROOT 김무빈 (본인)" },
  { email: "wubinkim@gmail.com", label: "Test Safety Manager" },
  { email: "test-poc-admin@safe-link.local", label: "POC Test Admin" },
  { email: "training-admin@safe-link.local", label: "교육용 관리자" },
];

console.log("=".repeat(80));
console.log(`5명 관리자 seowon2030 로 production 로그인 검증`);
console.log("=".repeat(80));

let pass = 0;
let fail = 0;
for (const t of TARGETS) {
  const res = await fetch(`${BASE}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: t.email, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie") ?? "";
  const hasCookie = setCookie.includes("sb-wzmzpuxpcpuvuacwmslj-auth-token");
  const ok = res.status === 200 && body?.ok === true && hasCookie;
  console.log(
    `${ok ? "✅" : "❌"} ${t.label.padEnd(28)} | ${t.email.padEnd(38)} | status=${res.status} | cookie=${hasCookie ? "발급" : "없음"}`
  );
  if (ok) pass++;
  else fail++;
}

console.log("\n" + "=".repeat(80));
console.log(`종합: ${pass}/${TARGETS.length} 통과`);
console.log("=".repeat(80));

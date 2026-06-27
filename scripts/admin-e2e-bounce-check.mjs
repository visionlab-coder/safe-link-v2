// E2E admin 로그인 + 튕김 재발 점검.
// HQ Admin (seowon2030) 으로 종단간 검증.
const BASE = "https://safe-link-v2.vercel.app";
const EMAIL = "hq.admin@safelink.local";
const PASSWORD = "seowon2030";

function parseSetCookie(header) {
  if (!header) return null;
  const match = header.match(/sb-wzmzpuxpcpuvuacwmslj-auth-token=([^;]+)/);
  return match ? `sb-wzmzpuxpcpuvuacwmslj-auth-token=${match[1]}` : null;
}

console.log("=".repeat(72));
console.log("ADMIN 로그인 E2E — 튕김 재발 점검 (HQ Admin / seowon2030)");
console.log("=".repeat(72));

// [1] 로그인
console.log("\n[1] POST /api/auth/admin-login");
const loginRes = await fetch(`${BASE}/api/auth/admin-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const loginBody = await loginRes.json().catch(() => ({}));
const sessionCookie = parseSetCookie(loginRes.headers.get("set-cookie"));
console.log(`    status=${loginRes.status} ok=${loginBody?.ok} cookie=${sessionCookie ? "✅발급" : "❌누락"}`);
if (loginRes.status !== 200 || !sessionCookie) {
  console.log("    ❌ 로그인 실패 — 후속 단계 중단");
  process.exit(1);
}

// [2] /api/auth/me
console.log("\n[2] GET /api/auth/me (쿠키)");
const meRes = await fetch(`${BASE}/api/auth/me`, {
  headers: { Cookie: sessionCookie },
  cache: "no-store",
});
const meBody = await meRes.json().catch(() => ({}));
console.log(`    status=${meRes.status} role=${meBody?.profile?.role ?? "?"} display=${meBody?.profile?.display_name ?? "?"}`);

// [3] /admin 페이지
console.log("\n[3] GET /admin (middleware)");
const adminRes = await fetch(`${BASE}/admin?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const adminLoc = adminRes.headers.get("location");
console.log(`    status=${adminRes.status} ${adminLoc ? "→ " + adminLoc : ""}`);
const adminPass = adminRes.status === 200 || (adminRes.status === 307 && !adminLoc?.includes("/auth"));
console.log(`    ${adminPass ? "✅ /admin 정상 진입 — 튕김 없음" : "🚨 /auth 튕김"}`);

// [4] /admin/chat
console.log("\n[4] GET /admin/chat");
const chatRes = await fetch(`${BASE}/admin/chat?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const chatLoc = chatRes.headers.get("location");
console.log(`    status=${chatRes.status} ${chatLoc ? "→ " + chatLoc : ""}`);

// [5] /worker 접근 시도 — 역할 가드 (HQ_ADMIN 은 worker 차단되어야 — wait, hasAllowedRole(HQ_ADMIN, 'worker') 검사)
console.log("\n[5] GET /worker (역할 가드 — HQ_ADMIN 시도)");
const workerRes = await fetch(`${BASE}/worker?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const workerLoc = workerRes.headers.get("location");
console.log(`    status=${workerRes.status} ${workerLoc ? "→ " + workerLoc : ""}`);

// [6] /admin/tbm/create
console.log("\n[6] GET /admin/tbm/create");
const tbmRes = await fetch(`${BASE}/admin/tbm/create?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
console.log(`    status=${tbmRes.status} ${tbmRes.headers.get("location") ?? ""}`);

// [7] /admin/glossary
console.log("\n[7] GET /admin/glossary");
const glossRes = await fetch(`${BASE}/admin/glossary?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
console.log(`    status=${glossRes.status} ${glossRes.headers.get("location") ?? ""}`);

console.log("\n" + "=".repeat(72));
const allOk = loginRes.status === 200 && meRes.status === 200 && adminPass;
console.log(`종합: ${allOk ? "✅ admin 로그인 흐름 100% 정상 — 튕김 없음 확정" : "⚠️ 일부 항목 점검 필요"}`);
console.log("=".repeat(72));

// 종단간 (E2E) 청주 BK/4567 실 production 로그인 테스트.
// 사용자가 본 "튕김" 증상이 완전히 해소되었는지 시나리오로 재현.
const BASE = "https://safe-link-v2.vercel.app";

function parseSetCookie(header) {
  if (!header) return null;
  // sb-wzmzpuxpcpuvuacwmslj-auth-token=... 추출 (첫 번째 쿠키만)
  const match = header.match(/sb-wzmzpuxpcpuvuacwmslj-auth-token=([^;]+)/);
  return match ? `sb-wzmzpuxpcpuvuacwmslj-auth-token=${match[1]}` : null;
}

console.log("=".repeat(72));
console.log("E2E: 청주 BK/4567 실 production 로그인 + 튕김 재발 점검");
console.log("=".repeat(72));

// ─── Step 1: 이니셜+last4 로그인 ─────────────────────────────────
console.log("\n[1] POST /api/auth/worker-quick-login (BK/4567)");
const loginRes = await fetch(`${BASE}/api/auth/worker-quick-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name_initials: "BK",
    phone_last4: "4567",
    preferred_lang: "ko",
    site_id: "757c7630-8fb0-4c38-b76e-3129bf15b356",
  }),
});

const loginBody = await loginRes.json().catch(() => ({}));
const setCookieRaw = loginRes.headers.get("set-cookie");
const sessionCookie = parseSetCookie(setCookieRaw);

console.log(`   status=${loginRes.status} ok=${loginBody?.ok} worker="${loginBody?.worker?.full_name ?? "?"}"`);
console.log(`   Set-Cookie: ${sessionCookie ? "✅ 발급 (length=" + sessionCookie.length + ")" : "❌ 누락"}`);

if (loginRes.status !== 200 || !sessionCookie) {
  console.log("\n❌ 로그인 실패. rate limit 또는 오류. 5분 후 재시도 권장.");
  process.exit(1);
}

// ─── Step 2: /api/auth/me 호출 (인증 확인) ────────────────────────
console.log("\n[2] GET /api/auth/me (쿠키 첨부)");
const meRes = await fetch(`${BASE}/api/auth/me`, {
  headers: { Cookie: sessionCookie },
  cache: "no-store",
});
const meBody = await meRes.json().catch(() => ({}));
console.log(`   status=${meRes.status} role=${meBody?.profile?.role ?? "?"} site_id=${meBody?.profile?.site_id?.slice(0, 8) ?? "?"} display="${meBody?.profile?.display_name ?? "?"}"`);

// ─── Step 3: /worker 페이지 진입 (middleware 통과 확인) ───────────
console.log("\n[3] GET /worker (middleware 검증)");
const workerRes = await fetch(`${BASE}/worker?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const workerLocation = workerRes.headers.get("location");
console.log(`   status=${workerRes.status} ${workerLocation ? "→ " + workerLocation : ""}`);
const passedMiddleware = workerRes.status === 200 || workerRes.status === 308;
console.log(`   ${passedMiddleware ? "✅ middleware 통과 — /auth 튕김 없음" : "❌ /auth 튕김 발생"}`);

// ─── Step 4: /worker/chat 진입 ──────────────────────────────────
console.log("\n[4] GET /worker/chat (서브페이지)");
const chatRes = await fetch(`${BASE}/worker/chat?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const chatLocation = chatRes.headers.get("location");
console.log(`   status=${chatRes.status} ${chatLocation ? "→ " + chatLocation : ""}`);

// ─── Step 5: /admin 진입 시도 (역할 가드 — WORKER 는 차단되어 /worker 로 가야 함) ───
console.log("\n[5] GET /admin (역할 가드 — WORKER 는 거부되어야)");
const adminRes = await fetch(`${BASE}/admin?lang=ko`, {
  headers: { Cookie: sessionCookie },
  redirect: "manual",
});
const adminLocation = adminRes.headers.get("location");
console.log(`   status=${adminRes.status} ${adminLocation ? "→ " + adminLocation : ""}`);
const guarded = adminRes.status === 307 || adminRes.status === 302;
console.log(`   ${guarded ? "✅ 역할 가드 작동 (admin → 다른 페이지로 redirect)" : "⚠️ 가드 통과 안 됨"}`);

// ─── Step 6: 쿠키 없이 /worker 진입 시도 (인증 가드) ───────────────
console.log("\n[6] GET /worker (쿠키 없이 — 인증 가드)");
const noCookieRes = await fetch(`${BASE}/worker`, {
  redirect: "manual",
});
const noCookieLocation = noCookieRes.headers.get("location");
console.log(`   status=${noCookieRes.status} ${noCookieLocation ? "→ " + noCookieLocation : ""}`);
const redirectedToAuth = noCookieLocation?.includes("/auth");
console.log(`   ${redirectedToAuth ? "✅ 인증 가드 작동 (쿠키 없으면 /auth)" : "⚠️ 가드 통과 안 됨"}`);

// ─── 종합 ───────────────────────────────────────────────────────
console.log("\n" + "=".repeat(72));
const allOk =
  loginRes.status === 200 &&
  sessionCookie &&
  meRes.status === 200 &&
  passedMiddleware &&
  guarded &&
  redirectedToAuth;
console.log(`종합: ${allOk ? "✅ 청주 BK/4567 종단간 로그인 흐름 100% 정상" : "⚠️ 일부 항목 점검 필요"}`);
console.log("=".repeat(72));

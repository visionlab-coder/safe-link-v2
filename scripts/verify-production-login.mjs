// 실 production 로그인 검증 — vercel.app 직접 호출.
//   1. 청주 5명 + 과천 3명 이니셜+last4 로그인
//   2. /api/auth/me refresh 흐름 확인
//   3. /api/qr/site-entry P5/P7 박제 확인
//   4. /api/auth/admin-login 정상 동작 확인 (필요 시 cred 제공)
const BASE = "https://safe-link-v2.vercel.app";

const CHEONGJU_SITE = "757c7630-8fb0-4c38-b76e-3129bf15b356";
const GWACHEON_SITE = "38e35a02-d470-41ae-a169-82ba5bae4a5c";

const WORKERS = [
  { initials: "BK", last4: "4567", site: CHEONGJU_SITE, name: "BK (청주)" },
  { initials: "XS", last4: "5566", site: CHEONGJU_SITE, name: "XS (청주)" },
  { initials: "QW", last4: "1234", site: CHEONGJU_SITE, name: "QW (청주)" },
  { initials: "DY", last4: "2244", site: CHEONGJU_SITE, name: "DY (청주)" },
  { initials: "CHEN", last4: "0003", site: CHEONGJU_SITE, name: "CHEN (청주)" },
  { initials: "LIG", last4: "1670", site: GWACHEON_SITE, name: "LIG/1670 (과천)" },
  { initials: "LIG", last4: "1640", site: GWACHEON_SITE, name: "LIG/1640 (과천)" },
  { initials: "LIGG", last4: "1640", site: GWACHEON_SITE, name: "LIGG/1640 (과천)" },
];

console.log("=".repeat(72));
console.log(`실 PRODUCTION 로그인 검증 — ${BASE}`);
console.log("=".repeat(72));

let pass = 0;
let fail = 0;

for (const w of WORKERS) {
  const res = await fetch(`${BASE}/api/auth/worker-quick-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name_initials: w.initials,
      phone_last4: w.last4,
      preferred_lang: "ko",
      site_id: w.site, // 사이트 명시 — 복수 매칭 방지
    }),
  });

  const setCookie = res.headers.get("set-cookie") ?? "";
  const hasSessionCookie = setCookie.includes("sb-wzmzpuxpcpuvuacwmslj-auth-token");
  const body = await res.json().catch(() => ({}));

  const ok = res.status === 200 && body?.ok === true && hasSessionCookie;

  console.log(
    `${ok ? "✅" : "❌"} ${w.name.padEnd(20)} | status=${res.status} | cookie=${hasSessionCookie ? "set" : "없음"} | worker=${body?.worker?.full_name ?? body?.error ?? "?"}`
  );

  if (ok) pass++;
  else fail++;
}

console.log("\n" + "=".repeat(72));
console.log(`최종: ${pass}명 통과 / ${fail}명 실패 / ${WORKERS.length}명 시도`);
console.log("=".repeat(72));

// 추가 검증: 빈 body / 잘못된 입력 — 가드 동작
console.log("\n[보안 검증 — Red팀 시나리오]");

const redteam = [
  { name: "빈 body", body: {} },
  { name: "이니셜만", body: { name_initials: "BK" } },
  { name: "last4만", body: { phone_last4: "4567" } },
  { name: "존재하지 않는 워커", body: { name_initials: "XXX", phone_last4: "9999" } },
  { name: "특수문자 인젝션", body: { name_initials: "BK';DROP", phone_last4: "4567" } },
];

for (const t of redteam) {
  const res = await fetch(`${BASE}/api/auth/worker-quick-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t.body),
  });
  const body = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie") ?? "";
  const noCookie = !setCookie.includes("sb-wzmzpuxpcpuvuacwmslj-auth-token");
  const safe = res.status >= 400 && noCookie;
  console.log(
    `${safe ? "✅" : "🚨"} ${t.name.padEnd(25)} | status=${res.status} | cookie=${noCookie ? "없음(안전)" : "발급(위험)"} | err=${body?.error ?? "?"}`
  );
}

console.log("\n[/api/auth/me 가드 동작]");
const meNoCookie = await fetch(`${BASE}/api/auth/me`);
const meBody = await meNoCookie.json().catch(() => ({}));
console.log(
  `${meNoCookie.status === 401 ? "✅" : "🚨"} 쿠키 없이 /me 호출 → status=${meNoCookie.status} error=${meBody?.error ?? "?"}`
);

console.log("\n[/api/qr/site-entry mode=info 동작]");
const siteInfo = await fetch(`${BASE}/api/qr/site-entry`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ site_id: CHEONGJU_SITE, mode: "info" }),
});
const siteBody = await siteInfo.json().catch(() => ({}));
console.log(
  `${siteInfo.status === 200 && siteBody?.ok ? "✅" : "🚨"} site info → status=${siteInfo.status} name=${siteBody?.site?.name ?? "?"}`
);

console.log("\n" + "=".repeat(72));

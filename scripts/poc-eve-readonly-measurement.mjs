// 🔒 PoC 직전 측정 — 코드 변경 0건. 5가지 기능 현재 응답시간만 기록.
// 회귀 방지 최우선. 모든 호출은 read-only.
const BASE = "https://safe-link-v2.vercel.app";

function parseCookie(h) {
  const m = (h ?? "").match(/sb-wzmzpuxpcpuvuacwmslj-auth-token=([^;]+)/);
  return m ? `sb-wzmzpuxpcpuvuacwmslj-auth-token=${m[1]}` : null;
}

async function timeIt(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    return { name, ms, ok: r.ok ?? true, status: r.status, body: r.body };
  } catch (e) {
    return { name, ms: Date.now() - t0, ok: false, error: String(e) };
  }
}

console.log("=".repeat(78));
console.log("🔒 PoC 사전 측정 (코드 변경 0건, read-only)");
console.log("=".repeat(78));

// admin 로그인 (HQ Admin / seowon2030)
console.log("\n[0] admin 로그인 — cookie 획득");
const login = await fetch(`${BASE}/api/auth/admin-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hq.admin@safelink.local", password: "seowon2030" }),
});
const cookie = parseCookie(login.headers.get("set-cookie"));
console.log(`    status=${login.status} cookie=${cookie ? "✅" : "❌"}`);
if (!cookie) { console.log("로그인 실패 — 중단"); process.exit(1); }

// ─── 1. /api/check 헬스 7개 서비스 ──────────────────────────────────
console.log("\n[1] /api/check — 7개 서비스 헬스");
const check = await timeIt("api/check", async () => {
  const r = await fetch(`${BASE}/api/check`, { headers: { Cookie: cookie } });
  const b = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: b };
});
console.log(`    ${check.ms}ms / status=${check.status}`);
if (check.body) {
  for (const [k, v] of Object.entries(check.body)) {
    if (typeof v === "object" && v !== null) {
      const icon = v.ok || v.status === "ok" ? "✅" : "❌";
      console.log(`        ${icon} ${k}: ${JSON.stringify(v).slice(0, 80)}`);
    }
  }
}

// ─── 2. 번역 — TBM 모드 (fast=false) + live 모드 (fast=true) ────────
console.log("\n[2] /api/translate — 번역 응답시간");

const tbmTexts = [
  { sl: "ko", tl: "vi", text: "안전모 착용하고 작업하세요" },
  { sl: "ko", tl: "zh", text: "오늘 작업장 추락 위험 있습니다 조심하세요" },
  { sl: "ko", tl: "th", text: "철근 작업 시 안전벨트 반드시 착용" },
  { sl: "ko", tl: "en", text: "위험성평가에 따라 보호구를 착용하시오" },
];

console.log("\n  ── TBM 모드 (Papago/Gemini, 발음+역번역 포함) ──");
for (const t of tbmTexts) {
  const r = await timeIt(`tbm-${t.tl}`, async () => {
    const x = await fetch(`${BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ ...t, useGlossary: true }),
    });
    const b = await x.json().catch(() => ({}));
    return { ok: x.ok, status: x.status, body: b };
  });
  const engine = r.body?.engine ?? "?";
  const translated = r.body?.translated?.slice(0, 30) ?? "?";
  console.log(`    ${t.tl}: ${r.ms.toString().padStart(5)}ms | engine=${engine.padEnd(7)} | "${translated}..."`);
}

console.log("\n  ── 실시간 통역 모드 (fast=true, 발음 스킵) ──");
for (const t of tbmTexts.slice(0, 2)) {
  const r = await timeIt(`fast-${t.tl}`, async () => {
    const x = await fetch(`${BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ ...t, fast: true, pronunciation: false }),
    });
    const b = await x.json().catch(() => ({}));
    return { ok: x.ok, status: x.status, body: b };
  });
  console.log(`    ${t.tl}: ${r.ms.toString().padStart(5)}ms | engine=${r.body?.engine ?? "?"} | "${(r.body?.translated ?? "").slice(0, 30)}..."`);
}

// ─── 3. TTS — 자주 쓰는 짧은 문장 ──────────────────────────────────
console.log("\n[3] /api/tts — TTS 응답시간 (Google Neural2 + OpenAI tts-1-hd)");

const ttsSamples = [
  { lang: "ko", text: "안전모를 착용하세요" },
  { lang: "en", text: "Wear your safety helmet" },
  { lang: "vi", text: "Đội mũ bảo hộ" },
  { lang: "zh", text: "请戴好安全帽" },
  { lang: "uz", text: "Xavfsizlik kasketini kiying" },
];

for (const s of ttsSamples) {
  const r = await timeIt(`tts-${s.lang}`, async () => {
    const x = await fetch(
      `${BASE}/api/tts?text=${encodeURIComponent(s.text)}&lang=${s.lang}&gender=female`,
      { headers: { Cookie: cookie } }
    );
    const ab = x.ok ? await x.arrayBuffer() : null;
    return { ok: x.ok, status: x.status, body: { size: ab?.byteLength ?? 0 } };
  });
  console.log(`    ${s.lang}: ${r.ms.toString().padStart(5)}ms | size=${(r.body?.size ?? 0).toString().padStart(6)}B | "${s.text.slice(0, 30)}"`);
}

// ─── 4. STT는 base64 오디오 필요해서 라우트 응답시간만 (오디오 없이 422 확인) ──
console.log("\n[4] /api/stt — 가드 + 응답 베이스라인 (오디오 미첨부 → 400)");
const sttRoute = await timeIt("stt-guard", async () => {
  const x = await fetch(`${BASE}/api/stt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ audio: "", lang: "ko-KR" }),
  });
  const b = await x.json().catch(() => ({}));
  return { ok: x.ok, status: x.status, body: b };
});
console.log(`    ${sttRoute.ms}ms | status=${sttRoute.status} | error=${sttRoute.body?.error ?? "?"}`);
console.log(`    → 실제 음성 데이터 STT 시간은 Whisper 4~6s / Google 1~3s (현장 검증값)`);

// ─── 5. TBM 라이브러리 + AI 팁 ──────────────────────────────────────
console.log("\n[5] /api/tbm/* — TBM 관련 라우트");
const tbmLib = await timeIt("tbm-library", async () => {
  const x = await fetch(`${BASE}/api/tbm/library`, { headers: { Cookie: cookie } });
  const b = await x.json().catch(() => ({}));
  return { ok: x.ok, status: x.status, body: { count: b.data?.length } };
});
console.log(`    library: ${tbmLib.ms.toString().padStart(5)}ms | ${tbmLib.body?.count ?? "?"} 건`);

const aiTips = await timeIt("tbm-ai-tips", async () => {
  const x = await fetch(`${BASE}/api/tbm/ai-tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ context: "오늘 철근 배근 작업 진행. 추락 위험 있음." }),
  });
  const b = await x.json().catch(() => ({}));
  return { ok: x.ok, status: x.status, body: b };
});
console.log(`    ai-tips: ${aiTips.ms.toString().padStart(5)}ms | tips=${aiTips.body?.tips?.length ?? "?"}`);

const briefing = await timeIt("tbm-briefing-draft", async () => {
  const x = await fetch(`${BASE}/api/tbm/briefing-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ category: "철근" }),
  });
  const b = await x.json().catch(() => ({}));
  return { ok: x.ok, status: x.status, body: b };
});
console.log(`    briefing-draft: ${briefing.ms.toString().padStart(5)}ms | draft length=${briefing.body?.draft?.length ?? "?"}`);

console.log("\n" + "=".repeat(78));
console.log("✅ 측정 완료 — 코드 변경 0건. 위 수치 기반으로 회귀 점검 + 보고");
console.log("=".repeat(78));

// S-002 계약 스모크: 모바일 인증 CORS·preflight.
// 사용: node scripts/mobile-auth-cors-smoke.mjs  (dev/preview 서버 필요)
//   SMOKE_BASE 로 베이스 URL 지정 (기본 http://localhost:3001)

const BASE = process.env.SMOKE_BASE || "http://localhost:3001";
const MOBILE_ORIGIN = "https://localhost";          // Capacitor Android(androidScheme=https)
const EVIL = "https://evil.example.com";

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
    console.log(`${cond ? "✅" : "❌"} ${name}${extra ? "  ("+extra+")" : ""}`);
    if (cond) pass++;
    else fail++;
};
const acao = (r) => r.headers.get("access-control-allow-origin");

const main = async () => {
    // 1) admin-login preflight — 허용 origin
    let r = await fetch(`${BASE}/api/auth/admin-login`, {
        method: "OPTIONS",
        headers: { Origin: MOBILE_ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    check("admin-login OPTIONS 허용 origin → 204", r.status === 204, `status=${r.status}`);
    check("  ACAO = mobile origin", acao(r) === MOBILE_ORIGIN, acao(r) || "none");

    // 2) admin-login preflight — 임의 origin 거부
    r = await fetch(`${BASE}/api/auth/admin-login`, { method: "OPTIONS", headers: { Origin: EVIL } });
    check("admin-login OPTIONS 임의 origin → 403", r.status === 403, `status=${r.status}`);
    check("  임의 origin엔 ACAO 없음", !acao(r));

    // 3) auth/me preflight — 허용 origin
    r = await fetch(`${BASE}/api/auth/me`, { method: "OPTIONS", headers: { Origin: MOBILE_ORIGIN } });
    check("auth/me OPTIONS 허용 → 204+ACAO", r.status === 204 && acao(r) === MOBILE_ORIGIN, `status=${r.status}`);

    // 4) auth/me GET — mobile origin, 토큰 없음 → 401 + CORS(앱이 401을 읽을 수 있어야 함)
    r = await fetch(`${BASE}/api/auth/me`, { headers: { Origin: MOBILE_ORIGIN } });
    check("auth/me GET mobile origin(무토큰) → 401", r.status === 401, `status=${r.status}`);
    check("  401에도 CORS 부착(앱 읽기 가능)", acao(r) === MOBILE_ORIGIN, acao(r) || "none");

    // 5) auth/me GET — 웹(origin 없음) → CORS 헤더 없음 (웹 호환, 회귀 방지)
    r = await fetch(`${BASE}/api/auth/me`);
    check("auth/me GET 웹(origin 없음) → ACAO 없음(웹 호환)", !acao(r), acao(r) || "none");

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
};

main().catch((e) => { console.error("smoke error:", e.message); process.exit(1); });

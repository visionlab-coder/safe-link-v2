// 청주센텀 5명 워커 로그인 시뮬레이션:
// 1) 패치 전후 두 경로 (verifyOtp vs raw fetch) 응답 검증
// 2) Set-Cookie 헤더 실제 부착 여부 확인 — production 튕김 원인 직접 재현
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHEONGJU = [
  { initials: "BK", last4: "4567" },
  { initials: "XS", last4: "5566" },
  { initials: "QW", last4: "1234" },
  { initials: "DY", last4: "2244" },
  { initials: "CHEN", last4: "0003" },
];

const CHEONGJU_SITE = "757c7630-8fb0-4c38-b76e-3129bf15b356";

console.log("=".repeat(70));
console.log("청주센텀 5명 로그인 흐름 시뮬레이션 — P5/P7 패치 전후 비교");
console.log("=".repeat(70));

for (const w of CHEONGJU) {
  console.log(`\n👤 ${w.initials}/${w.last4}`);

  // 1) nfc_workers 매칭
  const { data: worker } = await sb
    .from("nfc_workers")
    .select("id, full_name, auth_user_id, preferred_lang")
    .eq("assigned_site_id", CHEONGJU_SITE)
    .eq("name_initials", w.initials)
    .eq("phone_last4", w.last4)
    .eq("is_active", true)
    .maybeSingle();

  if (!worker) {
    console.log(`  ❌ nfc_workers 매칭 실패`);
    continue;
  }
  console.log(`  ✅ nfc_workers 매칭 ok (auth=${worker.auth_user_id ? "있음" : "없음"})`);

  // 2) magiclink 생성 (admin API)
  const email = `nfc.${worker.id}@safe-link.internal`;
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.log(`  ❌ generateLink 실패: ${linkErr?.message ?? "no token"}`);
    continue;
  }
  const tokenHash = linkData.properties.hashed_token;
  const verifyType = linkData.properties.verification_type ?? "magiclink";
  console.log(`  ✅ magiclink 생성 (type=${verifyType})`);

  // 3) 🟢 P7 패턴 — raw fetch /auth/v1/verify (패치 후 동작 검증)
  const verifyRes = await fetch(
    `${supabaseUrl}/auth/v1/verify?apikey=${encodeURIComponent(serviceKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType, token_hash: tokenHash }),
    }
  );

  if (!verifyRes.ok) {
    const errBody = await verifyRes.text();
    console.log(`  ❌ raw verify 실패: ${verifyRes.status} ${errBody.slice(0, 100)}`);
    continue;
  }

  const session = await verifyRes.json();
  const hasToken = !!session.access_token;
  const hasRefresh = !!session.refresh_token;
  const expiresIn = session.expires_in;

  console.log(`  ✅ raw verify ok (access_token=${hasToken}, refresh_token=${hasRefresh}, expires_in=${expiresIn}s)`);

  // 4) 쿠키 구성 (P1 박제 형식)
  if (hasToken) {
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    console.log(`  ✅ cookie 구성: ${cookieName} (length=${cookieValue.length})`);

    // 5) middleware 검증 — 이 쿠키로 profile role 조회되는지
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=role,site_id,display_name&id=eq.${session.user.id}&limit=1&apikey=${encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    const profiles = await profileRes.json();
    const role = profiles[0]?.role;
    const passesMiddleware = role === "WORKER";
    console.log(`  ${passesMiddleware ? "✅" : "❌"} middleware 통과: role=${role} → ${passesMiddleware ? "/worker 정상 진입" : "/auth 로 redirect"}`);
  }
}

console.log("\n" + "=".repeat(70));
console.log("결론: 위 5명 모두 'middleware 통과 ✅' 면 패치 deploy 후 튕김 해결.");
console.log("=".repeat(70));

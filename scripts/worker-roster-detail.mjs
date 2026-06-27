// 테스트베드 2 현장 근로자 리스트 상세 출력.
// profiles WORKER + nfc_workers 양쪽 모두 — 매칭 상태까지 한눈에.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SITES = [
  { id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀푸르지오자이" },
  { id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

const LANG_LABEL = {
  ko: "한국", vi: "베트남", zh: "중국", th: "태국", uz: "우즈벡",
  ph: "필리핀", km: "캄보디아", id: "인도네시아", mn: "몽골", my: "미얀마",
  ne: "네팔", bn: "방글라데시", kk: "카자흐", ru: "러시아", en: "영어",
  jp: "일본", ar: "아랍", hi: "힌디",
};

for (const site of SITES) {
  console.log("\n" + "=".repeat(70));
  console.log(`📍 ${site.name}`);
  console.log("=".repeat(70));

  // nfc_workers (QR/NFC 가입 워커)
  const { data: nfcWorkers } = await sb
    .from("nfc_workers")
    .select("id, name_initials, phone_last4, full_name, nationality, preferred_lang, auth_user_id, created_at")
    .eq("assigned_site_id", site.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  console.log(`\n🆔 NFC/QR 근로자 (nfc_workers 테이블): ${nfcWorkers?.length ?? 0}명`);
  if (nfcWorkers?.length) {
    nfcWorkers.forEach((w, i) => {
      const lang = LANG_LABEL[w.preferred_lang] ?? w.preferred_lang ?? "?";
      const authIcon = w.auth_user_id ? "🔓 로그인" : "🔒 미연결";
      const date = w.created_at ? new Date(w.created_at).toLocaleDateString("ko-KR") : "?";
      console.log(`  ${i + 1}. ${w.name_initials}/${w.phone_last4}  |  ${w.full_name ?? "?"}  |  ${lang}  |  ${authIcon}  |  가입 ${date}`);
    });
  }

  // profiles WORKER (실제 admin/chat 페이지에 노출되는 워커)
  const { data: profileWorkers } = await sb
    .from("profiles")
    .select("id, display_name, preferred_lang, role, created_at")
    .eq("site_id", site.id)
    .eq("role", "WORKER")
    .order("created_at", { ascending: true });

  console.log(`\n💬 채팅 가능 근로자 (profiles WORKER — /admin/chat 노출): ${profileWorkers?.length ?? 0}명`);
  if (profileWorkers?.length) {
    profileWorkers.forEach((w, i) => {
      const lang = LANG_LABEL[w.preferred_lang] ?? w.preferred_lang ?? "?";
      const date = w.created_at ? new Date(w.created_at).toLocaleDateString("ko-KR") : "?";
      console.log(`  ${i + 1}. ${w.display_name}  |  ${lang}  |  가입 ${date}`);
    });
  }

  // 차이 분석: nfc_workers 의 auth_user_id 와 profiles.id 매칭
  if (nfcWorkers?.length) {
    const nfcAuthIds = new Set((nfcWorkers ?? []).map((w) => w.auth_user_id).filter(Boolean));
    const profileIds = new Set((profileWorkers ?? []).map((w) => w.id));
    const inBoth = [...nfcAuthIds].filter((id) => profileIds.has(id));
    const inNfcOnly = [...nfcAuthIds].filter((id) => !profileIds.has(id));
    const inProfilesOnly = [...profileIds].filter((id) => !nfcAuthIds.has(id));

    console.log(`\n🔗 매칭 분석:`);
    console.log(`  양쪽 일치: ${inBoth.length}명`);
    console.log(`  nfc_workers 만: ${inNfcOnly.length}명 (auth 생성됐는데 profiles 미생성)`);
    console.log(`  profiles 만: ${inProfilesOnly.length}명 (다른 경로로 가입한 워커)`);
  }
}

console.log("\n" + "=".repeat(70));

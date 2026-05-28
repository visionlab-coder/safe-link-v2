import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1].trim()] = value;
  }
}

loadEnv(path.resolve(".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteId = "00000000-0000-0000-0000-000000000101";
const workerEmails = {
  kim: "training-kim@safe-link.local",
  nguyen: "training-nguyen@safe-link.local",
  somchai: "training-somchai@safe-link.local",
  rustam: "training-rustam@safe-link.local",
};

if (!url || !anon) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const email = process.env.SAFE_LINK_TRAINING_EMAIL || "training-admin@safe-link.local";
const password = process.env.SAFE_LINK_TRAINING_PASSWORD || "SafeLink!2026";

async function safe(label, promise) {
  const res = await promise;
  if (res?.error) console.warn(`[seed:${label}] ${res.error.message}`);
  return res;
}

let userId = null;

if (service) {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "교육용 관리자" },
  });
  if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
    throw created.error;
  }
  if (created.data?.user?.id) {
    userId = created.data.user.id;
  } else {
    const listed = await admin.auth.admin.listUsers();
    if (listed.error) throw listed.error;
    userId = listed.data.users.find((u) => u.email === email)?.id ?? null;
  }
  if (!userId) throw new Error("Could not resolve training admin user id");

  async function ensureUser(email, displayName) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (created.data?.user?.id) return created.data.user.id;
    if (created.error && !String(created.error.message).toLowerCase().includes("already")) throw created.error;
    const listed = await admin.auth.admin.listUsers();
    if (listed.error) throw listed.error;
    const id = listed.data.users.find((u) => u.email === email)?.id;
    if (!id) throw new Error(`Could not resolve ${email}`);
    return id;
  }

  const workerIds = {
    kim: await ensureUser(workerEmails.kim, "김민수"),
    nguyen: await ensureUser(workerEmails.nguyen, "Nguyen An"),
    somchai: await ensureUser(workerEmails.somchai, "Somchai Prasert"),
    rustam: await ensureUser(workerEmails.rustam, "Rustam Karimov"),
  };

  await safe(
    "site",
    admin.from("sites").upsert(
      {
        id: siteId,
        name: "SAFE-LINK 교육 현장",
        code: "SL-000001-0101",
        site_code: "SL-000001-0101",
        address: "교육용 데모 현장",
      },
      { onConflict: "id" },
    ),
  );

  await safe(
    "admin_profile",
    admin.from("profiles").upsert(
      {
        id: userId,
        role: "SAFETY_OFFICER",
        display_name: "교육용 관리자",
        preferred_lang: "ko",
        title: "안전관리자",
      site_code: "SL-000001-0101",
        site_id: siteId,
        phone_number: "01000000000",
        trade: "관리",
      },
      { onConflict: "id" },
    ),
  );

  const workers = [
    [workerIds.kim, "김민수", "ko", "철근"],
    [workerIds.nguyen, "Nguyen An", "vi", "형틀"],
    [workerIds.somchai, "Somchai Prasert", "th", "비계"],
    [workerIds.rustam, "Rustam Karimov", "uz", "전기"],
  ];
  for (const [id, name, lang, trade] of workers) {
    await safe(
      `profile_${name}`,
      admin.from("profiles").upsert(
        {
          id,
          role: "WORKER",
          display_name: name,
          preferred_lang: lang,
          site_code: "SL-000001-0101",
          site_id: siteId,
          trade,
        },
        { onConflict: "id" },
      ),
    );
  }

  await safe("cleanup_nfc_workers", admin.from("nfc_workers").delete().eq("assigned_site_id", siteId));
  await safe(
    "nfc_workers",
    admin.from("nfc_workers").insert([
      {
        full_name: "김민수",
        nationality: "KR",
        phone: "010-1000-2001",
        assigned_site_id: siteId,
        trade: "rebar",
        preferred_lang: "ko",
        consent_signed_at: new Date().toISOString(),
        name_initials: "KMS",
        phone_last4: "2001",
        is_active: true,
        created_by: userId,
      },
      {
        full_name: "Nguyen An",
        nationality: "VN",
        phone: "010-1000-2002",
        assigned_site_id: siteId,
        trade: "formwork",
        preferred_lang: "vi",
        consent_signed_at: new Date().toISOString(),
        name_initials: "NA",
        phone_last4: "2002",
        is_active: true,
        created_by: userId,
      },
      {
        full_name: "Somchai Prasert",
        nationality: "TH",
        phone: "010-1000-2003",
        assigned_site_id: siteId,
        trade: "scaffold",
        preferred_lang: "th",
        consent_signed_at: new Date().toISOString(),
        name_initials: "SP",
        phone_last4: "2003",
        is_active: true,
        created_by: userId,
      },
      {
        full_name: "Rustam Karimov",
        nationality: "UZ",
        phone: "010-1000-2004",
        assigned_site_id: siteId,
        trade: "electrical",
        preferred_lang: "uz",
        consent_signed_at: null,
        name_initials: "RK",
        phone_last4: "2004",
        is_active: true,
        created_by: userId,
      },
    ]),
  );

  const nfcWorkers = await safe(
    "select_nfc_workers",
    admin.from("nfc_workers").select("id, full_name").eq("assigned_site_id", siteId),
  );
  const nfcByName = new Map((nfcWorkers.data ?? []).map((w) => [w.full_name, w.id]));

  const tbm = await safe(
    "tbm_notice",
    admin
      .from("tbm_notices")
      .insert({
        title: "3층 철근 양중 작업 TBM",
        content_ko:
          "3층 철근 양중 작업 전 안전고리 체결, 낙하물 주의, 이동 동선 통제를 확인합니다. 작업 반경 5m 내 접근을 제한하고 신호수 지시에 따라 이동합니다.",
        site_id: siteId,
        created_by: userId,
      })
      .select("id")
      .single(),
  );

  if (!tbm.error && tbm.data?.id) {
    await safe(
      "tbm_ack",
      admin.from("tbm_ack").upsert(
        [
          { tbm_id: tbm.data.id, worker_id: workerIds.kim, ack_at: new Date().toISOString(), signature_data: "data:image/png;base64,iVBORw0KGgo=" },
          { tbm_id: tbm.data.id, worker_id: workerIds.nguyen, ack_at: new Date().toISOString(), signature_data: "data:image/png;base64,iVBORw0KGgo=" },
        ],
        { onConflict: "tbm_id,worker_id" },
      ),
    );

    const session = await safe(
      "nfc_tbm_session",
      admin
        .from("nfc_tbm_sessions")
        .insert({
          title: "3층 철근 양중 작업 TBM",
          site_id: siteId,
          tbm_notice_id: tbm.data.id,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
    );
    if (!session.error && session.data?.id) {
      await safe(
        "nfc_tbm_attendance",
        admin.from("nfc_tbm_attendance").insert([
          { session_id: session.data.id, worker_id: nfcByName.get("김민수"), is_certified: true, certified_at: new Date().toISOString(), tapped_by: userId, lang_used: "ko" },
          { session_id: session.data.id, worker_id: nfcByName.get("Nguyen An"), is_certified: true, certified_at: new Date().toISOString(), tapped_by: userId, lang_used: "vi" },
          { session_id: session.data.id, worker_id: nfcByName.get("Somchai Prasert"), is_certified: false, tapped_by: userId, lang_used: "th" },
          { session_id: session.data.id, worker_id: nfcByName.get("Rustam Karimov"), is_certified: false, tapped_by: userId, lang_used: "uz" },
        ]),
      );
    }
  }

  await safe("cleanup_messages", admin.from("messages").delete().eq("site_id", siteId));
  await safe(
    "messages",
    admin.from("messages").insert([
      {
        site_id: siteId,
        from_user: userId,
        to_user: workerIds.nguyen,
        source_lang: "ko",
        target_lang: "vi",
        source_text: "Nguyen An님, 3층 철근 양중 작업 전 안전고리 체결 확인했습니다?",
        translated_text: "Anh Nguyen An, trước khi nâng thép tầng 3, anh đã kiểm tra dây an toàn chưa?",
        is_read: true,
      },
      {
        site_id: siteId,
        from_user: workerIds.nguyen,
        to_user: userId,
        source_lang: "vi",
        target_lang: "ko",
        source_text: "Tôi đã kiểm tra. Khu vực dưới cẩu đang được rào lại.",
        translated_text: "확인했습니다. 크레인 하부 작업 구역은 통제선을 설치했습니다.",
        is_read: false,
      },
      {
        site_id: siteId,
        from_user: userId,
        to_user: workerIds.nguyen,
        source_lang: "ko",
        target_lang: "vi",
        source_text: "좋습니다. 신호수 지시 전에는 작업 반경 안으로 들어가지 마세요.",
        translated_text: "Tốt. Không vào bán kính làm việc trước khi người tín hiệu hướng dẫn.",
        is_read: true,
      },
    ]),
  );

  await safe(
    "glossary",
    admin.from("construction_glossary").upsert(
      [
        { slang: "양중", standard: "자재를 들어 올려 이동하는 작업", category: "중장비", origin_lang: "ko", note: "크레인/호이스트 작업 설명", is_active: true },
        { slang: "안전고리", standard: "추락방지용 안전대 걸이", category: "추락", origin_lang: "ko", note: "작업 전 체결 확인", is_active: true },
        { slang: "통제선", standard: "출입 제한 구역 표시선", category: "동선", origin_lang: "ko", note: "양중 반경 접근 금지", is_active: true },
        { slang: "신호수", standard: "장비 운전 유도 담당자", category: "장비", origin_lang: "ko", note: "장비 작업 중 지시 담당", is_active: true },
      ],
      { onConflict: "slang" },
    ),
  );

  await safe(
    "safety_equipment_grants",
    admin.from("safety_equipment_grants").insert([
      { site_id: siteId, worker_id: workerIds.kim, equipment_type: "안전고리", score_pct: 95 },
      { site_id: siteId, worker_id: workerIds.nguyen, equipment_type: "안전모", score_pct: 88 },
    ]),
  );

  await safe(
    "stop_work",
    admin.from("claim17_stop_work_interventions").insert([
      { site_id: siteId, worker_id: workerIds.somchai, status: "resolved", reason: "낙하물 위험 구역 통제선 미설치", hazard_category: "falling_object", resolved_at: new Date().toISOString() },
    ]),
  );
} else {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const signUp = await client.auth.signUp({ email, password });
  if (signUp.error && !String(signUp.error.message).toLowerCase().includes("already")) {
    throw signUp.error;
  }
}

console.log(JSON.stringify({ email, password, userId, siteId, serviceMode: Boolean(service) }, null, 2));

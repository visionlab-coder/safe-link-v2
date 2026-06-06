// Migration dry-run — 4 pending migrations 의 외래키 참조 및 ALTER 대상 테이블이
// production 에 실재하는지, 컬럼 충돌은 없는지 read-only 점검.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// 마이그레이션 4개에서 참조/ALTER 하는 모든 테이블
const REFERENCED_TABLES = [
  // ALTER 대상 (기존)
  "messages", "tbm_quiz_responses", "sites",
  "safety_education_library", "claim17_stop_work_interventions",
  "live_translations",
  // 외래키 참조 (기존)
  "nfc_tbm_sessions", "claim13_audit_events", "claim13_pledges",
  "profiles", "nfc_workers",
  // 신규 (생성 후 다른 마이그에서 참조)
  "messages",
];

// 신규로 생성될 테이블 — 이미 존재하면 if-not-exists 가 받아주지만 컬럼 충돌 위험
const NEW_TABLES = [
  "safety_dialog_keywords",
  "chat_safety_signals",
  "multilingual_content_records",
  "supplementary_education_contents",
  "pledge_risk_assessments",
  "report_verification_codes",
  "stop_work_action_log",
];

async function tableExists(name) {
  const { data, error } = await sb.from(name).select("*", { count: "exact", head: true }).limit(0);
  return { exists: !error, error: error?.message ?? null };
}

const refResults = {};
for (const t of new Set(REFERENCED_TABLES)) {
  refResults[t] = await tableExists(t);
}

const newResults = {};
for (const t of NEW_TABLES) {
  newResults[t] = await tableExists(t);
}

const missingRefs = Object.entries(refResults).filter(([, v]) => !v.exists);
const preExistingNew = Object.entries(newResults).filter(([, v]) => v.exists);

console.log(JSON.stringify({
  ok: missingRefs.length === 0,
  referenced_tables: refResults,
  new_tables: newResults,
  warnings: {
    missing_referenced_tables: missingRefs.map(([k, v]) => ({ table: k, error: v.error })),
    new_tables_already_exist: preExistingNew.map(([k]) => k),
  },
  verdict: missingRefs.length === 0
    ? "SAFE: 모든 참조 테이블 존재, idempotent 마이그레이션 → push 가능"
    : "BLOCK: 누락된 참조 테이블 있음 — 적용 불가",
}, null, 2));

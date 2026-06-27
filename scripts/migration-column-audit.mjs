// P1+P2+P3 마이그레이션의 ALTER TABLE 적용 여부 전수 검증.
// 각 마이그레이션이 ADD COLUMN 한 컬럼이 실제 production 에 있는지 확인.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// 마이그레이션 SQL 에서 ALTER ADD COLUMN 한 모든 (table, column) 쌍
const EXPECTED = [
  // P1
  { table: "messages", col: "tbm_session_id" },
  { table: "messages", col: "risk_assessment_id" },
  { table: "messages", col: "voice_audio_url" },
  { table: "messages", col: "detected_keywords" },
  // P2
  { table: "tbm_quiz_responses", col: "completion_grade" },
  { table: "tbm_quiz_responses", col: "remedial_completed_at" },
  { table: "tbm_quiz_responses", col: "supplementary_content_id" },
  { table: "tbm_quiz_responses", col: "comprehension_score_breakdown" },
  { table: "sites", col: "comprehension_threshold" },
  { table: "sites", col: "remedial_threshold" },
  // P3 — safety_education_library
  { table: "safety_education_library", col: "crew_type" },
  { table: "safety_education_library", col: "worksite_type" },
  { table: "safety_education_library", col: "applicable_time_window" },
  { table: "safety_education_library", col: "ppe_required" },
  { table: "safety_education_library", col: "inspection_checklist" },
  { table: "safety_education_library", col: "site_id" },
  // P3 — claim17_stop_work_interventions
  { table: "claim17_stop_work_interventions", col: "reason_lang" },
  { table: "claim17_stop_work_interventions", col: "reason_translated_admin_lang" },
  { table: "claim17_stop_work_interventions", col: "admin_lang" },
  { table: "claim17_stop_work_interventions", col: "crew_type" },
  { table: "claim17_stop_work_interventions", col: "trigger_source" },
  { table: "claim17_stop_work_interventions", col: "trigger_message_id" },
  { table: "claim17_stop_work_interventions", col: "action_owner_id" },
  { table: "claim17_stop_work_interventions", col: "action_status" },
  { table: "claim17_stop_work_interventions", col: "action_result" },
  { table: "claim17_stop_work_interventions", col: "action_completed_at" },
  { table: "claim17_stop_work_interventions", col: "action_evidence_url" },
  // live_translations payload
  { table: "live_translations", col: "translations" },
];

const grouped = {};
for (const { table, col } of EXPECTED) {
  if (!grouped[table]) grouped[table] = [];
  grouped[table].push(col);
}

const results = { applied: [], missing: [] };
for (const [table, cols] of Object.entries(grouped)) {
  const { error } = await sb.from(table).select(cols.join(",")).limit(0);
  if (!error) {
    for (const c of cols) results.applied.push({ table, col: c });
  } else {
    // 어떤 컬럼이 누락된 건지 한 개씩 확인
    for (const c of cols) {
      const { error: e } = await sb.from(table).select(c).limit(0);
      if (e) results.missing.push({ table, col: c, error: e.message });
      else results.applied.push({ table, col: c });
    }
  }
}

console.log("=".repeat(70));
console.log("마이그레이션 ALTER ADD COLUMN 적용 검증");
console.log("=".repeat(70));
console.log(`\n✅ 적용됨: ${results.applied.length}개`);
for (const r of results.applied) console.log(`   ${r.table}.${r.col}`);
console.log(`\n❌ 누락됨: ${results.missing.length}개`);
for (const r of results.missing) console.log(`   ${r.table}.${r.col}`);

console.log(`\n총 ${EXPECTED.length}개 컬럼 중 ${results.applied.length}개 적용, ${results.missing.length}개 누락`);
console.log("=".repeat(70));

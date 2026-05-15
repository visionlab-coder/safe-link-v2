import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = {
  nfc_worker_safety_daily_logs: [],
  nfc_worker_daily_access: [],
  live_translations: [],
  safety_equipment_grants: [],
  claim13_pledges: [],
  claim17_stop_work_interventions: [],
  claim13_hash_chain_events: [],
  nfc_tbm_attendance: [],
  nfc_tbm_sessions: [],
  nfc_workers: [],
  sites: [],
};

function sha64(char) {
  return char.repeat(64);
}

async function insertOne(table, payloads) {
  const attempts = Array.isArray(payloads) ? payloads : [payloads];
  let lastError = null;

  for (const payload of attempts) {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select("id")
      .single();
    if (!error && data?.id) {
      created[table]?.push(data.id);
      return data.id;
    }
    lastError = error;
  }

  throw new Error(`${table} insert failed: ${lastError?.message ?? "unknown error"}`);
}

async function cleanup() {
  const order = Object.keys(created);
  const errors = [];

  for (const table of order) {
    const ids = created[table];
    if (!ids.length) continue;
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) errors.push({ table, error: error.message });
  }

  return errors;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertClose(actual, expected, label) {
  if (Math.abs(Number(actual) - expected) > 0.0001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const suffix = Date.now().toString(36).toUpperCase();
  const nowIso = new Date().toISOString();
  const workDate = nowIso.slice(0, 10);
  const fromIso = `${workDate}T00:00:00.000Z`;
  const toIso = `${workDate}T23:59:59.999Z`;

  try {
    const siteId = await insertOne("sites", [
      {
        name: `REDTEAM REPORT ${suffix}`,
        code: `RT-REPORT-${suffix}`,
        rollout_status: "standby",
        address: "redteam cleanup test",
        metadata: { redteam: true, suffix },
      },
      {
        name: `REDTEAM REPORT ${suffix}`,
        code: `RT-REPORT-${suffix}`,
        address: "redteam cleanup test",
        metadata: { redteam: true, suffix },
      },
      {
        name: `REDTEAM REPORT ${suffix}`,
        code: `RT-REPORT-${suffix}`,
      },
    ]);

    const workerA = await insertOne("nfc_workers", [
      {
        full_name: "REDTEAM Worker A",
        nationality: "KR",
        phone: "01000001111",
        assigned_site_id: siteId,
        trade: "formwork",
        preferred_lang: "ko",
        is_active: true,
        name_initials: "RWA",
        phone_last4: "1111",
        consent_signed_at: nowIso,
      },
      {
        full_name: "REDTEAM Worker A",
        nationality: "KR",
        phone: "01000001111",
        assigned_site_id: siteId,
        trade: "formwork",
        preferred_lang: "ko",
        is_active: true,
        consent_signed_at: nowIso,
      },
    ]);
    const workerB = await insertOne("nfc_workers", [
      {
        full_name: "REDTEAM Worker B",
        nationality: "VN",
        phone: "01000002222",
        assigned_site_id: siteId,
        trade: "rebar",
        preferred_lang: "vi",
        is_active: true,
        name_initials: "RWB",
        phone_last4: "2222",
        consent_signed_at: nowIso,
      },
      {
        full_name: "REDTEAM Worker B",
        nationality: "VN",
        phone: "01000002222",
        assigned_site_id: siteId,
        trade: "rebar",
        preferred_lang: "vi",
        is_active: true,
        consent_signed_at: nowIso,
      },
    ]);

    const sessionId = await insertOne("nfc_tbm_sessions", {
      site_id: siteId,
      title: "REDTEAM TBM",
      status: "running",
      started_at: nowIso,
      metadata: { redteam: true },
    });

    await insertOne("nfc_tbm_attendance", {
      session_id: sessionId,
      worker_id: workerA,
      tapped_at: nowIso,
      lang_used: "ko",
      is_certified: true,
      certified_at: nowIso,
      entry_method: "qr",
    });
    await insertOne("nfc_tbm_attendance", {
      session_id: sessionId,
      worker_id: workerB,
      tapped_at: nowIso,
      lang_used: "vi",
      is_certified: false,
      entry_method: "qr",
    });

    const audit1 = await insertOne("claim13_hash_chain_events", {
      site_id: siteId,
      entity_type: "redteam",
      entity_id: sessionId,
      event_type: "report_test_1",
      event_payload: { redteam: true },
      payload_sha256: sha64("a"),
      current_hash: sha64("b"),
    });
    await insertOne("claim13_hash_chain_events", {
      site_id: siteId,
      entity_type: "redteam",
      entity_id: sessionId,
      event_type: "report_test_2",
      event_payload: { redteam: true },
      payload_sha256: sha64("c"),
      previous_hash: sha64("b"),
      current_hash: sha64("d"),
    });
    await insertOne("claim13_hash_chain_events", {
      site_id: siteId,
      entity_type: "redteam",
      entity_id: sessionId,
      event_type: "report_test_3",
      event_payload: { redteam: true },
      payload_sha256: sha64("e"),
      previous_hash: sha64("d"),
      current_hash: sha64("f"),
    });

    await insertOne("claim13_pledges", {
      tbm_session_id: sessionId,
      worker_id: workerA,
      site_id: siteId,
      pledge_content: "REDTEAM signed pledge",
      pledge_content_hash: sha64("1"),
      approved_at: nowIso,
      hash_chain_event_id: audit1,
    });
    await insertOne("claim13_pledges", {
      tbm_session_id: sessionId,
      worker_id: workerB,
      site_id: siteId,
      pledge_content: "REDTEAM unsigned pledge",
      pledge_content_hash: sha64("2"),
    });

    await insertOne("claim17_stop_work_interventions", {
      worker_id: workerA,
      site_id: siteId,
      reason: "REDTEAM resolved hazard",
      hazard_category: "fall",
      severity: "high",
      preferred_lang: "ko",
      status: "resolved",
      resolved_at: nowIso,
    });
    await insertOne("claim17_stop_work_interventions", {
      worker_id: workerB,
      site_id: siteId,
      reason: "REDTEAM open hazard",
      hazard_category: "fire",
      severity: "medium",
      preferred_lang: "vi",
      status: "requested",
    });

    await insertOne("safety_equipment_grants", {
      worker_id: workerA,
      site_id: siteId,
      quiz_session_id: `redteam-${suffix}`,
      score_pct: 95,
      equipment_type: "helmet",
      note: "REDTEAM",
    });

    await insertOne("live_translations", {
      session_id: `redteam-live-${suffix}`,
      site_id: siteId,
      text_ko: "레드팀 통역 테스트",
    });

    const dailyAccessId = await insertOne("nfc_worker_daily_access", {
      worker_id: workerA,
      site_id: siteId,
      work_date: workDate,
      status: "checked_out",
      checked_in_at: nowIso,
      checked_out_at: nowIso,
      last_seen_at: nowIso,
      checkin_location: { source: "redteam" },
      checkout_location: { source: "redteam" },
    });

    await insertOne("nfc_worker_safety_daily_logs", {
      worker_id: workerA,
      site_id: siteId,
      work_date: workDate,
      status: "completed",
      check_in_at: nowIso,
      check_out_at: nowIso,
      tbm_signed_at: nowIso,
      tbm_records: [{ session_id: sessionId, is_signed: true, tbm_signed_at: nowIso }],
      attendance_summary: { tbm_count: 1, tbm_signed_count: 1, has_tbm_signature: true },
      source_daily_access_id: dailyAccessId,
      metadata: { redteam: true },
    });

    const { data: sessions, error: sessionsError } = await supabase
      .from("nfc_tbm_sessions")
      .select("id")
      .eq("site_id", siteId)
      .gte("started_at", fromIso)
      .lte("started_at", toIso);
    if (sessionsError) throw new Error(`sessions query failed: ${sessionsError.message}`);

    const sessionIds = sessions.map((row) => row.id);
    const { data: attendance, error: attendanceError } = await supabase
      .from("nfc_tbm_attendance")
      .select("id, is_certified")
      .in("session_id", sessionIds);
    if (attendanceError) throw new Error(`attendance query failed: ${attendanceError.message}`);

    const { data: pledges, error: pledgeError } = await supabase
      .from("claim13_pledges")
      .select("id, approved_at")
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (pledgeError) throw new Error(`pledge query failed: ${pledgeError.message}`);

    const { data: stops, error: stopError } = await supabase
      .from("claim17_stop_work_interventions")
      .select("id, status")
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (stopError) throw new Error(`stop work query failed: ${stopError.message}`);

    const { count: auditCount, error: auditError } = await supabase
      .from("claim13_hash_chain_events")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (auditError) throw new Error(`audit query failed: ${auditError.message}`);

    const { count: grantsCount, error: grantsError } = await supabase
      .from("safety_equipment_grants")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (grantsError) throw new Error(`grants query failed: ${grantsError.message}`);

    const { data: liveRows, error: liveError } = await supabase
      .from("live_translations")
      .select("session_id")
      .eq("site_id", siteId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (liveError) throw new Error(`live translations query failed: ${liveError.message}`);

    const certifiedCount = attendance.filter((row) => row.is_certified).length;
    const signedCount = pledges.filter((row) => row.approved_at).length;
    const resolvedCount = stops.filter((row) => row.status === "resolved").length;

    assertEqual(sessions.length, 1, "ESG totalSessions");
    assertEqual(attendance.length, 2, "ESG totalAttendance");
    assertEqual(certifiedCount, 1, "ESG certifiedCount");
    assertClose(certifiedCount / attendance.length, 0.5, "ESG certificationRate");
    assertEqual(pledges.length, 2, "ESG totalPledges");
    assertEqual(signedCount, 1, "ESG signedPledges");
    assertClose(signedCount / pledges.length, 0.5, "ESG signatureRate");
    assertEqual(stops.length, 2, "ESG stopWork total");
    assertEqual(resolvedCount, 1, "ESG stopWork resolved");
    assertEqual(auditCount, 3, "ESG audit events");
    assertEqual(grantsCount, 1, "ESG equipment grants");
    assertEqual(new Set(liveRows.map((row) => row.session_id)).size, 1, "ESG live translation sessions");

    const { data: dailyRows, error: dailyError } = await supabase
      .from("nfc_worker_safety_daily_logs")
      .select("status, attendance_summary, worker:nfc_workers(full_name)")
      .eq("site_id", siteId)
      .eq("work_date", workDate);
    if (dailyError) throw new Error(`daily safety log query failed: ${dailyError.message}`);
    assertEqual(dailyRows.length, 1, "Daily safety logs row count");
    assertEqual(dailyRows[0].status, "completed", "Daily safety log status");
    assertEqual(dailyRows[0].attendance_summary.has_tbm_signature, true, "Daily safety log TBM signature");

    const cleanupErrors = await cleanup();
    if (cleanupErrors.length) throw new Error(`cleanup failed: ${JSON.stringify(cleanupErrors)}`);

    console.log(JSON.stringify({
      ok: true,
      cleanedUp: true,
      siteId,
      workDate,
      esg: {
        totalSessions: sessions.length,
        totalAttendance: attendance.length,
        certificationRate: certifiedCount / attendance.length,
        totalPledges: pledges.length,
        signatureRate: signedCount / pledges.length,
        stopWorkTotal: stops.length,
        stopWorkResolved: resolvedCount,
        auditEvents: auditCount,
        equipmentGrants: grantsCount,
        liveTranslationSessions: new Set(liveRows.map((row) => row.session_id)).size,
      },
      dailySafetyLog: dailyRows[0],
    }, null, 2));
  } catch (error) {
    const cleanupErrors = await cleanup();
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      cleanupErrors,
      created,
    }, null, 2));
    process.exit(1);
  }
}

main();

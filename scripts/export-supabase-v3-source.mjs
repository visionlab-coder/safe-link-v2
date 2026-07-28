import fs from "node:fs/promises";
import path from "node:path";

const tables = [
  "profiles", "sites", "nfc_workers", "nfc_tbm_sessions", "nfc_tbm_attendance",
  "nfc_worker_safety_daily_logs", "tbm_notices", "tbm_ack", "messages",
  "construction_glossary", "claim13_pledges", "claim13_hash_chain_events",
  "claim17_stop_work_interventions", "live_translations", "safety_education_library",
  "safety_equipment_grants"
];

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const output = process.env.SUPABASE_EXPORT_FILE || "/tmp/safelink-supabase-v3-source.json";

if (!baseUrl || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`
};

async function request(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  return response.json();
}

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await request(`${baseUrl}/rest/v1/${table}?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function fetchAuthUsers() {
  const users = [];
  const pageSize = 1000;
  for (let page = 1; ; page += 1) {
    const payload = await request(`${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${pageSize}`);
    const batch = payload.users ?? [];
    users.push(...batch.map(({ id, email, phone, created_at, updated_at, user_metadata, app_metadata }) => ({
      id, email, phone, created_at, updated_at, user_metadata, app_metadata
    })));
    if (batch.length < pageSize) return users;
  }
}

const exportedAt = new Date().toISOString();
const data = {};
for (const table of tables) {
  data[table] = await fetchAll(table);
  console.log(`${table}: ${data[table].length}`);
}
const authUsers = await fetchAuthUsers();
const snapshot = { exportedAt, source: baseUrl, tables: data, authUsers };
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
console.log(`auth.users: ${authUsers.length}`);
console.log(`snapshot: ${output}`);

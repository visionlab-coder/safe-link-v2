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

const checks = [
  {
    table: "profiles",
    columns: [
      "id",
      "display_name",
      "role",
      "system_role",
      "preferred_lang",
      "phone_number",
      "trade",
      "title",
      "site_code",
      "site_id",
    ],
  },
  {
    table: "tbm_notices",
    columns: ["id", "site_id", "site_code", "title", "content_ko", "created_by", "risk_level", "created_at"],
  },
  {
    table: "tbm_ack",
    columns: ["id", "tbm_id", "worker_id", "worker_name", "signature_data", "ack_at", "signed_at", "created_at"],
  },
  {
    table: "messages",
    columns: [
      "id",
      "site_id",
      "from_user",
      "to_user",
      "source_lang",
      "target_lang",
      "source_text",
      "translated_text",
      "audio_url",
      "is_read",
      "ai_analysis",
      "created_at",
    ],
  },
  {
    table: "construction_glossary",
    columns: ["id", "slang", "standard", "is_active", "created_at"],
  },
];

async function checkTable(table, columns) {
  const result = { table, ok: true, columns: {}, rowCount: null, error: null };

  for (const column of columns) {
    const { error } = await supabase.from(table).select(column).limit(1);
    result.columns[column] = error ? `missing_or_blocked: ${error.message}` : "ok";
    if (error) {
      result.ok = false;
    }
  }

  const { count, error: countError } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (countError) {
    result.ok = false;
    result.error = countError.message;
  } else {
    result.rowCount = count ?? 0;
  }

  return result;
}

async function main() {
  const output = [];

  for (const check of checks) {
    output.push(await checkTable(check.table, check.columns));
  }

  const { data: roles, error: roleError } = await supabase
    .from("profiles")
    .select("role")
    .not("role", "is", null)
    .limit(1000);

  const distinctRoles = roleError
    ? { error: roleError.message }
    : [...new Set((roles ?? []).map((row) => row.role).filter(Boolean))].sort();

  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), output, distinctRoles }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

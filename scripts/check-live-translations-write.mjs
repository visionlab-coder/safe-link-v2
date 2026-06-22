import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[match[1].trim()] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase env");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const sessionId = `smoke_${Date.now()}`;

const { data, error } = await supabase
  .from("live_translations")
  .insert({
    session_id: sessionId,
    text_ko: "시연 전 저장 점검",
    translations: { vi: "Kiem tra luu tru truoc demo" },
  })
  .select("id, session_id, text_ko, translations")
  .single();

if (error) throw error;
console.log(JSON.stringify({ inserted: true, row: data }, null, 2));

const { error: deleteError } = await supabase
  .from("live_translations")
  .delete()
  .eq("id", data.id);

if (deleteError) throw deleteError;
console.log(JSON.stringify({ cleanup: true, id: data.id }, null, 2));

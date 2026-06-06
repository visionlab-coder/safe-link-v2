// Autonomous testbed integrity audit (script-only — mirrors /api/admin/testbed-health logic).
// Uses SERVICE_ROLE key directly so it runs from the local CLI without admin login.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("ENV_MISSING"); process.exit(2); }

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const SITES = [
  { site_id: "757c7630-8fb0-4c38-b76e-3129bf15b356", name: "청주센텀푸르지오자이" },
  { site_id: "38e35a02-d470-41ae-a169-82ba5bae4a5c", name: "과천G-TOWN" },
];

const out = [];
for (const site of SITES) {
  const { data: profileRows } = await sb
    .from("profiles")
    .select("display_name, role, preferred_lang")
    .eq("site_id", site.site_id);
  const admins = (profileRows ?? [])
    .filter((p) => p.role && p.role !== "WORKER")
    .map((p) => ({ name: p.display_name ?? "?", role: p.role, lang: p.preferred_lang }));

  const { data: workerRows } = await sb
    .from("nfc_workers")
    .select("id, name_initials, phone_last4, phone, full_name, preferred_lang, auth_user_id, site_id, assigned_site_id")
    .eq("assigned_site_id", site.site_id)
    .eq("is_active", true);

  const workers = (workerRows ?? []).map((w) => {
    const flags = [];
    if (!w.name_initials) flags.push("INIT_NULL");
    if (!w.phone_last4) flags.push("LAST4_NULL");
    if (!w.phone) flags.push("PHONE_NULL");
    if (!w.full_name) flags.push("NAME_NULL");
    if (w.site_id && w.site_id !== w.assigned_site_id) flags.push("SITE_MISMATCH");
    if (!w.auth_user_id) flags.push("NO_AUTH");
    // QR V2 자동가입: phone 미저장 → PHONE_NULL 은 false positive.
    // NO_AUTH 는 첫 QR 진입 전 정상 상태.
    const INFORMATIONAL = new Set(["NO_AUTH", "PHONE_NULL"]);
    return { ...w, flags, real_flags: flags.filter((f) => !INFORMATIONAL.has(f)) };
  });

  const issues = workers
    .filter((w) => w.real_flags.length > 0)
    .map((w) => ({
      worker_id: w.id,
      name_initials: w.name_initials,
      phone_last4: w.phone_last4,
      full_name: w.full_name,
      flags: w.real_flags,
    }));

  out.push({ site: site.name, site_id: site.site_id, admin_count: admins.length, worker_count: workers.length, issue_count: issues.length, issues });
}

const summary = {
  ok: out.every((s) => s.issue_count === 0),
  total_issues: out.reduce((n, s) => n + s.issue_count, 0),
  sites: out,
};
console.log(JSON.stringify(summary, null, 2));

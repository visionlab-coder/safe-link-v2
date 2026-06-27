import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let value = m[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[m[1].trim()] = value;
}

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const phone = "01010002002";
const email = `${phone}@safe-link.local`;
const password = "SafeLink!2026";

let userId = null;
const created = await service.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "Nguyen An" },
});
if (created.data?.user?.id) userId = created.data.user.id;
if (!userId) {
  const listed = await service.auth.admin.listUsers();
  userId = listed.data.users.find((u) => u.email === email)?.id ?? null;
}
if (!userId) throw new Error("Could not resolve worker auth user");

const { data: sites } = await service.from("sites").select("id, site_code, code").limit(1);
const site = sites?.[0] ?? null;

const profile = await service.from("profiles").upsert(
  {
    id: userId,
    display_name: "Nguyen An",
    role: "WORKER",
    preferred_lang: "vi",
    phone_number: phone,
    site_id: site?.id ?? null,
    site_code: site?.site_code ?? site?.code ?? null,
    trade: "formwork",
  },
  { onConflict: "id" },
);
if (profile.error) throw profile.error;

const existing = await service
  .from("nfc_workers")
  .select("id")
  .or(`phone.eq.${phone},and(assigned_site_id.eq.${site?.id ?? "00000000-0000-0000-0000-000000000000"},name_initials.eq.NA,phone_last4.eq.2002)`)
  .limit(1)
  .maybeSingle();
if (existing.error) throw existing.error;
if (existing.data?.id) {
  const updated = await service.from("nfc_workers").update({
    full_name: "Nguyen An",
    nationality: "VN",
    preferred_lang: "vi",
    assigned_site_id: site?.id ?? null,
    trade: "formwork",
    name_initials: "NA",
    phone_last4: "2002",
    is_active: true,
  }).eq("id", existing.data.id);
  if (updated.error) throw updated.error;
} else {
  const inserted = await service.from("nfc_workers").insert({
    full_name: "Nguyen An",
    nationality: "VN",
    phone,
    assigned_site_id: site?.id ?? null,
    preferred_lang: "vi",
    trade: "formwork",
    name_initials: "NA",
    phone_last4: "2002",
    is_active: true,
    created_by: userId,
  });
  if (inserted.error) throw inserted.error;
}

const [nfc, prof] = await Promise.all([
  service.from("nfc_workers").select("id,full_name,phone,is_active").eq("phone", phone),
  service.from("profiles").select("id,display_name,phone_number,role").eq("phone_number", phone),
]);
console.log(JSON.stringify({ userId, nfc: nfc.data, profiles: prof.data }, null, 2));

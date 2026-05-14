import { NextRequest, NextResponse } from "next/server";
import { createClient as createServer } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER", "SAFETY_OFFICER"]);

function cleanNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const supa = await createServer();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; geofence_radius_m?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const latitude = cleanNumber(body.latitude);
  const longitude = cleanNumber(body.longitude);
  const accuracy = cleanNumber(body.accuracy);
  const radius = cleanNumber(body.geofence_radius_m) ?? 300;

  if (latitude == null || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: "latitude_invalid" }, { status: 400 });
  }
  if (longitude == null || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "longitude_invalid" }, { status: 400 });
  }

  const { data: profile } = await supa
    .from("profiles")
    .select("role, site_id, site_code")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = profile as { role?: string | null; site_id?: string | null } | null;
  const siteId = typedProfile?.site_id;
  if (!siteId) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });
  if (!ADMIN_ROLES.has(String(typedProfile?.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: existingSite } = await service
    .from("sites")
    .select("metadata")
    .eq("id", siteId)
    .maybeSingle();

  const { data: site, error } = await service
    .from("sites")
    .update({
      latitude,
      longitude,
      geofence_radius_m: Math.min(Math.max(Math.round(radius), 20), 5000),
      metadata: {
        ...((existingSite?.metadata && typeof existingSite.metadata === "object") ? existingSite.metadata : {}),
        location_source: "admin_current_device",
        location_updated_by: user.id,
        location_accuracy_m: accuracy == null ? null : Math.round(accuracy),
        location_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteId)
    .select("id, name, site_code, latitude, longitude, geofence_radius_m")
    .single();

  if (error || !site) {
    return NextResponse.json({ error: "site_location_update_failed", detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ site });
}

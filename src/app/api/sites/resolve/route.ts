import { NextRequest, NextResponse } from "next/server";
import { createClient as createServer } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER", "SAFETY_OFFICER"]);

// POST /api/sites/resolve
// body: { name: string }
// 현장명으로 sites 테이블 조회 → 없으면 생성 → { id, name, site_code, created } 반환
// 로그인된 사용자 누구나 호출 가능 (프로필 등록 시 사용)

const SITE_CODE_PATTERN = /^SL-\d{6}-\d{4}$/i;

export async function POST(req: NextRequest) {
  const supa = await createServer();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    name?: string;
    location?: { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
    geofence_radius_m?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "name_too_short" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "name_too_long" }, { status: 400 });
  }

  const latitude = Number(body.location?.latitude);
  const longitude = Number(body.location?.longitude);
  const accuracy = Number(body.location?.accuracy);
  const radius = Number(body.geofence_radius_m || 300);
  const hasLocation =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const service = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await supa
    .from("profiles")
    .select("role, site_id")
    .eq("id", user.id)
    .maybeSingle();
  const profileRole = String((profile as { role?: string | null } | null)?.role ?? "").toUpperCase();
  const profileSiteId = (profile as { site_id?: string | null } | null)?.site_id ?? null;
  const canUpdateExistingSiteLocation = (siteId: string) =>
    Boolean(hasLocation && profileSiteId === siteId && ADMIN_ROLES.has(profileRole));

  const siteCodeInput = SITE_CODE_PATTERN.test(name) ? name.toUpperCase() : null;

  const existingByCode = siteCodeInput
    ? await service
        .from("sites")
        .select("id, name, site_code, metadata")
        .eq("site_code", siteCodeInput)
        .maybeSingle()
    : { data: null };

  // 현장명으로 기존 현장 조회 (대소문자 무시)
  const existingByName = existingByCode.data
    ? { data: null }
    : await service
        .from("sites")
        .select("id, name, site_code, metadata")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();

  const existing = existingByCode.data ?? existingByName.data;

  if (existing) {
    if (canUpdateExistingSiteLocation(existing.id)) {
      await service
        .from("sites")
        .update({
          latitude,
          longitude,
          geofence_radius_m: Number.isFinite(radius) ? Math.min(Math.max(Math.round(radius), 20), 5000) : 300,
          metadata: {
            ...((existing.metadata && typeof existing.metadata === "object") ? existing.metadata : {}),
            location_source: "admin_profile_geolocation",
            location_updated_by: user.id,
            location_accuracy_m: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
            location_updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return NextResponse.json({
      id: existing.id,
      name: existing.name,
      site_code: existing.site_code,
      created: false,
    });
  }

  // 없으면 신규 생성 — ADMIN_ROLES만 허용
  if (!ADMIN_ROLES.has(profileRole)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: created, error: insertErr } = await service
    .from("sites")
    .insert({
      name,
      ...(hasLocation && {
        latitude,
        longitude,
        geofence_radius_m: Number.isFinite(radius) ? Math.min(Math.max(Math.round(radius), 20), 5000) : 300,
      }),
      metadata: {
        created_by: user.id,
        source: "self_register",
        ...(hasLocation && {
          location_source: "admin_profile_geolocation",
          location_accuracy_m: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          location_updated_at: new Date().toISOString(),
        }),
      },
    })
    .select("id, name, site_code")
    .single();

  if (insertErr || !created) {
    return NextResponse.json(
      { error: "site_create_failed", detail: insertErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: created.id,
    name: created.name,
    site_code: created.site_code,
    created: true,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { appendClaim13HashChainEvent, type JsonValue } from "@/utils/audit/sha256-hash-chain";

export const runtime = "nodejs";

type StopWorkBody = {
  siteId?: string;
  reason?: string;
  hazardCategory?: string;
  severity?: "low" | "medium" | "high" | "critical";
  preferredLang?: string;
  gps?: { lat: number; lng: number; accuracy?: number };
  photoUrls?: string[];
};

// 청구항 16: 위험작업거부·산재 발생 시 SAFETY_OFFICER 우선 라우팅
const PRIORITY_HAZARD_CATEGORIES = new Set(["위험작업거부", "산업재해", "danger_refusal", "accident"]);

async function routeToAdmins(
  service: ReturnType<typeof createService>,
  siteId: string,
  alertId: string,
  isPriority: boolean
) {
  const targetRoles = isPriority
    ? ["SAFETY_OFFICER", "HQ_OFFICER"]
    : ["SAFETY_OFFICER", "HQ_OFFICER", "HQ_ADMIN", "SITE_MANAGER"];

  const { data: admins } = await service
    .from("profiles")
    .select("id, role, site_id")
    .in("role", targetRoles)
    .or(`site_id.eq.${siteId},role.in.(HQ_ADMIN,HQ_OFFICER)`);

  if (!admins?.length) return { routed: 0, roles: [] };

  await service.from("stop_work_alert_routing").insert(
    admins.map((admin: { id: string; role: string }) => ({
      alert_id: alertId,
      admin_id: admin.id,
      admin_role: admin.role,
      is_priority: isPriority,
      escalation_due_at: isPriority
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        : null,
    }))
  ).throwOnError();

  return { routed: admins.length, roles: admins.map((a: { role: string }) => a.role) };
}

function createService() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanSeverity(value: unknown): "low" | "medium" | "high" | "critical" {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "high";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: StopWorkBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const siteId = String(body.siteId || "").trim();
  const reason = String(body.reason || "").trim();
  if (!siteId || !reason) return NextResponse.json({ error: "siteId_reason_required" }, { status: 400 });

  const service = createService();
  const now = new Date();
  const escalationDueAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const { data: baseAlert, error: baseError } = await service
    .from("stop_work_alerts")
    .insert({
      worker_id: user.id,
      worker_name: user.email ?? "worker",
      site_id: siteId,
      reason,
      lang: body.preferredLang ?? "ko",
      resolved: false,
    })
    .select("id, created_at")
    .single();

  if (baseError) return NextResponse.json({ error: "base_alert_insert_failed", detail: baseError.message }, { status: 500 });

  const gps = body.gps
    ? {
        lat: body.gps.lat,
        lng: body.gps.lng,
        accuracy: body.gps.accuracy ?? null,
      }
    : null;

  const interventionPayload: Record<string, JsonValue> = {
    alert_id: baseAlert.id,
    worker_id: user.id,
    site_id: siteId,
    reason,
    hazard_category: body.hazardCategory ?? "unspecified",
    severity: cleanSeverity(body.severity),
    preferred_lang: body.preferredLang ?? "ko",
    gps,
    photo_urls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    status: "requested",
    escalation_due_at: escalationDueAt,
  };

  const { data: intervention, error: interventionError } = await service
    .from("claim17_stop_work_interventions")
    .insert(interventionPayload)
    .select("id, status, escalation_due_at")
    .single();

  if (interventionError) {
    return NextResponse.json({ error: "intervention_insert_failed", detail: interventionError.message }, { status: 500 });
  }

  const audit = await appendClaim13HashChainEvent(service, {
    siteId,
    entityType: "stop_work_intervention",
    entityId: intervention.id,
    eventType: "claim17_stop_work_requested",
    payload: interventionPayload,
    createdBy: user.id,
  });

  // 청구항 16: 위험작업거부·산재 시 SAFETY_OFFICER 우선 라우팅
  const isPriority = PRIORITY_HAZARD_CATEGORIES.has(body.hazardCategory ?? "");
  let routing: { routed: number; roles: string[] } = { routed: 0, roles: [] };
  try {
    routing = await routeToAdmins(service, siteId, baseAlert.id, isPriority);
  } catch { /* 라우팅 실패해도 alert는 저장됨 */ }

  return NextResponse.json({
    alertId: baseAlert.id,
    intervention,
    audit,
    escalationDueAt,
    routing,
    isPriorityRouted: isPriority,
  });
}

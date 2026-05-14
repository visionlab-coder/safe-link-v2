import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { TRADES } from "@/utils/nfc/constants";

export const runtime = "nodejs";

const TRADE_CODES = TRADES.map((t) => t.code) as readonly string[];

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()*"\\%_]/g, "").slice(0, 64);
}

const GLOBAL_ROLES = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"];

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const requestedSiteId = req.nextUrl.searchParams.get("site_id");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const activeOnly = req.nextUrl.searchParams.get("active") !== "0";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);

  let enforcedSiteId: string | null = requestedSiteId;
  if (!GLOBAL_ROLES.includes(guard.ctx.user.role)) {
    const { data: profile } = await guard.ctx.service
      .from("profiles")
      .select("site_id")
      .eq("id", guard.ctx.user.id)
      .maybeSingle();
    if (!profile?.site_id) return NextResponse.json({ error: "profile_site_required" }, { status: 409 });
    enforcedSiteId = profile.site_id;
  }

  let query = guard.ctx.service
    .from("nfc_workers")
    .select("id, worker_code, full_name, nationality, phone, assigned_site_id, trade, preferred_lang, is_active, consent_signed_at")
    .order("id", { ascending: false })
    .limit(limit);

  const siteId = enforcedSiteId;
  if (siteId) query = query.eq("assigned_site_id", siteId);
  if (activeOnly) query = query.eq("is_active", true);
  if (q) {
    const safe = sanitizeSearchTerm(q);
    if (safe.length > 0) {
      query = query.or(`full_name.ilike.%${safe}%,worker_code.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ workers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  let body: {
    full_name?: string;
    nationality?: string;
    phone?: string;
    assigned_site_id?: string;
    trade?: string;
    preferred_lang?: string;
    consent_signed_at?: string;
    consent_doc_url?: string;
    name_initials?: string;
    phone_last4?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const fullName = String(body.full_name || "").trim();
  const nationality = String(body.nationality || "KR").trim().toUpperCase();
  const trade = String(body.trade || "general").trim();
  const preferredLang = String(body.preferred_lang || "ko").trim().toLowerCase();
  const nameInitials = String(body.name_initials || "").trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || null;
  const phoneLast4 = String(body.phone_last4 || "").trim().replace(/\D/g, "").slice(-4) || null;

  if (!fullName) return NextResponse.json({ error: "full_name_required" }, { status: 400 });
  if (!nationality || nationality.length < 2) return NextResponse.json({ error: "nationality_required" }, { status: 400 });
  if (!trade || !TRADE_CODES.includes(trade)) return NextResponse.json({ error: "trade_invalid" }, { status: 400 });
  if (!preferredLang || preferredLang.length < 2) return NextResponse.json({ error: "preferred_lang_required" }, { status: 400 });

  const consentSignedAt = body.consent_signed_at ? new Date(body.consent_signed_at).toISOString() : null;

  const { data, error } = await ctx.service
    .from("nfc_workers")
    .insert({
      full_name: fullName,
      nationality,
      phone: body.phone?.trim() || null,
      assigned_site_id: body.assigned_site_id?.trim() || null,
      trade,
      preferred_lang: preferredLang,
      consent_signed_at: consentSignedAt,
      consent_doc_url: body.consent_doc_url?.trim() || null,
      name_initials: nameInitials,
      phone_last4: phoneLast4,
      is_active: true,
      created_by: ctx.user.id,
    })
    .select("id, worker_code, full_name, nationality, phone, assigned_site_id, trade, preferred_lang, is_active, consent_signed_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "worker_create_failed", detail: error?.message }, { status: 500 });
  return NextResponse.json({ worker: data });
}

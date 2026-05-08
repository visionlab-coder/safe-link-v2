import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { sha256Hex } from "@/utils/audit/sha256-hash-chain";

export const runtime = "nodejs";

type PledgeBody = {
  tbmSessionId?: string;
  siteId?: string;
  pledgeContent?: string;
  nfcUid?: string;
  signatureData?: string;
};

function createService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: PledgeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const siteId = String(body.siteId || "").trim();
  const pledgeContent = String(body.pledgeContent || "").trim();
  if (!siteId || !pledgeContent) return NextResponse.json({ error: "siteId_pledgeContent_required" }, { status: 400 });

  const pledgeContentHash = await sha256Hex(pledgeContent);
  const service = createService();

  const { data, error } = await service
    .from("claim13_pledges")
    .insert({
      tbm_session_id: body.tbmSessionId ?? null,
      worker_id: user.id,
      site_id: siteId,
      pledge_content: pledgeContent,
      pledge_content_hash: pledgeContentHash,
      nfc_uid: body.nfcUid ?? null,
      signature_data: body.signatureData ?? null,
    })
    .select("id, pledge_content_hash")
    .single();

  if (error) return NextResponse.json({ error: "pledge_insert_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ pledgeId: data.id, pledgeContentHash: data.pledge_content_hash });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const tbmSessionId = req.nextUrl.searchParams.get("tbmSessionId");
  if (!tbmSessionId) return NextResponse.json({ error: "tbmSessionId_required" }, { status: 400 });

  const { data, error } = await guard.ctx.service
    .from("claim13_pledges")
    .select("*")
    .eq("tbm_session_id", tbmSessionId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "pledge_query_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ pledges: data ?? [] });
}

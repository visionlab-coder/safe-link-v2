import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { appendClaim13HashChainEvent } from "@/utils/audit/sha256-hash-chain";

export const runtime = "nodejs";

type SignBody = {
  signatureData?: string;
};

function createService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  let body: SignBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const signatureData = String(body.signatureData || "").trim();
  if (!signatureData) return NextResponse.json({ error: "signatureData_required" }, { status: 400 });

  const service = createService();

  // M-06: Atomic UPDATE-first pattern — eliminates orphan audit events from concurrent signing.
  // The .is("approved_at", null) guard ensures exactly one concurrent request wins.
  // Audit event is inserted ONLY after the pledge is durably signed.
  const approvedAt = new Date().toISOString();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  // Step 1: Fetch pledge to verify ownership (read-only, before atomic write)
  const { data: pledge, error: pledgeError } = await service
    .from("claim13_pledges")
    .select("id, worker_id, site_id, tbm_session_id, pledge_content_hash, nfc_uid, approved_at")
    .eq("id", id)
    .maybeSingle();

  if (pledgeError || !pledge) return NextResponse.json({ error: "pledge_not_found" }, { status: 404 });
  if (pledge.worker_id !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // Step 2: Atomic write — only one concurrent request wins; losers get 409
  const { data: updatedPledge, error: updateError } = await service
    .from("claim13_pledges")
    .update({
      signature_data: signatureData,
      approved_at: approvedAt,
      client_ip: clientIp,
    })
    .eq("id", id)
    .is("approved_at", null) // concurrent-safe: only succeeds if not yet signed
    .select("id")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: "pledge_sign_failed" }, { status: 500 });
  if (!updatedPledge) {
    // Another concurrent request already signed this pledge
    return NextResponse.json({ error: "pledge_already_signed" }, { status: 409 });
  }

  // Step 3: Append audit event (pledge is already durably signed above)
  // Audit failure is non-fatal — pledge integrity is preserved; alert separately if needed
  let hashChainEventId: number | null = null;
  try {
    const audit = await appendClaim13HashChainEvent(service, {
      siteId: pledge.site_id,
      entityType: "claim13_pledge",
      entityId: pledge.id,
      eventType: "pledge_signed",
      payload: {
        pledge_id: pledge.id,
        worker_id: pledge.worker_id,
        tbm_session_id: pledge.tbm_session_id,
        pledge_content_hash: pledge.pledge_content_hash,
        nfc_uid: pledge.nfc_uid,
        approved_at: approvedAt,
        client_ip: clientIp,
      },
      createdBy: user.id,
    });
    hashChainEventId = audit.id;
    await service
      .from("claim13_pledges")
      .update({ hash_chain_event_id: audit.id })
      .eq("id", id);
  } catch {
    // Audit chain failure — pledge signed but hash_chain_event_id remains null
  }

  return NextResponse.json({ ok: true, approvedAt, hashChainEventId });
}

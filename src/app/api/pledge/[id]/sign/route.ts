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
  const { data: pledge, error: pledgeError } = await service
    .from("claim13_pledges")
    .select("id, worker_id, site_id, tbm_session_id, pledge_content_hash, nfc_uid, approved_at")
    .eq("id", id)
    .maybeSingle();

  if (pledgeError || !pledge) return NextResponse.json({ error: "pledge_not_found" }, { status: 404 });
  if (pledge.worker_id !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // Patch H-4: 재서명 방지
  if (pledge.approved_at !== null) {
    return NextResponse.json({ error: "pledge_already_signed" }, { status: 409 });
  }

  const approvedAt = new Date().toISOString();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  // Patch C-11: 해시체인 삽입 후 pledge UPDATE 실패 시 해시체인 이벤트 삭제 시도
  let audit;
  try {
    audit = await appendClaim13HashChainEvent(service, {
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
  } catch (auditErr) {
    return NextResponse.json(
      { error: "audit_chain_failed", detail: auditErr instanceof Error ? auditErr.message : String(auditErr) },
      { status: 500 }
    );
  }

  const { data: updatedPledge, error: updateError } = await service
    .from("claim13_pledges")
    .update({
      signature_data: signatureData,
      approved_at: approvedAt,
      client_ip: clientIp,
      hash_chain_event_id: audit.id,
    })
    .eq("id", id)
    .is("approved_at", null) // atomic guard — only one concurrent request wins
    .select("id")
    .maybeSingle();

  if (updateError) {
    // 롤백: 해시체인 이벤트 삭제 시도 (best-effort)
    try {
      await service.from("claim13_audit_events").delete().eq("id", audit.id);
    } catch {
      // 삭제 실패는 무시 — 감사 로그 정합성 우선
    }
    return NextResponse.json({ error: "pledge_sign_failed" }, { status: 500 });
  }
  if (!updatedPledge) {
    // Another concurrent request already signed it
    return NextResponse.json({ error: "pledge_already_signed" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, approvedAt, hashChainEventId: audit.id });
}

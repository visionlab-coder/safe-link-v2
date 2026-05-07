import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/nfc/require-admin";
import { appendClaim13HashChainEvent, type JsonValue } from "@/utils/audit/sha256-hash-chain";

export const runtime = "nodejs";

type AuditRequestBody = {
  siteId?: string;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  payload?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: AuditRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const siteId = String(body.siteId || "").trim();
  const entityType = String(body.entityType || "").trim();
  const entityId = String(body.entityId || "").trim();
  const eventType = String(body.eventType || "").trim();

  if (!siteId || !entityType || !entityId || !eventType || !isJsonValue(body.payload) || !isRecord(body.payload)) {
    return NextResponse.json({ error: "siteId_entityType_entityId_eventType_payload_required" }, { status: 400 });
  }

  try {
    const event = await appendClaim13HashChainEvent(guard.ctx.service, {
      siteId,
      entityType,
      entityId,
      eventType,
      payload: body.payload,
      createdBy: guard.ctx.user.id,
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: "hash_chain_append_failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId_required" }, { status: 400 });

  const { data, error } = await guard.ctx.service.rpc("verify_claim13_hash_chain", { p_site_id: siteId });
  if (error) return NextResponse.json({ error: "verification_failed", detail: error.message }, { status: 500 });

  return NextResponse.json({
    siteId,
    valid: Array.isArray(data) ? data.length === 0 : false,
    breaks: data ?? [],
  });
}

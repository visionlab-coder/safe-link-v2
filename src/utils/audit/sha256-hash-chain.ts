import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Claim13HashChainInput {
  siteId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  payload: JsonValue;
  createdBy?: string | null;
}

export interface Claim13HashChainEvent {
  id: number;
  site_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  payload_sha256: string;
  previous_hash: string | null;
  current_hash: string;
  created_at: string;
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, JsonValue>>((acc, key) => {
      acc[key] = sortJson(value[key]);
      return acc;
    }, {});
}

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(sortJson(value));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

export async function buildClaim13HashMaterial(input: Claim13HashChainInput): Promise<{
  canonicalPayload: string;
  payloadSha256: string;
}> {
  const canonicalPayload = canonicalJson(input.payload);
  return {
    canonicalPayload,
    payloadSha256: await sha256Hex(canonicalPayload),
  };
}

export async function appendClaim13HashChainEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any, any, any>,
  input: Claim13HashChainInput
): Promise<Claim13HashChainEvent> {
  const { payloadSha256 } = await buildClaim13HashMaterial(input);

  const { data, error } = await service.rpc("append_claim13_audit_event", {
    p_site_id: input.siteId,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_event_type: input.eventType,
    p_payload: input.payload,
    p_payload_sha256: payloadSha256,
    p_created_by: input.createdBy ?? null,
  });

  if (error) throw new Error(`append_claim13_audit_event failed: ${error.message}`);
  if (!data) throw new Error("append_claim13_audit_event returned no row");

  return data as Claim13HashChainEvent;
}

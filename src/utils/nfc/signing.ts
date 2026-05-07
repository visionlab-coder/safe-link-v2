import "server-only";
/**
 * SAFE-LINK — 근로자 스티커 HMAC 서명 (특허 핵심 보안 레이어)
 *
 * 페이로드:  `${worker_id}|${sig_version}|${issued_epoch}`
 * 서명:      base64url( HMAC-SHA256( NFC_STICKER_SECRET, payload ) )
 * URL 형태:  https://<host>/nfc/w/<workerId>?v=<sigVersion>&t=<issuedEpoch>&sig=<sig>
 *
 * 검증 단계:
 *   1) 서명 재계산 + constant-time compare (타이밍 공격 방어)
 *   2) DB에서 해당 sticker가 is_active=true인지 확인
 *   3) is_active=false면 즉시 거부 (revoke된 스티커)
 */

const SIG_VERSION_CURRENT = 1;

function base64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (str.length % 4)) % 4);
  const binary = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.NFC_STICKER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "NFC_STICKER_SECRET is missing or too short (>=32 chars required). " +
      "Set it in .env.local and Vercel env. Generate: openssl rand -hex 32"
    );
  }
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return cachedKey;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface SignedStickerPayload {
  workerId: string;
  sigVersion: number;
  issuedEpoch: number;
  sig: string;
}

export async function signSticker(
  workerId: string,
  opts: { sigVersion?: number; issuedEpoch?: number } = {}
): Promise<SignedStickerPayload> {
  if (!workerId || typeof workerId !== "string") throw new Error("signSticker: workerId required");
  const sigVersion = opts.sigVersion ?? SIG_VERSION_CURRENT;
  const issuedEpoch = opts.issuedEpoch ?? Math.floor(Date.now() / 1000);
  const payload = `${workerId}|${sigVersion}|${issuedEpoch}`;
  const key = await getSigningKey();
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return { workerId, sigVersion, issuedEpoch, sig: base64urlEncode(mac) };
}

export interface VerifyStickerInput {
  workerId: string;
  sigVersion: number | string;
  issuedEpoch: number | string;
  sig: string;
}

export async function verifyStickerSignature(input: VerifyStickerInput): Promise<boolean> {
  try {
    const { workerId, sig } = input;
    const sigVersion = Number(input.sigVersion);
    const issuedEpoch = Number(input.issuedEpoch);
    if (!workerId || !sig || !Number.isFinite(sigVersion) || !Number.isFinite(issuedEpoch)) return false;
    const payload = `${workerId}|${sigVersion}|${issuedEpoch}`;
    const key = await getSigningKey();
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const provided = base64urlDecode(sig);
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export interface ParsedStickerTap {
  workerId: string;
  sigVersion: number;
  issuedEpoch: number;
  sig: string;
}

export function parseStickerUrl(rawUrl: string, expectedOrigin?: string): ParsedStickerTap | null {
  try {
    const u = new URL(rawUrl);
    if (expectedOrigin) {
      const allowed = new URL(expectedOrigin);
      if (u.origin !== allowed.origin) return null;
    }
    const m = u.pathname.match(/^\/nfc\/w\/([A-Za-z0-9\-_]+)\/?$/);
    if (!m) return null;
    const workerId = decodeURIComponent(m[1]);
    const v = u.searchParams.get("v");
    const t = u.searchParams.get("t");
    const sig = u.searchParams.get("sig");
    if (!v || !t || !sig) return null;
    const sigVersion = Number(v);
    const issuedEpoch = Number(t);
    if (!Number.isFinite(sigVersion) || !Number.isFinite(issuedEpoch)) return null;
    return { workerId, sigVersion, issuedEpoch, sig };
  } catch {
    return null;
  }
}

export const NFC_SIG_CURRENT_VERSION = SIG_VERSION_CURRENT;

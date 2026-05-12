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
  workerCode?: string;
  sigVersion: number;
  issuedEpoch: number;
  sig: string;
  identityHint?: string;
}

export async function signSticker(
  workerId: string,
  opts: { sigVersion?: number; issuedEpoch?: number; workerCode?: string; identityHint?: string } = {}
): Promise<SignedStickerPayload> {
  if (!workerId || typeof workerId !== "string") throw new Error("signSticker: workerId required");
  const sigVersion = opts.sigVersion ?? SIG_VERSION_CURRENT;
  const issuedEpoch = opts.issuedEpoch ?? Math.floor(Date.now() / 1000);
  const payload = opts.workerCode
    ? `${opts.workerCode}|${sigVersion}|${opts.identityHint ?? ""}`
    : `${workerId}|${sigVersion}|${issuedEpoch}`;
  const key = await getSigningKey();
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sig = base64urlEncode(mac);
  return {
    workerId,
    workerCode: opts.workerCode,
    sigVersion,
    issuedEpoch,
    identityHint: opts.identityHint,
    sig: opts.workerCode ? sig.slice(0, 22) : sig,
  };
}

export interface VerifyStickerInput {
  workerId?: string;
  workerCode?: string;
  sigVersion: number | string;
  issuedEpoch?: number | string;
  sig: string;
  identityHint?: string;
}

export async function verifyStickerSignature(input: VerifyStickerInput): Promise<boolean> {
  try {
    const { workerId, workerCode, sig } = input;
    const sigVersion = Number(input.sigVersion);
    const issuedEpoch = input.issuedEpoch == null ? NaN : Number(input.issuedEpoch);
    if (!sig || !Number.isFinite(sigVersion)) return false;
    const isCompact = Boolean(workerCode);
    if (!isCompact && (!workerId || !Number.isFinite(issuedEpoch))) return false;
    const payload = isCompact
      ? `${workerCode}|${sigVersion}|${input.identityHint ?? ""}`
      : `${workerId}|${sigVersion}|${issuedEpoch}`;
    const key = await getSigningKey();
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const provided = base64urlDecode(sig);
    if (isCompact) {
      return base64urlEncode(expected).slice(0, 22) === sig;
    }
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export interface ParsedStickerTap {
  workerId?: string;
  workerCode?: string;
  sigVersion: number;
  issuedEpoch?: number;
  sig: string;
  identityHint?: string;
}

export function parseStickerUrl(rawUrl: string, expectedOrigin?: string): ParsedStickerTap | null {
  try {
    const u = new URL(rawUrl);
    if (expectedOrigin) {
      const allowed = new URL(expectedOrigin);
      if (u.origin !== allowed.origin) return null;
    }
    const m = u.pathname.match(/^\/(?:n|nfc\/w)\/([A-Za-z0-9\-_]+)\/?$/);
    if (!m) return null;
    const ref = decodeURIComponent(m[1]);
    const v = u.searchParams.get("v");
    const t = u.searchParams.get("t");
    const sig = u.searchParams.get("s") ?? u.searchParams.get("sig");
    const identityHint = u.searchParams.get("h") ?? undefined;
    if (!v || !sig) return null;
    const sigVersion = Number(v);
    const issuedEpoch = t ? Number(t) : undefined;
    if (!Number.isFinite(sigVersion)) return null;
    if (t && !Number.isFinite(issuedEpoch)) return null;
    if (ref.startsWith("WRK-")) {
      return { workerCode: ref, sigVersion, issuedEpoch, sig, identityHint };
    }
    if (!t || !Number.isFinite(issuedEpoch)) return null;
    return { workerId: ref, sigVersion, issuedEpoch, sig, identityHint };
  } catch {
    return null;
  }
}

export const NFC_SIG_CURRENT_VERSION = SIG_VERSION_CURRENT;

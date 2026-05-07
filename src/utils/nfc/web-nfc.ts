/**
 * Web NFC API 래퍼 — SAFE-LINK V2.0
 *
 * 지원 현황:
 *  ✓ Chrome on Android (NDEF)
 *  ✗ iOS Safari (Web NFC 미지원 → QR 폴백 필요)
 *  ✗ Desktop (미지원)
 *
 * 탭 1회 = TBM 참석 확인. 스티커 URL 형태:
 *   https://<host>/nfc/w/<workerId>?v=<sig_version>&t=<issued_epoch>&sig=<hmac>
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NfcScanResult {
  /** 스티커 URL 전체 (서버 탭 API에 그대로 전송) */
  rawPayload: string;
  /** NDEF 직렬번호 */
  serialNumber?: string;
  /** 감지 시각(epoch ms) */
  timestamp: number;
}

export interface NfcScanOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  dedupCooldownMs?: number;
  /** 기대 origin (스푸핑 방지). 예: "https://safe-link-v2.vercel.app" */
  expectedBaseUrl?: string;
}

export interface NfcSupportInfo {
  supported: boolean;
  reason?: "not_secure_context" | "no_ndef_reader" | "unsupported_platform";
  isAndroid: boolean;
  isIOS: boolean;
  isSecureContext: boolean;
}

export function detectNfcSupport(): NfcSupportInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isSecureContext = typeof window !== "undefined" && window.isSecureContext === true;

  if (typeof window === "undefined") {
    return { supported: false, reason: "unsupported_platform", isAndroid, isIOS, isSecureContext: false };
  }
  if (!isSecureContext) {
    return { supported: false, reason: "not_secure_context", isAndroid, isIOS, isSecureContext };
  }
  if (!("NDEFReader" in window)) {
    return { supported: false, reason: "no_ndef_reader", isAndroid, isIOS, isSecureContext };
  }
  return { supported: true, isAndroid, isIOS, isSecureContext };
}

export type NfcErrorCode =
  | "unsupported" | "permission_denied" | "invalid_payload"
  | "read_error" | "write_failed" | "timeout" | "aborted" | "unknown";

export class NfcError extends Error {
  readonly code: NfcErrorCode;
  constructor(code: NfcErrorCode, message: string) {
    super(message);
    this.name = "NfcError";
    this.code = code;
  }
}

export interface NfcWriteOptions {
  signal?: AbortSignal;
  makeReadOnly?: boolean;
  overwrite?: boolean;
}

/** 스티커 URL 형태인지 확인 (origin 검사 포함) */
function isValidStickerUrl(rawPayload: string, expectedBaseUrl?: string): boolean {
  try {
    const u = new URL(rawPayload);
    if (expectedBaseUrl) {
      const expected = new URL(expectedBaseUrl);
      if (u.origin !== expected.origin) return false;
    }
    // /nfc/w/{workerId} 경로 + v, t, sig 파라미터 필수
    const hasPath = /^\/nfc\/w\/[A-Za-z0-9\-_]+\/?$/.test(u.pathname);
    const hasSig = u.searchParams.has("v") && u.searchParams.has("t") && u.searchParams.has("sig");
    return hasPath && hasSig;
  } catch {
    return false;
  }
}

export class NfcScanner {
  private reader: any | null = null;
  private lastDetectedAt = 0;
  private lastDetectedUrl: string | null = null;

  async scanOnce(options: NfcScanOptions = {}): Promise<NfcScanResult> {
    const support = detectNfcSupport();
    if (!support.supported) {
      throw new NfcError("unsupported", support.reason || "NFC not supported");
    }

    const timeoutMs = options.timeoutMs ?? 45_000;
    const dedupCooldownMs = options.dedupCooldownMs ?? 2_000;

    const Ctor = (window as any).NDEFReader;
    this.reader = new Ctor();

    const internalAbort = new AbortController();
    const combinedSignal = mergeSignals(options.signal, internalAbort.signal);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        internalAbort.abort(new DOMException("NFC scan timeout", "TimeoutError"));
      }, timeoutMs);
    }

    try {
      await this.reader.scan({ signal: combinedSignal });

      return await new Promise<NfcScanResult>((resolve, reject) => {
        const onReading = (event: any) => {
          const serialNumber: string | undefined = event.serialNumber;
          const records = (event.message?.records ?? []) as any[];

          let rawPayload = "";
          const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

          for (const rec of records) {
            if ((rec.recordType === "url" || rec.recordType === "absolute-url") && decoder && rec.data) {
              rawPayload = decoder.decode(rec.data);
              break;
            }
            if (rec.recordType === "text" && !rawPayload && decoder && rec.data) {
              rawPayload = decoder.decode(rec.data);
            }
          }

          if (!rawPayload) return;

          // 스푸핑 방지: 유효한 스티커 URL만 허용
          if (!isValidStickerUrl(rawPayload, options.expectedBaseUrl)) return;

          // 중복 감지 방지
          const now = Date.now();
          if (this.lastDetectedUrl === rawPayload && now - this.lastDetectedAt < dedupCooldownMs) return;
          this.lastDetectedUrl = rawPayload;
          this.lastDetectedAt = now;

          if (timeoutId) clearTimeout(timeoutId);
          resolve({ rawPayload, serialNumber, timestamp: now });
        };

        const onReadingError = (err: any) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(new NfcError("read_error", err?.message || "NDEF read error"));
        };

        const onAbort = () => {
          if (timeoutId) clearTimeout(timeoutId);
          const reason = combinedSignal.reason;
          if (reason?.name === "TimeoutError") {
            reject(new NfcError("timeout", "Scan timed out"));
          } else {
            reject(new NfcError("aborted", "Scan aborted"));
          }
        };

        this.reader.addEventListener("reading", onReading);
        this.reader.addEventListener("readingerror", onReadingError);
        combinedSignal.addEventListener("abort", onAbort, { once: true });
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err instanceof NfcError) throw err;
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") throw new NfcError("permission_denied", "User denied NFC permission");
      if (e?.name === "NotSupportedError") throw new NfcError("unsupported", "NFC not supported");
      if (e?.name === "TimeoutError") throw new NfcError("timeout", e.message);
      if (e?.name === "AbortError") throw new NfcError("aborted", e.message);
      throw new NfcError("unknown", e?.message || String(err));
    } finally {
      this.reader = null;
    }
  }

  reset() {
    this.lastDetectedUrl = null;
    this.lastDetectedAt = 0;
  }
}

export async function writeNfcUrl(url: string, options: NfcWriteOptions = {}): Promise<void> {
  const support = detectNfcSupport();
  if (!support.supported) throw new NfcError("unsupported", "NFC not supported");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new NfcError("invalid_payload", "URL must be http(s)");
    }
  } catch (err) {
    if (err instanceof NfcError) throw err;
    throw new NfcError("invalid_payload", "Invalid URL");
  }

  const Ctor = (window as any).NDEFReader;
  const writer = new Ctor();

  try {
    await writer.write(
      { records: [{ recordType: "url", data: url }] },
      { signal: options.signal, overwrite: options.overwrite ?? true }
    );
    if (options.makeReadOnly && typeof writer.makeReadOnly === "function") {
      await writer.makeReadOnly({ signal: options.signal });
    }
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === "NotAllowedError") throw new NfcError("permission_denied", "User denied NFC permission");
    if (e?.name === "NotSupportedError") throw new NfcError("unsupported", "NFC write not supported");
    if (e?.name === "AbortError") throw new NfcError("aborted", "Write aborted");
    if (e?.name === "NetworkError") throw new NfcError("write_failed", "Tag read-only or memory insufficient");
    throw new NfcError("unknown", e?.message || String(err));
  }
}

function mergeSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (!sig) continue;
    if (sig.aborted) { controller.abort(sig.reason); break; }
    sig.addEventListener("abort", () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

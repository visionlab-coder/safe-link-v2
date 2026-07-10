// 📡 M-009 — NFC 스캔 capability 어댑터 (Web NFC / NDEFReader).
// Web NFC는 Android Chrome 한정 + HTTPS 필요. iOS/desktop → unsupported(네이티브 후속).
// 읽기 전용. SQ Link NFC 스티커(URL payload)에서 worker/site 토큰 추출.

interface NDEFRecordLike {
    recordType: string;
    mediaType?: string;
    encoding?: string;
    lang?: string;
    data?: DataView;
}
interface NDEFMessageLike { records: NDEFRecordLike[]; }
interface NDEFReadingEventLike extends Event { message: NDEFMessageLike; serialNumber?: string; }
interface NDEFReaderLike {
    scan(opts?: { signal?: AbortSignal }): Promise<void>;
    addEventListener(type: "reading", cb: (e: NDEFReadingEventLike) => void): void;
    addEventListener(type: "readingerror", cb: () => void): void;
}
interface NDEFReaderCtor { new (): NDEFReaderLike; }
declare global {
    interface Window { NDEFReader?: NDEFReaderCtor; }
}

export type NfcCapability = { supported: boolean };

export function getNfcCapability(): NfcCapability {
    return { supported: typeof window !== "undefined" && "NDEFReader" in window };
}

export type NfcRecord = { recordType: string; value: string };
export type NfcScanResult =
    | { ok: true; records: NfcRecord[]; serial?: string }
    | { ok: false; error: "unsupported" | "permission_denied" | "cancelled" | "error"; message?: string };

export async function scanNfcOnce(signal?: AbortSignal): Promise<NfcScanResult> {
    if (!getNfcCapability().supported) {
        return { ok: false, error: "unsupported", message: "Web NFC 미지원 (Android Chrome 전용; iOS는 네이티브 필요)" };
    }
    const reader = new window.NDEFReader!();
    try {
        await reader.scan(signal ? { signal } : undefined);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "nfc_error";
        if (/denied|NotAllowed/i.test(msg)) return { ok: false, error: "permission_denied", message: msg };
        return { ok: false, error: "error", message: msg };
    }
    return await new Promise<NfcScanResult>((resolve) => {
        let done = false;
        const finish = (r: NfcScanResult) => { if (!done) { done = true; resolve(r); } };
        signal?.addEventListener("abort", () => finish({ ok: false, error: "cancelled" }));
        reader.addEventListener("reading", (e) => {
            const decoder = new TextDecoder();
            const records = (e.message.records || []).map((rec) => ({
                recordType: rec.recordType,
                value: rec.data ? decoder.decode(rec.data) : "",
            }));
            finish({ ok: true, records, serial: e.serialNumber });
        });
        reader.addEventListener("readingerror", () => finish({ ok: false, error: "error", message: "tag read error" }));
    });
}

export type ParsedNfc = { kind: "worker" | "site" | "url" | "unknown"; raw: string; token?: string };

export function parseSafeLinkNfc(records: NfcRecord[]): ParsedNfc {
    const rec =
        records.find((r) => r.recordType === "url" || r.recordType === "absolute-url") ||
        records.find((r) => r.recordType === "text") ||
        records[0];
    const raw = rec?.value ?? "";
    try {
        const url = new URL(raw);
        const token = url.searchParams.get("token") || url.pathname.split("/").filter(Boolean).pop() || undefined;
        if (/\/qr\/site/.test(url.pathname) || url.searchParams.has("site")) return { kind: "site", raw, token };
        if (/\/(w|n|nfc|qr)\//.test(url.pathname)) return { kind: "worker", raw, token };
        return { kind: "url", raw, token };
    } catch {
        return { kind: "unknown", raw };
    }
}

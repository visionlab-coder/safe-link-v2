// 📷 M-007 — 카메라·QR 스캔 capability 어댑터.
// 1순위: 웹 표준 BarcodeDetector + getUserMedia (Capacitor Android WebView=Chrome 에서 동작).
// iOS WKWebView 는 BarcodeDetector 미지원 → unsupported 반환(네이티브 플러그인 후속 증분).
// 어댑터 인터페이스라 추후 @capacitor-mlkit/barcode-scanning 으로 백엔드 교체 용이.

type DetectedBarcode = { rawValue: string; format: string };
interface BarcodeDetectorLike {
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
    new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}
declare global {
    interface Window {
        BarcodeDetector?: BarcodeDetectorCtor;
    }
}

export type QrCapability = { camera: boolean; detector: boolean; supported: boolean };

export function getQrCapability(): QrCapability {
    const camera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    const detector = typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
    return { camera, detector, supported: camera && detector };
}

export type QrScanResult =
    | { ok: true; value: string }
    | { ok: false; error: "permission_denied" | "unsupported" | "cancelled" | "error"; message?: string };

/** video 엘리먼트에 카메라를 연결하고 QR 1건 감지 시 반환. signal로 취소. */
export async function scanQrOnce(video: HTMLVideoElement, signal?: AbortSignal): Promise<QrScanResult> {
    const cap = getQrCapability();
    if (!cap.supported) {
        return {
            ok: false,
            error: "unsupported",
            message: cap.camera ? "이 단말은 BarcodeDetector 미지원 (iOS는 네이티브 스캐너 필요)" : "카메라 미지원 단말",
        };
    }

    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (e) {
        return { ok: false, error: "permission_denied", message: e instanceof Error ? e.message : "카메라 권한 거부" };
    }

    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    video.srcObject = stream;
    await video.play().catch(() => undefined);

    try {
        return await new Promise<QrScanResult>((resolve) => {
            let done = false;
            const finish = (r: QrScanResult) => { if (!done) { done = true; resolve(r); } };
            signal?.addEventListener("abort", () => finish({ ok: false, error: "cancelled" }));
            const tick = async () => {
                if (done) return;
                try {
                    const codes = await detector.detect(video);
                    if (codes.length && codes[0].rawValue) return finish({ ok: true, value: codes[0].rawValue });
                } catch {
                    /* 일시 실패 → 계속 스캔 */
                }
                requestAnimationFrame(() => void tick());
            };
            requestAnimationFrame(() => void tick());
        });
    } finally {
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
    }
}

export type ParsedQr = { kind: "site" | "worker" | "url" | "unknown"; raw: string; token?: string; siteCode?: string };

/** SAFE-LINK QR 파싱 — site/worker 토큰 추출. */
export function parseSafeLinkQr(raw: string): ParsedQr {
    try {
        const url = new URL(raw);
        const last = url.pathname.split("/").filter(Boolean).pop();
        const token = url.searchParams.get("token") || last || undefined;
        if (/\/qr\/site/.test(url.pathname) || url.searchParams.has("site")) {
            return { kind: "site", raw, token, siteCode: url.searchParams.get("site") ?? undefined };
        }
        if (/\/(w|n|qr|nfc)\//.test(url.pathname)) return { kind: "worker", raw, token };
        return { kind: "url", raw, token };
    } catch {
        return { kind: "unknown", raw };
    }
}

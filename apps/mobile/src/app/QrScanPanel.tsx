import { useRef, useState } from "react";
import { getQrCapability, scanQrOnce, parseSafeLinkQr, type ParsedQr } from "../lib/capability/qr";

// 📷 M-007 — QR 스캔 최소 흐름 (권한 요청/거부/복구 + 결과 파싱)
export function QrScanPanel() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ParsedQr | null>(null);
    const [status, setStatus] = useState("");
    const cap = getQrCapability();

    const start = async () => {
        if (!videoRef.current) return;
        setResult(null); setStatus("카메라 권한 요청 중…"); setScanning(true);
        abortRef.current = new AbortController();
        const r = await scanQrOnce(videoRef.current, abortRef.current.signal);
        setScanning(false);
        if (r.ok) { setResult(parseSafeLinkQr(r.value)); setStatus("✅ 스캔 완료"); }
        else if (r.error === "permission_denied") setStatus("❌ 카메라 권한 거부 — 설정에서 허용 후 재시도");
        else if (r.error === "unsupported") setStatus(`❌ ${r.message}`);
        else if (r.error === "cancelled") setStatus("취소됨");
        else setStatus(`❌ ${r.message ?? "스캔 오류"}`);
    };
    const stop = () => { abortRef.current?.abort(); setScanning(false); };

    return (
        <section className="card">
            <div className="card-header">
                <div>
                    <p className="eyebrow">M-007 CAMERA · QR</p>
                    <h2>QR 스캔 (모바일)</h2>
                </div>
                <span className={`badge ${cap.supported ? "ready" : "setup"}`}>
                    {cap.supported ? "SUPPORTED" : "iOS/WEB LIMITED"}
                </span>
            </div>

            <video ref={videoRef} playsInline muted
                style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "4 / 3", display: scanning ? "block" : "none" }} />

            {!scanning ? (
                <button className="auth-btn" onClick={start} disabled={!cap.camera}>
                    {cap.camera ? "QR 스캔 시작" : "카메라 미지원"}
                </button>
            ) : (
                <button className="auth-btn" onClick={stop} style={{ background: "#555" }}>중지</button>
            )}

            {result && (
                <>
                    <StatusRow label="종류" value={result.kind.toUpperCase()} tone="good" />
                    {result.token && <StatusRow label="토큰" value={`${result.token.slice(0, 16)}…`} />}
                    {result.siteCode && <StatusRow label="현장" value={result.siteCode} />}
                </>
            )}
            {status && <p className="auth-status">{status}</p>}
        </section>
    );
}

function StatusRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "warn" | "neutral" }) {
    return (
        <div className="status-row">
            <span>{label}</span>
            <strong className={`tone-${tone}`}>{value}</strong>
        </div>
    );
}

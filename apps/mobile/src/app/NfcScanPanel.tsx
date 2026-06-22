import { useRef, useState } from "react";
import { getNfcCapability, scanNfcOnce, parseSafeLinkNfc, type ParsedNfc } from "../lib/capability/nfc";

// 📡 M-009 — NFC 스캔 최소 흐름 (권한/미지원 처리 + payload 파싱)
export function NfcScanPanel() {
    const abortRef = useRef<AbortController | null>(null);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ParsedNfc | null>(null);
    const [status, setStatus] = useState("");
    const cap = getNfcCapability();

    const start = async () => {
        setResult(null); setStatus("NFC 태그를 단말 뒤에 가까이 대세요…"); setScanning(true);
        abortRef.current = new AbortController();
        const r = await scanNfcOnce(abortRef.current.signal);
        setScanning(false);
        if (r.ok) { setResult(parseSafeLinkNfc(r.records)); setStatus(`✅ 태그 인식 (serial ${r.serial ?? "-"})`); }
        else if (r.error === "permission_denied") setStatus("❌ NFC 권한 거부 — 허용 후 재시도");
        else if (r.error === "unsupported") setStatus(`❌ ${r.message}`);
        else if (r.error === "cancelled") setStatus("취소됨");
        else setStatus(`❌ ${r.message ?? "NFC 오류"}`);
    };
    const stop = () => { abortRef.current?.abort(); setScanning(false); };

    return (
        <section className="card">
            <div className="card-header">
                <div>
                    <p className="eyebrow">M-009 NFC</p>
                    <h2>NFC 스캔 (모바일)</h2>
                </div>
                <span className={`badge ${cap.supported ? "ready" : "setup"}`}>{cap.supported ? "SUPPORTED" : "ANDROID ONLY"}</span>
            </div>

            {!scanning ? (
                <button className="auth-btn" onClick={start} disabled={!cap.supported}>
                    {cap.supported ? "NFC 스캔 시작" : "Web NFC 미지원 (Android Chrome 전용)"}
                </button>
            ) : (
                <button className="auth-btn" onClick={stop} style={{ background: "#555" }}>중지</button>
            )}

            {result && (
                <>
                    <StatusRow label="종류" value={result.kind.toUpperCase()} tone="good" />
                    {result.token && <StatusRow label="토큰" value={`${result.token.slice(0, 16)}…`} />}
                    <StatusRow label="원본" value={result.raw.slice(0, 40) || "-"} />
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

"use client";

// 🧪 Flitto 실시간 통역(RTT) 테스트 전용 페이지 — 운영 PoC와 완전 격리.
// 라이브 페이지(worker/admin chat·live·travel)는 이 코드를 일절 사용하지 않는다.
// 사용: .env.local 에 FLITTO_RTT_TOKEN 설정 후 로그인 상태로 /flitto-test 접속.

import { useState, useRef } from "react";
import { useFlittoRTT } from "@/hooks/useFlittoRTT";

type Line = { src: string; translations: Record<string, string>; at: number };

export default function FlittoTestPage() {
    const [targetsInput, setTargetsInput] = useState("en,ja,vi");
    const [hint, setHint] = useState("ko");
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    const [lines, setLines] = useState<Line[]>([]);
    const recStartRef = useRef<number | null>(null);   // 녹음 시작 시각(레이턴시 측정 기준)
    const lastAtRef = useRef<number>(0);

    const targetLangs = targetsInput.split(",").map(s => s.trim()).filter(Boolean);

    const { isRecording, toggle } = useFlittoRTT({
        hintLangs: [hint],
        targetLangs: targetLangs.length > 0 ? targetLangs : ["en"],
        onTranscript: (src, translations) => {
            const at = recStartRef.current ? Math.round(performance.now() - recStartRef.current) : 0;
            setLines(prev => [...prev, { src, translations: translations ?? {}, at }]);
            lastAtRef.current = at;
        },
        onStatus: (s) => {
            setStatus(s);
            if (s === "recording" && recStartRef.current === null) recStartRef.current = performance.now();
            if (s === "stopped") { recStartRef.current = null; lastAtRef.current = 0; }
        },
        onError: setError,
    });

    return (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Flitto RTT 테스트 (격리)</h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                운영 PoC와 분리된 테스트 전용. <code>.env.local</code> 의 <code>FLITTO_RTT_TOKEN</code> 필요.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13 }}>
                    원문 언어(hint)
                    <input value={hint} onChange={e => setHint(e.target.value)}
                        style={{ display: "block", marginTop: 4, padding: 6, width: 120 }} />
                </label>
                <label style={{ fontSize: 13 }}>
                    번역 대상(쉼표)
                    <input value={targetsInput} onChange={e => setTargetsInput(e.target.value)}
                        style={{ display: "block", marginTop: 4, padding: 6, width: 200 }} />
                </label>
            </div>

            <button onClick={toggle}
                style={{
                    marginTop: 16, padding: "12px 24px", fontSize: 15, fontWeight: 600,
                    color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
                    background: isRecording ? "#c0392b" : "#2e86de",
                }}>
                {isRecording ? "■ 정지" : "● 녹음 시작"}
            </button>

            <div style={{ marginTop: 12, fontSize: 13 }}>
                상태: <b>{status}</b>
                {error && <span style={{ color: "#c0392b", marginLeft: 12 }}>에러: {error}</span>}
            </div>

            <ul style={{ marginTop: 16, padding: 0, listStyle: "none" }}>
                {lines.map((l, i) => {
                    const delta = i > 0 ? l.at - lines[i - 1].at : l.at;
                    return (
                    <li key={i} style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{l.src}</span>
                            <span style={{ fontSize: 11, color: "#2e86de", whiteSpace: "nowrap" }}>
                                +{(l.at / 1000).toFixed(1)}s {i > 0 && <span style={{ color: "#999" }}>(Δ{delta}ms)</span>}
                            </span>
                        </div>
                        {Object.entries(l.translations).map(([lang, text]) => (
                            <div key={lang} style={{ fontSize: 13, color: "#555" }}>
                                <span style={{ opacity: 0.6 }}>{lang}</span> {text}
                            </div>
                        ))}
                    </li>
                    );
                })}
            </ul>
        </main>
    );
}

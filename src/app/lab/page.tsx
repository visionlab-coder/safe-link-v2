"use client";

// 🧪 SAFE-LINK Lab — 통번역 엔진/API키 런타임 스위처 (테스트 전용).
// APP_MODE=lab 환경에서만 동작. 운영 배포에는 APP_MODE 미설정 → 비활성.

import { useEffect, useState } from "react";

type Masked = {
    translateEngine?: string;
    papagoId?: string; papagoSecret?: string;
    googleKey?: string; geminiKey?: string; flittoToken?: string;
    updatedAt?: string;
};

const ENGINES = [
    { v: "", label: "자동(기존 우선순위)" },
    { v: "papago", label: "Papago (네이버)" },
    { v: "google", label: "Google Translate" },
    { v: "gemini", label: "Gemini (건설문맥)" },
    { v: "flitto", label: "Flitto" },
];

const KEY_FIELDS: { k: keyof Masked; label: string }[] = [
    { k: "papagoId", label: "Papago Client ID" },
    { k: "papagoSecret", label: "Papago Client Secret" },
    { k: "googleKey", label: "Google Cloud API Key" },
    { k: "geminiKey", label: "Gemini API Key" },
    { k: "flittoToken", label: "Flitto Token" },
];

export default function LabPage() {
    const [labMode, setLabMode] = useState<boolean | null>(null);
    const [current, setCurrent] = useState<Masked | null>(null);
    const [engine, setEngine] = useState("");
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState("");
    const [test, setTest] = useState("");

    const load = async () => {
        const r = await fetch("/api/lab/engine-config", { cache: "no-store" });
        const d = await r.json();
        setLabMode(!!d.labMode);
        setCurrent(d.config ?? null);
        setEngine(d.config?.translateEngine ?? "");
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        setMsg("저장 중…");
        // 입력한 필드만 전송(빈칸은 미전송 → 기존 유지). 명시적 삭제는 '-' 입력.
        const patch: Record<string, string> = { translateEngine: engine };
        for (const { k } of KEY_FIELDS) {
            const v = inputs[k as string];
            if (v !== undefined && v !== "") patch[k as string] = v === "-" ? "" : v;
        }
        const r = await fetch("/api/lab/engine-config", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        const d = await r.json();
        setMsg(r.ok ? "✅ 저장 완료 (즉시 적용)" : `❌ ${d.error}`);
        setInputs({});
        load();
    };

    const runTest = async () => {
        setTest("번역 중…");
        const r = await fetch("/api/translate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "안전모를 반드시 착용하세요", sl: "ko", tl: "en", fast: true, useGlossary: true }),
        });
        const d = await r.json();
        setTest(r.ok ? `[${d.engine}] ${d.translated}` : `❌ ${d.error}`);
    };

    if (labMode === null) return <main style={{ padding: 24 }}>로딩…</main>;
    if (!labMode) return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🧪 SAFE-LINK Lab</h1>
            <p style={{ color: "#c0392b", marginTop: 12 }}>
                Lab 모드 비활성. 이 환경은 <code>APP_MODE=lab</code> 이 아닙니다 (운영 보호).
                테스트하려면 Lab 배포 또는 로컬 <code>.env.local</code> 에 <code>APP_MODE=lab</code> 설정.
            </p>
        </main>
    );

    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🧪 SAFE-LINK Lab — 통번역 스위처</h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                키 변경 시 <b>재배포 없이 즉시 적용</b>. 운영과 분리된 테스트 전용. 마지막 변경: {current?.updatedAt ?? "—"}
            </p>

            <section style={{ marginTop: 20 }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>번역 엔진</label>
                <select value={engine} onChange={e => setEngine(e.target.value)}
                    style={{ display: "block", marginTop: 6, padding: 8, width: "100%" }}>
                    {ENGINES.map(e => <option key={e.v} value={e.v}>{e.label}</option>)}
                </select>
            </section>

            <section style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>API 키 (빈칸=유지, 마이너스(-)=삭제)</div>
                {KEY_FIELDS.map(({ k, label }) => (
                    <div key={k as string} style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: "#555" }}>
                            {label} {current?.[k] && <span style={{ color: "#27ae60" }}>(현재 {current[k]})</span>}
                        </label>
                        <input type="password" autoComplete="off"
                            value={inputs[k as string] ?? ""}
                            onChange={e => setInputs(p => ({ ...p, [k as string]: e.target.value }))}
                            placeholder="새 키 붙여넣기"
                            style={{ display: "block", marginTop: 3, padding: 8, width: "100%", fontFamily: "monospace" }} />
                    </div>
                ))}
            </section>

            <button onClick={save}
                style={{ marginTop: 8, padding: "12px 24px", fontSize: 15, fontWeight: 600, color: "#fff", border: "none", borderRadius: 8, background: "#2e86de", cursor: "pointer" }}>
                저장 (즉시 적용)
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}

            <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #eee" }} />
            <button onClick={runTest}
                style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "1px solid #2e86de", color: "#2e86de", background: "#fff", borderRadius: 8, cursor: "pointer" }}>
                번역 테스트 (안전모를 착용하세요 → EN)
            </button>
            {test && <div style={{ marginTop: 10, fontSize: 14, padding: 12, background: "#f6f8fa", borderRadius: 8 }}>{test}</div>}
        </main>
    );
}

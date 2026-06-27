"use client";

// 🔐 SAFE-LINK 개발자 콘솔 (/root) — "나만"(DEVELOPER_EMAILS) 전용.
// 마스터 관리자와 별개. API 키 런타임 교체 → 재배포 없이 즉시 적용. 프로덕션 상시 동작.

import { useEffect, useState } from "react";

type Masked = {
    translateEngine?: string;
    papagoId?: string; papagoSecret?: string;
    googleKey?: string; geminiKey?: string; flittoToken?: string;
    updatedAt?: string; updatedBy?: string;
};
type Audit = { at: string; by: string; engine?: string; fields: string[] };

const ENGINES = [
    { v: "", label: "자동(기존 우선순위)" },
    { v: "m2m100", label: "M2M100 (오픈소스·로컬)" },
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

const C = {
    bg: "#0f172a", surface: "#1e293b", border: "#334155",
    text: "#f1f5f9", text2: "#94a3b8", blue: "#3b82f6", green: "#10b981", red: "#ef4444",
};

export default function RootDevConsole() {
    const [developer, setDeveloper] = useState<boolean | null>(null);
    const [email, setEmail] = useState("");
    const [current, setCurrent] = useState<Masked | null>(null);
    const [audit, setAudit] = useState<Audit[]>([]);
    const [engine, setEngine] = useState("");
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState("");
    const [test, setTest] = useState("");

    const load = async () => {
        const r = await fetch("/api/root/engine-config", { cache: "no-store" });
        const d = await r.json();
        setDeveloper(!!d.developer);
        setEmail(d.email ?? "");
        setCurrent(d.config ?? null);
        setAudit(Array.isArray(d.audit) ? d.audit : []);
        setEngine(d.config?.translateEngine ?? "");
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        setMsg("저장 중…");
        const patch: Record<string, string> = { translateEngine: engine };
        for (const { k } of KEY_FIELDS) {
            const v = inputs[k as string];
            if (v !== undefined && v !== "") patch[k as string] = v === "-" ? "" : v;
        }
        const r = await fetch("/api/root/engine-config", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        const d = await r.json();
        setMsg(r.ok ? "✅ 저장 완료 — 재배포 없이 즉시 적용됨" : `❌ ${d.error}`);
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

    const shell = (children: React.ReactNode) => (
        <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>{children}</div>
        </main>
    );

    if (developer === null) return shell(<p style={{ color: C.text2 }}>로딩…</p>);
    if (!developer) return shell(
        <>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔐 접근 권한 없음</h1>
            <p style={{ color: C.red, marginTop: 12, lineHeight: 1.6 }}>
                개발자 콘솔은 <b>SAFE-LINK 개발자(DEVELOPER_EMAILS)</b>만 접근할 수 있습니다.
                마스터 관리자 권한으로도 이 페이지는 열 수 없습니다.
            </p>
        </>
    );

    const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginTop: 18 };
    const inputStyle: React.CSSProperties = { display: "block", marginTop: 4, padding: 9, width: "100%", boxSizing: "border-box", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "monospace" };

    return shell(
        <>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>🔐 개발자 콘솔 <span style={{ color: C.text2, fontWeight: 400, fontSize: 14 }}>/root</span></h1>
            <p style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>
                접속: <b style={{ color: C.green }}>{email}</b> · API 키 변경 시 <b style={{ color: C.text }}>재배포 없이 즉시 적용</b>.<br />
                마지막 변경: {current?.updatedAt ?? "—"}{current?.updatedBy ? ` · ${current.updatedBy}` : ""}
            </p>

            <section style={card}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>번역 엔진</label>
                <select value={engine} onChange={e => setEngine(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "system-ui" }}>
                    {ENGINES.map(e => <option key={e.v} value={e.v} style={{ background: C.surface }}>{e.label}</option>)}
                </select>
            </section>

            <section style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>API 키 <span style={{ color: C.text2, fontWeight: 400 }}>(빈칸=유지 · 마이너스(-)=삭제 · 현재값은 마스킹 표시)</span></div>
                {KEY_FIELDS.map(({ k, label }) => (
                    <div key={k as string} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: C.text2 }}>
                            {label} {current?.[k] && <span style={{ color: C.green }}>(현재 {current[k]})</span>}
                        </label>
                        <input type="password" autoComplete="off" value={inputs[k as string] ?? ""}
                            onChange={e => setInputs(p => ({ ...p, [k as string]: e.target.value }))}
                            placeholder="새 키 붙여넣기" style={inputStyle} />
                    </div>
                ))}
                <button onClick={save}
                    style={{ marginTop: 4, padding: "11px 22px", fontSize: 15, fontWeight: 700, color: "#fff", border: "none", borderRadius: 8, background: C.blue, cursor: "pointer" }}>
                    저장 (즉시 적용)
                </button>
                {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
            </section>

            <section style={card}>
                <button onClick={runTest}
                    style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, border: `1px solid ${C.blue}`, color: C.blue, background: "transparent", borderRadius: 8, cursor: "pointer" }}>
                    번역 테스트 (안전모를 착용하세요 → EN)
                </button>
                {test && <div style={{ marginTop: 10, fontSize: 14, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>{test}</div>}
            </section>

            <section style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🔎 변경 감사로그 <span style={{ color: C.text2, fontWeight: 400 }}>(키 값은 기록 안 함)</span></div>
                {audit.length === 0 ? (
                    <p style={{ color: C.text2, fontSize: 13 }}>변경 이력 없음</p>
                ) : (
                    <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                        {audit.map((a, i) => (
                            <div key={i} style={{ padding: "6px 0", borderBottom: i < audit.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                <span style={{ color: C.text2 }}>{a.at}</span> · <span style={{ color: C.green }}>{a.by}</span>
                                {a.engine ? ` · engine=${a.engine}` : ""}{a.fields.length ? ` · ${a.fields.join(", ")}` : ""}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

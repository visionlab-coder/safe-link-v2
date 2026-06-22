import { useState } from "react";
import { workerLogin, getTodayTbms, logout, type Tbm } from "../lib/auth/client";

// 📱 M-006 — 근로자 TBM 최소 vertical slice (이니셜+뒷4 로그인 → TBM 조회)
export function WorkerTbmPanel() {
    const [initials, setInitials] = useState("");
    const [phone4, setPhone4] = useState("");
    const [tbms, setTbms] = useState<Tbm[] | null>(null);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);

    const onLogin = async () => {
        setBusy(true); setStatus("로그인 중…");
        const r = await workerLogin(initials.trim(), phone4.trim());
        if (r.ok) { setStatus("✅ 로그인 성공"); setPhone4(""); setTbms(await getTodayTbms()); }
        else setStatus(`❌ ${r.error}`);
        setBusy(false);
    };
    const onRefresh = async () => { setTbms(await getTodayTbms()); };
    const onLogout = async () => { await logout(); setTbms(null); setStatus("로그아웃됨"); };

    return (
        <section className="card">
            <div className="card-header">
                <div>
                    <p className="eyebrow">M-006 WORKER TBM</p>
                    <h2>근로자 TBM (모바일)</h2>
                </div>
                <span className={`badge ${tbms ? "ready" : "setup"}`}>{tbms ? "SIGNED IN" : "SIGNED OUT"}</span>
            </div>

            {tbms ? (
                <>
                    {tbms.length === 0 ? (
                        <p className="auth-status">표시할 TBM이 없습니다 (현장 일치 확인).</p>
                    ) : (
                        tbms.map((t) => (
                            <div key={t.id} className="status-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                                <strong className="tone-good">{new Date(t.created_at).toLocaleString("ko-KR")}</strong>
                                <span>{t.content_ko}</span>
                            </div>
                        ))
                    )}
                    <button className="auth-btn" onClick={onRefresh}>새로고침</button>
                    <button className="auth-btn" onClick={onLogout} style={{ background: "#555" }}>로그아웃</button>
                </>
            ) : (
                <>
                    <input className="auth-input" placeholder="이니셜 (예: PSK)" value={initials}
                        autoCapitalize="characters" onChange={(e) => setInitials(e.target.value.toUpperCase())} />
                    <input className="auth-input" inputMode="numeric" placeholder="휴대폰 뒷 4자리" value={phone4}
                        onChange={(e) => setPhone4(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    <button className="auth-btn" onClick={onLogin} disabled={busy || !initials || phone4.length !== 4}>
                        {busy ? "…" : "로그인"}
                    </button>
                </>
            )}
            {status && <p className="auth-status">{status}</p>}
        </section>
    );
}

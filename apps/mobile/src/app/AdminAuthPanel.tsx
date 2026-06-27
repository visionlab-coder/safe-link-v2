import { useCallback, useEffect, useState } from "react";
import { adminLogin, getMe, logout, isAuthenticated, type MeResult } from "../lib/auth/client";

// 📱 M-005 — 모바일 admin 로그인 최소 흐름 (토큰 저장 → Bearer 주입 → me 조회 → 로그아웃)
export function AdminAuthPanel() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [me, setMe] = useState<MeResult>(null);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setMe((await isAuthenticated()) ? await getMe() : null);
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);

    const onLogin = async () => {
        setBusy(true); setStatus("로그인 중…");
        const r = await adminLogin(email.trim(), password);
        if (r.ok) { setStatus("✅ 로그인 성공"); setPassword(""); await refresh(); }
        else setStatus(`❌ ${r.error}`);
        setBusy(false);
    };

    const onLogout = async () => { await logout(); setMe(null); setStatus("로그아웃됨"); };

    return (
        <section className="card">
            <div className="card-header">
                <div>
                    <p className="eyebrow">M-005 AUTH</p>
                    <h2>관리자 로그인 (모바일)</h2>
                </div>
                <span className={`badge ${me ? "ready" : "setup"}`}>{me ? "AUTHENTICATED" : "SIGNED OUT"}</span>
            </div>

            {me ? (
                <>
                    <StatusRow label="User" value={me.user.email ?? me.user.id} tone="good" />
                    <StatusRow label="Role" value={(me.profile?.role ?? "-").toUpperCase()} />
                    <StatusRow label="Site" value={me.profile?.site_code ?? "-"} />
                    <button className="auth-btn" onClick={onLogout}>로그아웃</button>
                </>
            ) : (
                <>
                    <input className="auth-input" type="email" inputMode="email" autoComplete="username"
                        placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className="auth-input" type="password" autoComplete="current-password"
                        placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button className="auth-btn" onClick={onLogin} disabled={busy || !email || !password}>
                        {busy ? "…" : "로그인"}
                    </button>
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

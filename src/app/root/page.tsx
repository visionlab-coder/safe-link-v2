"use client";

// 🔐 SQ Link 개발자 콘솔 (/root) — "나만"(DEVELOPER_EMAILS) 전용.
// 마스터 관리자와 별개. API 키 런타임 교체 → 재배포 없이 즉시 적용. 프로덕션 상시 동작.

import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const ROOT_UI: Record<string, Record<string, string>> = {
    ko: { loading:"로딩…", denied:"🔐 접근 권한 없음", deniedDesc:"개발자 콘솔은 SQ Link 개발자(DEVELOPER_EMAILS)만 접근할 수 있습니다. 마스터 관리자 권한으로도 이 페이지는 열 수 없습니다.", console:"🔐 개발자 콘솔", access:"접속", immediate:"재배포 없이 즉시 적용", last:"마지막 변경", engine:"번역 엔진", keys:"API 키", keyHint:"빈칸=유지 · 마이너스(-)=삭제 · 현재값은 마스킹 표시", newKey:"새 키 붙여넣기", save:"저장 (즉시 적용)", saving:"저장 중…", saved:"✅ 저장 완료 — 재배포 없이 즉시 적용됨", test:"번역 테스트 (안전모를 착용하세요 → EN)", translating:"번역 중…", audit:"🔎 변경 감사로그", auditHint:"키 값은 기록 안 함", empty:"변경 이력 없음" },
    en: { loading:"Loading…", denied:"🔐 Access denied", deniedDesc:"Only SQ Link developers (DEVELOPER_EMAILS) can access this console. Master-admin access does not open this page.", console:"🔐 Developer Console", access:"Signed in", immediate:"applied immediately without redeployment", last:"Last change", engine:"Translation engine", keys:"API keys", keyHint:"Blank = keep · minus (-) = delete · current values are masked", newKey:"Paste a new key", save:"Save (apply immediately)", saving:"Saving…", saved:"✅ Saved — applied immediately without redeployment", test:"Test translation (Wear a safety helmet → EN)", translating:"Translating…", audit:"🔎 Change audit log", auditHint:"Key values are not recorded", empty:"No change history" },
    zh: { loading:"正在加载…", denied:"🔐 无访问权限", deniedDesc:"只有 SQ Link 开发者（DEVELOPER_EMAILS）可以访问此控制台。即使拥有主管理员权限也无法打开此页面。", console:"🔐 开发者控制台", access:"登录账户", immediate:"无需重新部署即可立即应用", last:"最后修改", engine:"翻译引擎", keys:"API 密钥", keyHint:"留空=保持 · 减号(-)=删除 · 当前值会遮蔽显示", newKey:"粘贴新密钥", save:"保存（立即应用）", saving:"正在保存…", saved:"✅ 已保存，无需重新部署即可立即应用", test:"测试翻译（请佩戴安全帽 → EN）", translating:"正在翻译…", audit:"🔎 变更审计日志", auditHint:"不记录密钥值", empty:"没有变更记录" },
    vi: { loading:"Đang tải…", denied:"🔐 Không có quyền truy cập", deniedDesc:"Chỉ nhà phát triển SQ Link (DEVELOPER_EMAILS) có thể truy cập bảng điều khiển này. Quyền quản trị chính cũng không mở được trang này.", console:"🔐 Bảng điều khiển nhà phát triển", access:"Tài khoản", immediate:"áp dụng ngay không cần triển khai lại", last:"Thay đổi cuối", engine:"Công cụ dịch", keys:"Khóa API", keyHint:"Để trống = giữ nguyên · dấu trừ (-) = xóa · giá trị hiện tại được che", newKey:"Dán khóa mới", save:"Lưu (áp dụng ngay)", saving:"Đang lưu…", saved:"✅ Đã lưu — áp dụng ngay không cần triển khai lại", test:"Kiểm tra dịch (Đeo mũ bảo hộ → EN)", translating:"Đang dịch…", audit:"🔎 Nhật ký kiểm toán thay đổi", auditHint:"Không ghi giá trị khóa", empty:"Không có lịch sử thay đổi" },
    ru: { loading:"Загрузка…", denied:"🔐 Нет доступа", deniedDesc:"Доступ к этой консоли имеют только разработчики SQ Link (DEVELOPER_EMAILS). Даже главный администратор не может открыть эту страницу.", console:"🔐 Консоль разработчика", access:"Учётная запись", immediate:"применяется сразу без повторного развёртывания", last:"Последнее изменение", engine:"Движок перевода", keys:"API-ключи", keyHint:"Пусто = сохранить · минус (-) = удалить · текущие значения маскируются", newKey:"Вставьте новый ключ", save:"Сохранить (применить сразу)", saving:"Сохранение…", saved:"✅ Сохранено — применено сразу без повторного развёртывания", test:"Проверить перевод (Наденьте каску → EN)", translating:"Перевод…", audit:"🔎 Журнал аудита изменений", auditHint:"Значения ключей не записываются", empty:"Нет истории изменений" },
};

type Masked = {
    translateEngine?: string;
    papagoId?: string; papagoSecret?: string;
    googleKey?: string;
    updatedAt?: string; updatedBy?: string;
};
type Audit = { at: string; by: string; engine?: string; fields: string[] };

const ENGINES = [
    { v: "", label: "자동(기존 우선순위)" },
    { v: "m2m100", label: "M2M100 (오픈소스·로컬)" },
    { v: "papago", label: "Papago (네이버)" },
    { v: "google", label: "Google Translate" },
];

const KEY_FIELDS: { k: keyof Masked; label: string }[] = [
    { k: "papagoId", label: "Papago Client ID" },
    { k: "papagoSecret", label: "Papago Client Secret" },
    { k: "googleKey", label: "Google Cloud API Key" },
];

const C = {
    bg: "#0f172a", surface: "#1e293b", border: "#334155",
    text: "#f1f5f9", text2: "#94a3b8", blue: "#3b82f6", green: "#10b981", red: "#ef4444",
};

export default function RootDevConsole() {
    const lang = useDisplayLanguage();
    const t = ROOT_UI[lang] || ROOT_UI.en;
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
        setMsg(t.saving);
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
        setMsg(r.ok ? t.saved : `❌ ${d.error}`);
        setInputs({});
        load();
    };

    const runTest = async () => {
        setTest(t.translating);
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

    if (developer === null) return shell(<p style={{ color: C.text2 }}>{t.loading}</p>);
    if (!developer) return shell(
        <>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{t.denied}</h1>
            <p style={{ color: C.red, marginTop: 12, lineHeight: 1.6 }}>
                {t.deniedDesc}
            </p>
        </>
    );

    const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginTop: 18 };
    const inputStyle: React.CSSProperties = { display: "block", marginTop: 4, padding: 9, width: "100%", boxSizing: "border-box", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "monospace" };

    return shell(
        <>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{t.console} <span style={{ color: C.text2, fontWeight: 400, fontSize: 14 }}>/root</span></h1>
            <p style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>
                {t.access}: <b style={{ color: C.green }}>{email}</b> · API {t.immediate}.<br />
                {t.last}: {current?.updatedAt ?? "—"}{current?.updatedBy ? ` · ${current.updatedBy}` : ""}
            </p>

            <section style={card}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>{t.engine}</label>
                <select value={engine} onChange={e => setEngine(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "system-ui" }}>
                    {ENGINES.map(e => <option key={e.v} value={e.v} style={{ background: C.surface }}>{e.label}</option>)}
                </select>
            </section>

            <section style={card}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.keys} <span style={{ color: C.text2, fontWeight: 400 }}>({t.keyHint})</span></div>
                {KEY_FIELDS.map(({ k, label }) => (
                    <div key={k as string} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: C.text2 }}>
                            {label} {current?.[k] && <span style={{ color: C.green }}>(현재 {current[k]})</span>}
                        </label>
                        <input type="password" autoComplete="off" value={inputs[k as string] ?? ""}
                            onChange={e => setInputs(p => ({ ...p, [k as string]: e.target.value }))}
                            placeholder={t.newKey} style={inputStyle} />
                    </div>
                ))}
                <button onClick={save}
                    style={{ marginTop: 4, padding: "11px 22px", fontSize: 15, fontWeight: 700, color: "#fff", border: "none", borderRadius: 8, background: C.blue, cursor: "pointer" }}>
                    {t.save}
                </button>
                {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
            </section>

            <section style={card}>
                <button onClick={runTest}
                    style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, border: `1px solid ${C.blue}`, color: C.blue, background: "transparent", borderRadius: 8, cursor: "pointer" }}>
                    {t.test}
                </button>
                {test && <div style={{ marginTop: 10, fontSize: 14, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>{test}</div>}
            </section>

            <section style={card}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.audit} <span style={{ color: C.text2, fontWeight: 400 }}>({t.auditHint})</span></div>
                {audit.length === 0 ? (
                    <p style={{ color: C.text2, fontSize: 13 }}>{t.empty}</p>
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

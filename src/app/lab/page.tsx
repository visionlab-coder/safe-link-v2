"use client";

// 🧪 SQ Link Lab — 통번역 엔진/API키 런타임 스위처 (테스트 전용).
// APP_MODE=lab 환경에서만 동작. 운영 배포에는 APP_MODE 미설정 → 비활성.

import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const LAB_UI: Record<string, Record<string, string>> = {
    ko: { loading:"불러오는 중…", denied:"접근 권한 없음", deniedBody:"AI 엔진·API 키 설정은 SQ Link 루트 관리자(MASTER)만 접근할 수 있습니다. 권한이 필요하면 시스템 관리자에게 문의하세요.", title:"SQ Link Lab — 통번역 스위처", desc:"키 변경 시 재배포 없이 즉시 적용됩니다. 운영과 분리된 테스트 전용입니다. 마지막 변경:", engine:"번역 엔진", auto:"자동(기존 우선순위)", local:"M2M100 (오픈소스·로컬)", keys:"API 키 (빈칸=유지, 마이너스(-)=삭제)", current:"현재", paste:"새 키 붙여넣기", save:"저장 (즉시 적용)", saving:"저장 중…", saved:"✅ 저장 완료 (즉시 적용)", test:"번역 테스트", testing:"번역 중…", testButton:"번역 테스트 (안전모를 착용하세요 → 영어)", failed:"요청 실패" },
    en: { loading:"Loading…", denied:"Access denied", deniedBody:"Only the SQ Link root administrator (MASTER) can access AI engine and API key settings. Contact the system administrator if you need access.", title:"SQ Link Lab — Translation Switcher", desc:"Changes apply immediately without redeployment. This is a test-only tool separated from production. Last updated:", engine:"Translation engine", auto:"Automatic (existing priority)", local:"M2M100 (open-source · local)", keys:"API keys (blank = keep, hyphen (-) = delete)", current:"current", paste:"Paste a new key", save:"Save (apply immediately)", saving:"Saving…", saved:"✅ Saved (applied immediately)", test:"Translation test", testing:"Translating…", testButton:"Test translation (Wear a safety helmet → English)", failed:"Request failed" },
    zh: { loading:"正在加载…", denied:"无访问权限", deniedBody:"只有 SQ Link 根管理员（MASTER）可以访问 AI 引擎和 API 密钥设置。如需权限，请联系系统管理员。", title:"SQ Link Lab — 翻译切换器", desc:"修改无需重新部署即可立即生效。这是与生产环境分离的测试工具。最后修改：", engine:"翻译引擎", auto:"自动（现有优先级）", local:"M2M100（开源·本地）", keys:"API 密钥（留空=保留，减号(-)=删除）", current:"当前", paste:"粘贴新密钥", save:"保存（立即生效）", saving:"正在保存…", saved:"✅ 已保存（立即生效）", test:"翻译测试", testing:"正在翻译…", testButton:"翻译测试（请务必佩戴安全帽 → 英语）", failed:"请求失败" },
    vi: { loading:"Đang tải…", denied:"Không có quyền truy cập", deniedBody:"Chỉ quản trị viên gốc SQ Link (MASTER) mới có thể truy cập cài đặt động cơ AI và khóa API. Hãy liên hệ quản trị viên hệ thống nếu cần quyền truy cập.", title:"SQ Link Lab — Chuyển đổi dịch", desc:"Thay đổi có hiệu lực ngay mà không cần triển khai lại. Đây là công cụ thử nghiệm tách biệt với vận hành. Lần cập nhật cuối:", engine:"Công cụ dịch", auto:"Tự động (ưu tiên hiện có)", local:"M2M100 (mã nguồn mở · cục bộ)", keys:"Khóa API (trống = giữ nguyên, dấu gạch ngang (-) = xóa)", current:"hiện tại", paste:"Dán khóa mới", save:"Lưu (áp dụng ngay)", saving:"Đang lưu…", saved:"✅ Đã lưu (áp dụng ngay)", test:"Kiểm tra dịch", testing:"Đang dịch…", testButton:"Kiểm tra dịch (Hãy đội mũ bảo hộ → tiếng Anh)", failed:"Yêu cầu thất bại" },
    ru: { loading:"Загрузка…", denied:"Нет доступа", deniedBody:"Настройки AI-движка и API-ключей доступны только корневому администратору SQ Link (MASTER). Обратитесь к системному администратору для получения доступа.", title:"SQ Link Lab — переключатель перевода", desc:"Изменения применяются сразу без повторного развёртывания. Это тестовый инструмент, отделённый от рабочей среды. Последнее изменение:", engine:"Движок перевода", auto:"Автоматически (текущий приоритет)", local:"M2M100 (open source · локально)", keys:"API-ключи (пусто = сохранить, дефис (-) = удалить)", current:"текущий", paste:"Вставьте новый ключ", save:"Сохранить (применить сразу)", saving:"Сохранение…", saved:"✅ Сохранено (применено сразу)", test:"Проверка перевода", testing:"Перевод…", testButton:"Проверить перевод (Обязательно наденьте каску → английский)", failed:"Ошибка запроса" },
};

type Masked = {
    translateEngine?: string;
    papagoId?: string; papagoSecret?: string;
    googleKey?: string;
    updatedAt?: string;
};

const ENGINES = [
    { v: "", label: "auto" },
    { v: "m2m100", label: "local" },
    { v: "papago", label: "Papago (네이버)" },
    { v: "google", label: "Google Translate" },
];

const KEY_FIELDS: { k: keyof Masked; label: string }[] = [
    { k: "papagoId", label: "Papago Client ID" },
    { k: "papagoSecret", label: "Papago Client Secret" },
    { k: "googleKey", label: "Google Cloud API Key" },
];

export default function LabPage() {
    const language = useDisplayLanguage();
    const t = LAB_UI[language] ?? LAB_UI.en;
    const [rootAdmin, setRootAdmin] = useState<boolean | null>(null);
    const [current, setCurrent] = useState<Masked | null>(null);
    const [engine, setEngine] = useState("");
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState("");
    const [test, setTest] = useState("");

    const load = async () => {
        const r = await fetch("/api/lab/engine-config", { cache: "no-store" });
        const d = await r.json();
        setRootAdmin(!!d.rootAdmin);
        setCurrent(d.config ?? null);
        setEngine(d.config?.translateEngine ?? "");
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        setMsg(t.saving);
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
        setMsg(r.ok ? t.saved : `❌ ${t.failed}: ${d.error ?? "-"}`);
        setInputs({});
        load();
    };

    const runTest = async () => {
        setTest(t.testing);
        const r = await fetch("/api/translate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "안전모를 반드시 착용하세요", sl: "ko", tl: "en", fast: true, useGlossary: true }),
        });
        const d = await r.json();
        setTest(r.ok ? `[${d.engine}] ${d.translated}` : `❌ ${t.failed}: ${d.error ?? "-"}`);
    };

    if (rootAdmin === null) return <main style={{ padding: 24 }}>{t.loading}</main>;
    if (!rootAdmin) return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔐 {t.denied}</h1>
            <p style={{ color: "#c0392b", marginTop: 12 }}>
                {t.deniedBody}
            </p>
        </main>
    );

    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🧪 {t.title}</h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {t.desc} {current?.updatedAt ?? "—"}
            </p>

            <section style={{ marginTop: 20 }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>{t.engine}</label>
                <select value={engine} onChange={e => setEngine(e.target.value)}
                    style={{ display: "block", marginTop: 6, padding: 8, width: "100%" }}>
                    {ENGINES.map(e => <option key={e.v} value={e.v}>{t[e.label]}</option>)}
                </select>
            </section>

            <section style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t.keys}</div>
                {KEY_FIELDS.map(({ k, label }) => (
                    <div key={k as string} style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: "#555" }}>
                            {label} {current?.[k] && <span style={{ color: "#27ae60" }}>({t.current} {current[k]})</span>}
                        </label>
                        <input type="password" autoComplete="off"
                            value={inputs[k as string] ?? ""}
                            onChange={e => setInputs(p => ({ ...p, [k as string]: e.target.value }))}
                            placeholder={t.paste}
                            style={{ display: "block", marginTop: 3, padding: 8, width: "100%", fontFamily: "monospace" }} />
                    </div>
                ))}
            </section>

            <button onClick={save}
                style={{ marginTop: 8, padding: "12px 24px", fontSize: 15, fontWeight: 600, color: "#fff", border: "none", borderRadius: 8, background: "#2e86de", cursor: "pointer" }}>
                {t.save}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}

            <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #eee" }} />
            <button onClick={runTest}
                style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "1px solid #2e86de", color: "#2e86de", background: "#fff", borderRadius: 8, cursor: "pointer" }}>
                {t.testButton}
            </button>
            {test && <div style={{ marginTop: 10, fontSize: 14, padding: 12, background: "#f6f8fa", borderRadius: 8 }}>{test}</div>}
        </main>
    );
}

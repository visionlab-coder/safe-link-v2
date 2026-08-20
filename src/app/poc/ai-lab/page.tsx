"use client";

import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const POC_UI: Record<string, Record<string, string>> = {
    ko: { local:"로컬 PoC", title:"AI 제공자 테스트", desc:"Google Translate와 OpenAI를 위한 로컬 전용 전환 도구입니다.", keys:"설정된 키", ready:"준비됨", missing:"미설정", test:"텍스트 번역 테스트", testing:"테스트 중...", run:"실행", latency:"응답 시간" },
    en: { local:"Local POC", title:"AI Provider Lab", desc:"Local-only switchboard for Google Translate and OpenAI.", keys:"Configured keys", ready:"READY", missing:"MISSING", test:"Text translation test", testing:"Testing...", run:"Run", latency:"Latency" },
    zh: { local:"本地 PoC", title:"AI 提供商测试", desc:"用于 Google Translate 和 OpenAI 的本地专用切换工具。", keys:"已配置密钥", ready:"已就绪", missing:"未配置", test:"文本翻译测试", testing:"正在测试...", run:"运行", latency:"响应时间" },
    vi: { local:"PoC cục bộ", title:"Kiểm tra nhà cung cấp AI", desc:"Công cụ chuyển đổi cục bộ cho Google Translate và OpenAI.", keys:"Khóa đã cấu hình", ready:"Sẵn sàng", missing:"Chưa cấu hình", test:"Kiểm tra dịch văn bản", testing:"Đang kiểm tra...", run:"Chạy", latency:"Độ trễ" },
    ru: { local:"Локальный PoC", title:"Тест AI-провайдеров", desc:"Локальный инструмент переключения для Google Translate и OpenAI.", keys:"Настроенные ключи", ready:"Готово", missing:"Не настроено", test:"Проверка перевода текста", testing:"Проверка...", run:"Запустить", latency:"Задержка" },
};

type Provider = "google" | "openai";

type StatusResponse = {
    providers?: Record<string, {
        key?: { configured: boolean; preview?: string };
        env?: string;
        model?: string;
        url?: string;
        apiUrl?: string;
    }>;
    error?: string;
};

type TranslateResponse = {
    translated?: string;
    latency_ms?: number;
    error?: string;
};

const sampleText = "안전고리를 체결하고 3층 외부 비계 작업 구간으로 이동하세요.";

export default function AiLabPage() {
    const language = useDisplayLanguage();
    const t = POC_UI[language] ?? POC_UI.en;
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [provider, setProvider] = useState<Provider>("google");
    const [sourceLang, setSourceLang] = useState("ko");
    const [targetLang, setTargetLang] = useState("en");
    const [text, setText] = useState(sampleText);
    const [result, setResult] = useState<TranslateResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch("/api/poc/ai-lab/status", { cache: "no-store" })
            .then(res => res.json())
            .then(setStatus)
            .catch(error => setStatus({ error: error instanceof Error ? error.message : "status failed" }));
    }, []);

    const runTranslate = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/poc/ai-lab/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider, text, sl: sourceLang, tl: targetLang }),
            });
            const data = await res.json();
            setResult(data);
        } catch (error) {
            setResult({ error: error instanceof Error ? error.message : "request failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="space-y-2">
                    <p className="text-xs font-black tracking-[0.24em] text-emerald-300 uppercase">{t.local}</p>
                    <h1 className="text-3xl font-black tracking-tight">{t.title}</h1>
                    <p className="text-sm text-slate-400">
                        {t.desc}
                    </p>
                </header>

                <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-black mb-3">{t.keys}</h2>
                    {status?.error && <p className="text-red-300">{status.error}</p>}
                    <div className="grid gap-3 md:grid-cols-2">
                        {Object.entries(status?.providers ?? {}).map(([name, item]) => (
                            <div key={name} className="rounded-md border border-white/10 bg-slate-900 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-black">{name}</p>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${item.key?.configured ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                                        {item.key?.configured ? t.ready : t.missing}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-400">{item.env}</p>
                                {(item.model || item.url || item.apiUrl) && (
                                    <p className="mt-1 text-xs text-slate-500">{item.model || item.url || item.apiUrl}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-black mb-4">{t.test}</h2>
                    <div className="grid gap-3 md:grid-cols-4">
                        <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="rounded-md bg-slate-900 border border-white/10 p-3">
                            <option value="openai">OpenAI</option>
                            <option value="google">Google Translate</option>
                        </select>
                        <input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="rounded-md bg-slate-900 border border-white/10 p-3" placeholder="sl" />
                        <input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="rounded-md bg-slate-900 border border-white/10 p-3" placeholder="tl" />
                        <button onClick={runTranslate} disabled={loading} className="rounded-md bg-blue-600 px-4 py-3 font-black disabled:opacity-50">
                            {loading ? t.testing : t.run}
                        </button>
                    </div>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} className="mt-4 min-h-28 w-full rounded-md bg-slate-900 border border-white/10 p-3" />
                    {result && (
                        <div className="mt-4 rounded-md border border-white/10 bg-slate-900 p-4">
                            <p className="text-xs text-slate-400">{t.latency}: {result.latency_ms ?? "-"} ms</p>
                            <p className={result.error ? "mt-2 text-red-300" : "mt-2 text-emerald-100"}>
                                {result.error || result.translated}
                            </p>
                        </div>
                    )}
                </section>

            </div>
        </main>
    );
}

"use client";

import { useEffect, useState } from "react";

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
                    <p className="text-xs font-black tracking-[0.24em] text-emerald-300 uppercase">Local POC</p>
                    <h1 className="text-3xl font-black tracking-tight">AI Provider Lab</h1>
                    <p className="text-sm text-slate-400">
                        Local-only switchboard for Google Translate and OpenAI.
                    </p>
                </header>

                <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-black mb-3">Configured Keys</h2>
                    {status?.error && <p className="text-red-300">{status.error}</p>}
                    <div className="grid gap-3 md:grid-cols-2">
                        {Object.entries(status?.providers ?? {}).map(([name, item]) => (
                            <div key={name} className="rounded-md border border-white/10 bg-slate-900 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-black">{name}</p>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${item.key?.configured ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                                        {item.key?.configured ? "READY" : "MISSING"}
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
                    <h2 className="text-lg font-black mb-4">Text Translation Test</h2>
                    <div className="grid gap-3 md:grid-cols-4">
                        <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="rounded-md bg-slate-900 border border-white/10 p-3">
                            <option value="openai">OpenAI</option>
                            <option value="google">Google Translate</option>
                        </select>
                        <input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="rounded-md bg-slate-900 border border-white/10 p-3" placeholder="sl" />
                        <input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="rounded-md bg-slate-900 border border-white/10 p-3" placeholder="tl" />
                        <button onClick={runTranslate} disabled={loading} className="rounded-md bg-blue-600 px-4 py-3 font-black disabled:opacity-50">
                            {loading ? "Testing..." : "Run"}
                        </button>
                    </div>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} className="mt-4 min-h-28 w-full rounded-md bg-slate-900 border border-white/10 p-3" />
                    {result && (
                        <div className="mt-4 rounded-md border border-white/10 bg-slate-900 p-4">
                            <p className="text-xs text-slate-400">Latency: {result.latency_ms ?? "-"} ms</p>
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

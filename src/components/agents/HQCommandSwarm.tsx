"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, BarChart3, Terminal, Zap } from "lucide-react";
import { motion } from "framer-motion";

/**
 * 🔴 HQ Command Swarm UI (Tier 1)
 * 본사 관제센터용 최상위 에이전트 군집 뷰어입니다.
 */
export default function HQCommandSwarm({ lang = "ko" }: { lang?: string }) {
    const [audit, setAudit] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAudit = async () => {
            try {
                const res = await fetch('/api/agents/hq-audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lang })
                });
                const data = await res.json();
                if (data.audit) setAudit(data.audit);
            } catch (e) {
                console.error("HQ Audit Error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchAudit();
    }, [lang]);

    return (
        <section className="col-span-1 md:col-span-2 glass rounded-[48px] p-5 sm:p-8 lg:p-10 border-indigo-500/20 shadow-[0_0_50px_-15px_rgba(99,102,241,0.2)] relative overflow-hidden bg-slate-900/40">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-indigo-600/20 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-500/30 shadow-inner">
                        <Terminal className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="flex items-center gap-2 text-xl font-black italic text-white sm:text-2xl lg:text-3xl">
                            <span className="min-w-0">HQ Swarm Intelligence</span>
                            <Zap className="w-5 h-5 shrink-0 text-amber-400 fill-amber-400" />
                        </h3>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs sm:tracking-widest">Autonomous Oversight Cluster</p>
                    </div>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                    <div className="max-w-full whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-950/50 border border-white/5 text-[10px] font-black text-indigo-400 uppercase">Watchdog Alpha</div>
                    <div className="max-w-full whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-950/50 border border-white/5 text-[10px] font-black text-purple-400 uppercase">Compliance Beta</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-black/40 rounded-[32px] p-8 border border-white/5 font-mono text-sm leading-relaxed text-indigo-100 min-h-[300px] whitespace-pre-wrap relative overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col gap-4 animate-pulse">
                            <div className="h-4 bg-white/5 rounded w-3/4" />
                            <div className="h-4 bg-white/5 rounded w-full" />
                            <div className="h-4 bg-white/5 rounded w-5/6" />
                            <div className="h-4 bg-white/5 rounded w-4/5" />
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {audit}
                        </motion.div>
                    )}
                    <div className="absolute bottom-4 right-6 text-[10px] text-slate-700 font-black uppercase">Encrypted Agent Stream :: Node_01</div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="glass p-6 rounded-[32px] border-indigo-500/10 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-indigo-400 mb-1">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Global Risk Level</span>
                        </div>
                        <div className="text-4xl font-black text-emerald-400 italic">LOW</div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div className="w-1/4 h-full bg-emerald-500" />
                        </div>
                    </div>

                    <div className="glass p-6 rounded-[32px] border-purple-500/10 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-purple-400 mb-1">
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Cross-Site Health</span>
                        </div>
                        <div className="text-4xl font-black text-white italic tracking-tighter">98.2%</div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Compliance across 25 sites</p>
                    </div>

                    <button className="mt-auto py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                        Generate Full Audit PDF
                    </button>
                </div>
            </div>
        </section>
    );
}

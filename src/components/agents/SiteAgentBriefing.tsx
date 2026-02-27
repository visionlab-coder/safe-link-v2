"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, ChevronRight, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 🟡 Site Agent Briefing UI (Tier 2)
 * 관리자 역할에 맞춰 AI 참모가 실시간 브리핑을 제공합니다.
 */
export default function SiteAgentBriefing({ role, siteId, lang = "ko" }: { role: string, siteId?: string | null, lang?: string }) {
    const [briefing, setBriefing] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBriefing = async () => {
            try {
                const res = await fetch('/api/agents/site-briefing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ site_id: siteId, role, lang })
                });
                const data = await res.json();
                if (data.briefing) {
                    setBriefing(data.briefing.split('\n').filter((l: string) => l.trim()));
                }
            } catch (e) {
                console.error("Briefing Error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchBriefing();
    }, [role, siteId, lang]);

    const personaName =
        role === 'HQ_ADMIN' ? 'Site Commander' :
            role === 'SAFETY_OFFICER' ? 'Safety Auditor' : 'Ops Assistant';

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full glass rounded-[32px] p-6 border-blue-500/20 shadow-2xl relative overflow-hidden bg-slate-900/40"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                        <Bot className="w-7 h-7" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] leading-none mb-1">AI Agent Briefing</h4>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-white italic tracking-tight">{personaName}</span>
                            <div className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-black text-emerald-400 border border-emerald-500/30 animate-pulse">ACTIVE</div>
                        </div>
                    </div>
                </div>
                {loading && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </div>

            <div className="space-y-3 relative">
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-full w-full animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse" />
                    </div>
                ) : (
                    <AnimatePresence>
                        {briefing.map((line, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex items-start gap-2.5 text-sm font-bold text-slate-100 leading-relaxed"
                            >
                                <span className="mt-1 text-blue-500"><Sparkles className="w-3.5 h-3.5" /></span>
                                <span>{line}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <div className="mt-5 flex justify-end">
                <button className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
                    Detailed Analytics <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    );
}

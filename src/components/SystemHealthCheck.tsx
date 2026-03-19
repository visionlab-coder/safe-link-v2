"use client";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HealthStatus {
    supabase: { status: string; message: string };
    google_translate: { status: string; message: string };
    google_tts: { status: string; message: string };
}

export default function SystemHealthCheck() {
    const [status, setStatus] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const checkHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/check');
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error("Health check failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkHealth();
    }, []);

    const StatusItem = ({ label, itemStatus }: { label: string, itemStatus?: { status: string, message: string } }) => {
        const isOk = itemStatus?.status === 'ok';
        return (
            <div className="flex items-center justify-between p-3 glass rounded-2xl border border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                    <span className="text-xs font-black tracking-widest text-slate-300 uppercase">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isOk ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-[10px] font-bold ${isOk ? 'text-green-500/80' : 'text-red-500'}`}>
                        {itemStatus ? (isOk ? "READY" : "ERROR") : "..."}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[32px] p-6 border-white/10 shadow-2xl bg-black/20 flex flex-col gap-4"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-blue-400">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight italic uppercase">Pre-flight Check</h3>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Monday Demo Stability Monitor</p>
                    </div>
                </div>
                <button 
                    onClick={checkHealth}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                >
                    <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatusItem label="Database" itemStatus={status?.supabase} />
                <StatusItem label="AI Translate" itemStatus={status?.google_translate} />
                <StatusItem label="Voice Engine" itemStatus={status?.google_tts} />
            </div>

            <AnimatePresence>
                {status && (Object.values(status).some(s => s.status !== 'ok')) && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl"
                    >
                        <p className="text-[10px] text-red-400 font-bold uppercase leading-tight">
                            ⚠️ Critical: One or more systems are down. Check your API keys in .env.local immediately for the Monday demo.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

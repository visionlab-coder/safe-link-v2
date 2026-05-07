"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HealthStatus {
    supabase: { status: string; message: string };
    google_translate: { status: string; message: string };
    google_tts: { status: string; message: string };
    google_stt: { status: string; message: string };
    openai: { status: string; message: string };
    naver_papago: { status: string; message: string };
    pusher: { status: string; message: string };
}

export default function SystemHealthCheck() {
    const [status, setStatus] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [consecFailures, setConsecFailures] = useState(0);
    const mountedRef = useRef(true);

    const checkHealth = useCallback(async (retry = 0): Promise<void> => {
        setLoading(true);
        try {
            const res = await fetch('/api/check', { cache: 'no-store' });
            const data = await res.json();
            if (!mountedRef.current) return;

            const anyDown = Object.values(data).some((s) => (s as { status: string }).status !== 'ok');

            // 재시도 로직: 실패 시 최대 2회 재시도 (일시적 네트워크 지연 방지)
            if (anyDown && retry < 2) {
                setTimeout(() => { if (mountedRef.current) checkHealth(retry + 1); }, 2000);
                return;
            }

            setStatus(data);
            setConsecFailures(prev => anyDown ? prev + 1 : 0);
        } catch (e) {
            console.error("Health check failed", e);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        checkHealth();
        // 30초마다 자동 재점검
        const interval = setInterval(() => checkHealth(), 30000);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // 오류 판별: 연속 2회 이상 down인 경우에만 알람 (transient 필터링)
    const anyDown = status && Object.values(status).some(s => s.status !== 'ok');
    const showAlert = anyDown && consecFailures >= 2;

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
                        <h3 className="text-lg font-black text-white tracking-tight italic uppercase">시스템 상태</h3>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">30초마다 자동 점검 · 핵심 서비스 가용성</p>
                    </div>
                </div>
                <button
                    onClick={() => checkHealth()}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                    title="수동 재점검"
                >
                    <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <StatusItem label="Database" itemStatus={status?.supabase} />
                <StatusItem label="AI Translate" itemStatus={status?.google_translate} />
                <StatusItem label="Voice TTS" itemStatus={status?.google_tts} />
                <StatusItem label="Voice STT" itemStatus={status?.google_stt} />
                <StatusItem label="OpenAI" itemStatus={status?.openai} />
                <StatusItem label="Papago" itemStatus={status?.naver_papago} />
                <StatusItem label="Pusher" itemStatus={status?.pusher} />
            </div>

            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl"
                    >
                        <p className="text-[11px] text-amber-400 font-bold leading-relaxed">
                            ⚠️ 일부 서비스 연결 지연 중 · 현장 기능에는 영향 없으며 30초 후 자동 재점검됩니다.
                            지속 시 전산팀에 문의하세요.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

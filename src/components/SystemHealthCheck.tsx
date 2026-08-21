"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getT as getAuthT } from "@/app/auth/translations";

interface HealthStatus {
    postgresql: { status: string; message: string };
    google_translate: { status: string; message: string };
    google_tts: { status: string; message: string };
    google_stt: { status: string; message: string };
    openai: { status: string; message: string };
    naver_papago: { status: string; message: string };
    realtime: { status: string; message: string };
}

const HEALTH_UI: Record<string, { title: string; subtitle: string; refresh: string; ready: string; error: string; delayed: string; services: Record<keyof HealthStatus, string> }> = {
    ko: { title: "시스템 상태", subtitle: "30초마다 자동 점검 · 핵심 서비스 가용성", refresh: "수동 재점검", ready: "정상", error: "오류", delayed: "⚠️ 일부 서비스 연결이 지연되고 있습니다. 현장 기능에는 영향이 없으며 30초 후 자동 재점검됩니다. 지속되면 전산팀에 문의해 주세요.", services: { postgresql: "PostgreSQL 데이터베이스", google_translate: "AI 번역 서비스", google_tts: "음성 안내 (TTS)", google_stt: "음성 인식 (STT)", openai: "OpenAI AI 서비스", naver_papago: "Papago 번역 서비스", realtime: "실시간 연결 서비스" } },
    en: { title: "System Status", subtitle: "Auto-check every 30 seconds · Core service availability", refresh: "Run health check", ready: "READY", error: "ERROR", delayed: "⚠️ Some services are responding slowly. Field features remain available and will be checked again in 30 seconds. Contact IT if this continues.", services: { postgresql: "PostgreSQL database", google_translate: "AI translation service", google_tts: "Voice guidance (TTS)", google_stt: "Speech recognition (STT)", openai: "OpenAI service", naver_papago: "Papago translation service", realtime: "Realtime connection service" } },
    zh: { title: "系统状态", subtitle: "每 30 秒自动检查 · 核心服务可用性", refresh: "手动检查", ready: "正常", error: "错误", delayed: "⚠️ 部分服务连接延迟。现场功能不受影响，30 秒后将自动重新检查。如持续发生，请联系技术团队。", services: { postgresql: "PostgreSQL 数据库", google_translate: "AI 翻译服务", google_tts: "语音播报 (TTS)", google_stt: "语音识别 (STT)", openai: "OpenAI 服务", naver_papago: "Papago 翻译服务", realtime: "实时连接服务" } },
    vi: { title: "Trạng thái hệ thống", subtitle: "Tự động kiểm tra mỗi 30 giây · Tình trạng dịch vụ cốt lõi", refresh: "Kiểm tra thủ công", ready: "SẴN SÀNG", error: "LỖI", delayed: "⚠️ Một số dịch vụ đang phản hồi chậm. Chức năng tại công trường vẫn hoạt động và sẽ được kiểm tra lại sau 30 giây. Vui lòng liên hệ bộ phận kỹ thuật nếu tình trạng tiếp diễn.", services: { postgresql: "Cơ sở dữ liệu PostgreSQL", google_translate: "Dịch vụ dịch AI", google_tts: "Hướng dẫn giọng nói (TTS)", google_stt: "Nhận dạng giọng nói (STT)", openai: "Dịch vụ OpenAI", naver_papago: "Dịch vụ Papago", realtime: "Dịch vụ kết nối thời gian thực" } },
    ru: { title: "Состояние системы", subtitle: "Автопроверка каждые 30 секунд · Доступность ключевых сервисов", refresh: "Проверить вручную", ready: "ГОТОВО", error: "ОШИБКА", delayed: "⚠️ Ответ некоторых сервисов задерживается. Функции объекта доступны; повторная проверка будет через 30 секунд. При длительной проблеме обратитесь в ИТ-службу.", services: { postgresql: "База данных PostgreSQL", google_translate: "Сервис AI-перевода", google_tts: "Голосовые подсказки (TTS)", google_stt: "Распознавание речи (STT)", openai: "Сервис OpenAI", naver_papago: "Сервис перевода Papago", realtime: "Сервис подключения в реальном времени" } },
};

export default function SystemHealthCheck({ lang = "ko" }: { lang?: string }) {
    const auth = getAuthT(lang);
    const fallback = {
        title: auth.adminTitle,
        subtitle: auth.adminDesc,
        refresh: auth.doEnter,
        ready: auth.doEnter,
        error: auth.noMatch,
        delayed: auth.adminDesc,
        services: {
            postgresql: "PostgreSQL", google_translate: "AI", google_tts: "TTS",
            google_stt: "STT", openai: "OpenAI", naver_papago: "Papago", realtime: "SQ-LINK",
        },
    };
    const t = { ...fallback, ...(HEALTH_UI[lang] ?? {}) };
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
            <div className="flex items-center justify-between rounded-xl border border-[#e1e8f0] bg-[#f8fafc] p-3">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                    <span className="text-xs font-black tracking-widest text-slate-700 uppercase">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isOk ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-[10px] font-bold ${isOk ? 'text-green-500/80' : 'text-red-500'}`}>
                        {itemStatus ? (isOk ? t.ready : t.error) : "..."}
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
            className="flex flex-col gap-4 rounded-xl border border-[#d9e1ea] bg-white p-6 shadow-[0_10px_28px_rgba(16,42,67,.10)]"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f2ff] text-blue-600">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black tracking-tight text-slate-900 uppercase">{t.title}</h3>
                        <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{t.subtitle}</p>
                    </div>
                </div>
                <button
                    onClick={() => checkHealth()}
                    disabled={loading}
                    className="group rounded-full p-2 transition-colors hover:bg-slate-100"
                    title={t.refresh}
                >
                    <RefreshCw className={`h-4 w-4 text-slate-400 group-hover:text-slate-800 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <StatusItem label={t.services.postgresql} itemStatus={status?.postgresql} />
                <StatusItem label={t.services.google_translate} itemStatus={status?.google_translate} />
                <StatusItem label={t.services.google_tts} itemStatus={status?.google_tts} />
                <StatusItem label={t.services.google_stt} itemStatus={status?.google_stt} />
                <StatusItem label={t.services.openai} itemStatus={status?.openai} />
                <StatusItem label={t.services.naver_papago} itemStatus={status?.naver_papago} />
                <StatusItem label={t.services.realtime} itemStatus={status?.realtime} />
            </div>

            <AnimatePresence>
                {showAlert && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl"
                    >
                        <p className="text-[11px] text-amber-400 font-bold leading-relaxed">
                            {t.delayed}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

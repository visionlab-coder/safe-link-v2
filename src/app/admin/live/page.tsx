"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { playPremiumAudio } from "@/utils/tts";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const LIVE_UI: Record<string, Record<string, string>> = {
    ko: { title:"실시간 동시통역", desc:"말하면 근로자 스마트폰에서 번역된 음성이 자동 재생됩니다.", live:"실시간 통역 방송", onAir:"방송 중", listeners:"청취자", start:"방송 시작", stop:"방송 종료", speak:"말씀하세요... 자동으로 번역됩니다", worker:"근로자", recording:"녹음 중", microphoneStopped:"마이크가 중지되었습니다", notStarted:"미시작", site:"현장", utterances:"발화", status:"상태", time:"시각", original:"한국어 원문", ended:"종료", saveFailed:"저장 실패" },
    en: { title:"Live Simultaneous Interpretation", desc:"Translated audio plays automatically on workers’ smartphones when you speak.", live:"Live interpretation broadcast", onAir:"ON AIR", listeners:"listeners", start:"START BROADCAST", stop:"STOP BROADCAST", speak:"Speak now… your words will be translated automatically", worker:"Worker", recording:"Recording", microphoneStopped:"Microphone stopped", notStarted:"Not started", site:"Site", utterances:"Utterances", status:"Status", time:"Time", original:"Korean original", ended:"Ended", saveFailed:"Save failed" },
    zh: { title:"实时同声传译", desc:"您说话时，工人手机会自动播放翻译后的语音。", live:"实时口译广播", onAir:"直播中", listeners:"听众", start:"开始广播", stop:"结束广播", speak:"请说话…系统将自动翻译", worker:"工人", recording:"录音中", microphoneStopped:"麦克风已停止", notStarted:"未开始", site:"现场", utterances:"发言", status:"状态", time:"时间", original:"韩语原文", ended:"已结束", saveFailed:"保存失败" },
    vi: { title:"Phiên dịch đồng thời trực tiếp", desc:"Khi bạn nói, âm thanh đã dịch sẽ tự động phát trên điện thoại của công nhân.", live:"Phát sóng phiên dịch trực tiếp", onAir:"ĐANG PHÁT", listeners:"người nghe", start:"BẮT ĐẦU PHÁT SÓNG", stop:"DỪNG PHÁT SÓNG", speak:"Hãy nói… nội dung sẽ được dịch tự động", worker:"Công nhân", recording:"Đang ghi âm", microphoneStopped:"Đã dừng micrô", notStarted:"Chưa bắt đầu", site:"Công trường", utterances:"Lượt phát biểu", status:"Trạng thái", time:"Thời gian", original:"Bản gốc tiếng Hàn", ended:"Đã kết thúc", saveFailed:"Lưu thất bại" },
    ru: { title:"Синхронный перевод в реальном времени", desc:"Когда вы говорите, переведённое аудио автоматически воспроизводится на телефонах работников.", live:"Эфир синхронного перевода", onAir:"В ЭФИРЕ", listeners:"слушателей", start:"НАЧАТЬ ЭФИР", stop:"ОСТАНОВИТЬ ЭФИР", speak:"Говорите… речь будет переведена автоматически", worker:"Работник", recording:"Идёт запись", microphoneStopped:"Микрофон остановлен", notStarted:"Не начато", site:"Объект", utterances:"Высказывания", status:"Статус", time:"Время", original:"Оригинал на корейском", ended:"Завершено", saveFailed:"Ошибка сохранения" },
};

const LIVE_LOCALES: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" };

function AdminLiveContent() {
    const router = useRouter();
    const lang = useDisplayLanguage();
    const t = LIVE_UI[lang] || LIVE_UI.en;
    const locale = LIVE_LOCALES[lang] || LIVE_LOCALES.en;
    const [isLive, setIsLive] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [transcripts, setTranscripts] = useState<Array<{
        text: string;
        time: string;
        role?: "admin" | "worker";
        sourceText?: string;
    }>>([]);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [listenerCount] = useState(0);
    const [sttError, setSttError] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [adminId, setAdminId] = useState("");
    const lastSentRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
    const lastWorkerResponseIdRef = useRef(0);
    const seenWorkerResponseIdsRef = useRef<Set<string>>(new Set());
    // 현장 근로자 언어 목록 — 사전 번역 대상 (ref로 관리해 useCallback 재생성 방지)
    const siteWorkerLangsRef = useRef<string[]>([]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (!res.ok) return;
            const data = await res.json() as { user?: { id: string }; profile?: { site_id?: string | null } | null };
            if (data.user?.id) setAdminId(data.user.id);
            setSiteId(data.profile?.site_id || null);
        };
        load();
    }, []);

    // siteId 확정 후 현장 근로자 언어 목록 수집 (사전 번역에 사용)
    useEffect(() => {
        const loadLangs = async () => {
            const suffix = siteId ? `?site_id=${encodeURIComponent(siteId)}` : "";
            const res = await fetch(`/api/tbm/workers${suffix}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json() as { workers?: Array<{ preferred_lang?: string | null }> };
            const langs = [...new Set(
                (data.workers || [])
                    .map((p) => p.preferred_lang)
                    .filter((lang): lang is string => Boolean(lang && lang !== "ko"))
            )];
            siteWorkerLangsRef.current = langs;
        };
        loadLangs();
    }, [siteId]);

    const handleTranscript = useCallback(async (text: string) => {
        const cleanText = text.trim().replace(/\s+/g, " ");
        if (!sessionId || !cleanText) return;
        setSttError("");

        const now = Date.now();
        if (lastSentRef.current.text === cleanText && now - lastSentRef.current.at < 10_000) {
            return;
        }
        lastSentRef.current = { text: cleanText, at: now };

        const time = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTranscripts(prev => [...prev, { text: cleanText, time }]);

        // 현장 근로자 언어로 병렬 사전 번역 — 언어당 1번만 호출 (중복 근로자 기기 절약)
        const langs = siteWorkerLangsRef.current;
        const translations: Record<string, string> = {};

        if (langs.length > 0) {
            await Promise.all(
                langs.map(async (lang) => {
                    try {
                        const res = await fetch("/api/translate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                text: cleanText,
                                sl: "ko",
                                tl: lang,
                                fast: true,
                                pronunciation: false,
                                useGlossary: true,
                            }),
                        });
                        const data = await res.json();
                        if (data.translated) translations[lang] = data.translated;
                    } catch {
                        // 번역 실패 시 근로자 기기가 개별 폴백 호출로 처리
                    }
                })
            );
        }

        const saveRes = await fetch("/api/live/translations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId,
                siteId,
                text_ko: cleanText,
                translations,
            }),
        });
        if (!saveRes.ok) {
            const err = await saveRes.json().catch(() => ({})) as { error?: string };
            setTranscripts(prev => [...prev, { text: `[${t.saveFailed}] ${err.error ?? saveRes.status}`, time }]);
            return;
        }

        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
    }, [sessionId, siteId, locale, t.saveFailed]);

    const {
        isRecording,
        audioLevel,
        toggle: toggleRecording,
        mute: muteRecording,
        unmute: unmuteRecording,
    } = useCloudSTT({
        lang: "ko",
        onTranscript: handleTranscript,
        onError: (_type, message) => setSttError(message),
        chunkInterval: 6000,   // 6s — 교육 발화는 문장이 길므로 완전한 문장 단위 전송
        silenceDuration: 2500, // 2.5s — 자연 휴지 허용, 문장 경계에서 자동 분할
        live: true,
    });

    useEffect(() => {
        if (!adminId) return;
        let cancelled = false;

        const handleResponse = (row: { id: string; sourceText: string; translatedText: string }) => {
            if (cancelled || seenWorkerResponseIdsRef.current.has(row.id)) return;
            seenWorkerResponseIdsRef.current.add(row.id);
            lastWorkerResponseIdRef.current = Math.max(lastWorkerResponseIdRef.current, Number(row.id));
            const translated = String(row.translatedText || row.sourceText || "").trim();
            if (!translated) return;
            const time = new Date().toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            setTranscripts(prev => [...prev, {
                text: translated,
                sourceText: row.sourceText,
                time,
                role: "worker",
            }]);
            muteRecording();
            playPremiumAudio(translated, "ko", "female", unmuteRecording);
        };

        const loadMissedResponses = async () => {
            const params = new URLSearchParams({ afterId: String(lastWorkerResponseIdRef.current) });
            if (siteId) params.set("siteId", siteId);
            const res = await fetch(`/api/live/worker-responses?${params.toString()}`, { cache: "no-store" });
            if (!res.ok || cancelled) return;
            const data = await res.json() as { responses?: Array<{ id: string; sourceText: string; translatedText: string }> };
            (data.responses ?? []).forEach(handleResponse);
        };

        const params = new URLSearchParams({ type: "worker-responses" });
        if (siteId) params.set("siteId", siteId);
        const events = new EventSource(`/api/live/events?${params.toString()}`);
        events.addEventListener("worker-response", event => {
            try {
                handleResponse(JSON.parse((event as MessageEvent<string>).data));
            } catch {
                // EventSource reconnects automatically; missed rows are loaded on the next mount.
            }
        });
        void loadMissedResponses();

        return () => {
            cancelled = true;
            events.close();
        };
    }, [adminId, siteId, muteRecording, unmuteRecording, locale]);

    const handleStartBroadcast = async () => {
        const newSessionId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setSessionId(newSessionId);
        lastSentRef.current = { text: "", at: 0 };
        setTranscripts([]);
        setSttError("");
        const started = await toggleRecording();
        setIsLive(started === true);
    };

    const handleStopBroadcast = () => {
        if (isRecording) toggleRecording();
        setIsLive(false);
    };

    const handleExport = async (format: ExportFormat) => {
        await exportData(format, {
            title: t.live,
            subtitle: `${sessionId || t.notStarted} / ${t.site} ${siteId || "-"} / ${new Date().toLocaleString(locale)}`,
            filename: `live_interpreter_${sessionId || "draft"}_${new Date().toISOString().slice(0, 10)}`,
            summary: [
                { label: t.utterances, value: transcripts.length },
                { label: t.listeners, value: listenerCount },
                { label: t.status, value: isLive ? t.onAir : t.ended },
            ],
            columns: [
                { key: "time", label: t.time },
                { key: "text", label: t.original },
            ],
            rows: transcripts,
            raw: { sessionId, siteId, transcripts },
        });
    };

    return (
        <RoleGuard allowedRole="admin">
            <div className="visualization-light min-h-screen font-sans flex flex-col selection:bg-blue-500/30">
                <header className="concept-page-header safe-area-sticky-top sticky z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { if (isLive) handleStopBroadcast(); router.back(); }} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black tracking-tight text-white uppercase italic">{t.live}</span>
                            {isLive && (
                                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-red-400 font-black tracking-widest">{t.onAir}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ExportMenu disabled={transcripts.length === 0} onExport={handleExport} />
                        {isLive && (
                            <div className="flex items-center gap-2 glass px-4 py-2 rounded-full border-white/5">
                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                                <span className="text-sm font-black text-green-400">{listenerCount}</span>
                                <span className="text-[10px] text-slate-500 font-black uppercase">{t.listeners}</span>
                            </div>
                        )}
                    </div>
                </header>

                <div className="admin-concept-hero relative overflow-hidden h-40 w-full">
                  <picture>
                    <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/live.webp" />
                    <Image src="/images/mobile-v3/website/live.webp" alt="Live Field Monitoring" fill className="object-cover" />
                  </picture>
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                    <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ LINK LIVE</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h2>
                    <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
                  </div>
                </div>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-3xl mx-auto w-full pb-20">
                    {!isLive ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-8">
                            <div className="w-32 h-32 glass rounded-[40px] flex items-center justify-center text-blue-400">
                                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <button
                                onClick={handleStartBroadcast}
                                className="px-16 py-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[40px] text-2xl font-black text-white shadow-[0_20px_60px_-15px_rgba(99,102,241,0.5)] tap-effect hover:scale-[1.02] transition-all"
                            >
                                {t.start}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div ref={scrollRef} className="flex-1 glass rounded-[48px] p-6 border-white/10 overflow-y-auto max-h-[60vh] flex flex-col gap-3">
                                {transcripts.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-4 text-center">
                                            <div className="flex gap-1">
                                                <span className="w-3 h-8 bg-blue-400 rounded-full animate-pulse" />
                                                <span className="w-3 h-12 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                                                <span className="w-3 h-6 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                                                <span className="w-3 h-10 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                                            </div>
                                            <p className="text-slate-500 font-bold">{t.speak}</p>
                                        </div>
                                    </div>
                                )}
                                {transcripts.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex gap-4 items-start p-4 rounded-[20px] border animate-float ${
                                            item.role === "worker"
                                                ? "bg-emerald-500/10 border-emerald-500/20"
                                                : "bg-white/5 border-white/5"
                                        }`}
                                    >
                                        <span className="text-[10px] font-black text-slate-600 whitespace-nowrap mt-1">{item.time}</span>
                                        <div className="min-w-0 flex-1">
                                            {item.role === "worker" && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                                    {t.worker}
                                                </span>
                                            )}
                                            <p className="text-lg font-bold text-white leading-relaxed">{item.text}</p>
                                            {item.role === "worker" && item.sourceText && item.sourceText !== item.text && (
                                                <p className="mt-1 text-sm font-semibold text-slate-500">{item.sourceText}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-center gap-4 py-4">
                                <div
                                    aria-hidden="true"
                                    className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.7)] transition-transform duration-75"
                                    style={{ transform: `scale(${0.85 + Math.min(1, audioLevel) * 1.8})` }}
                                />
                                <span className="text-sm font-black text-red-400 uppercase tracking-widest">
                                    {isRecording ? t.recording : t.microphoneStopped}
                                </span>
                            </div>
                            {sttError && (
                                <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                                    {sttError}
                                </div>
                            )}

                            <button
                                onClick={handleStopBroadcast}
                                className="w-full py-7 bg-red-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(239,68,68,0.4)] tap-effect hover:bg-red-500 transition-all flex items-center justify-center gap-3"
                            >
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                                {t.stop}
                            </button>
                        </>
                    )}
                </main>
            </div>
        </RoleGuard>
    );
}

export default function AdminLivePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <AdminLiveContent />
        </Suspense>
    );
}

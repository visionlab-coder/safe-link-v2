"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";

function AdminLiveContent() {
    const router = useRouter();
    const [isLive, setIsLive] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [transcripts, setTranscripts] = useState<Array<{ text: string; time: string }>>([]);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [listenerCount, setListenerCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [adminId, setAdminId] = useState("");
    const lastSentRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
    // 현장 근로자 언어 목록 — 사전 번역 대상 (ref로 관리해 useCallback 재생성 방지)
    const siteWorkerLangsRef = useRef<string[]>([]);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setAdminId(session.user.id);
                const { data: profile } = await supabase.from("profiles").select("site_id").eq("id", session.user.id).single();
                setSiteId(profile?.site_id || null);
            }
        };
        load();
    }, []);

    // siteId 확정 후 현장 근로자 언어 목록 수집 (사전 번역에 사용)
    useEffect(() => {
        if (!siteId) return;
        const supabase = createClient();
        supabase
            .from("profiles")
            .select("preferred_lang")
            .eq("site_id", siteId)
            .not("preferred_lang", "is", null)
            .then(({ data }) => {
                const langs = [...new Set(
                    (data || [])
                        .map((p: any) => p.preferred_lang as string)
                        .filter(l => l && l !== "ko")
                )];
                siteWorkerLangsRef.current = langs;
            });
    }, [siteId]);

    // Track listeners via Supabase presence — site-based fixed channel so workers can join
    useEffect(() => {
        if (!adminId) return;
        const supabase = createClient();
        const channelName = `live_audience_${siteId || 'global'}`;
        const channel = supabase.channel(channelName, { config: { presence: { key: adminId } } });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const workerCount = Object.values(state).flat().filter((p: any) => (p as any).role === 'worker').length;
                setListenerCount(workerCount);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ role: 'admin' });
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [adminId, siteId]);

    const handleTranscript = useCallback(async (text: string) => {
        const cleanText = text.trim().replace(/\s+/g, " ");
        if (!sessionId || !cleanText) return;

        const now = Date.now();
        if (lastSentRef.current.text === cleanText && now - lastSentRef.current.at < 10_000) {
            return;
        }
        lastSentRef.current = { text: cleanText, at: now };

        const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
                            body: JSON.stringify({ text: cleanText, sl: "ko", tl: lang, pronunciation: false }),
                        });
                        const data = await res.json();
                        if (data.translated) translations[lang] = data.translated;
                    } catch {
                        // 번역 실패 시 근로자 기기가 개별 폴백 호출로 처리
                    }
                })
            );
        }

        const supabase = createClient();
        const payload: any = {
            session_id: sessionId,
            text_ko: cleanText,
            created_by: adminId,
            ...(Object.keys(translations).length > 0 && { translations }),
        };
        if (siteId) payload.site_id = siteId;
        await supabase.from("live_translations").insert(payload);

        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
    }, [sessionId, siteId, adminId]);

    const { isRecording, toggle: toggleRecording } = useCloudSTT({
        lang: "ko",
        onTranscript: handleTranscript,
        chunkInterval: 6000,   // 6s — 교육 발화는 문장이 길므로 완전한 문장 단위 전송
        silenceDuration: 2500, // 2.5s — 자연 휴지 허용, 문장 경계에서 자동 분할
        live: true,
    });

    const handleStartBroadcast = () => {
        const newSessionId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setSessionId(newSessionId);
        lastSentRef.current = { text: "", at: 0 };
        setTranscripts([]);
        setIsLive(true);
        setTimeout(() => toggleRecording(), 100);
    };

    const handleStopBroadcast = () => {
        if (isRecording) toggleRecording();
        setIsLive(false);
    };

    const handleExport = async (format: ExportFormat) => {
        await exportData(format, {
            title: "라이브 통역 방송 로그",
            subtitle: `${sessionId || "미시작"} / 현장 ${siteId || "-"} / ${new Date().toLocaleString("ko-KR")}`,
            filename: `live_interpreter_${sessionId || "draft"}_${new Date().toISOString().slice(0, 10)}`,
            summary: [
                { label: "발화", value: transcripts.length },
                { label: "청취자", value: listenerCount },
                { label: "상태", value: isLive ? "ON AIR" : "종료" },
            ],
            columns: [
                { key: "time", label: "시각" },
                { key: "text", label: "한국어 원문" },
            ],
            rows: transcripts,
            raw: { sessionId, siteId, transcripts },
        });
    };

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { if (isLive) handleStopBroadcast(); router.back(); }} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black tracking-tight text-white uppercase italic">Live Interpreter</span>
                            {isLive && (
                                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-red-400 font-black tracking-widest">ON AIR</span>
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
                                <span className="text-[10px] text-slate-500 font-black uppercase">listeners</span>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-3xl mx-auto w-full pb-20">
                    {!isLive ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-8">
                            <div className="w-32 h-32 glass rounded-[40px] flex items-center justify-center text-blue-400">
                                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">실시간 동시통역</h2>
                                <p className="text-slate-500 font-bold mt-2">말하면 근로자 스마트폰에서 자동으로 번역된 음성이 재생됩니다</p>
                            </div>
                            <button
                                onClick={handleStartBroadcast}
                                className="px-16 py-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[40px] text-2xl font-black text-white shadow-[0_20px_60px_-15px_rgba(99,102,241,0.5)] tap-effect hover:scale-[1.02] transition-all"
                            >
                                START BROADCAST
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
                                            <p className="text-slate-500 font-bold">말씀하세요... 자동으로 번역됩니다</p>
                                        </div>
                                    </div>
                                )}
                                {transcripts.map((item, idx) => (
                                    <div key={idx} className="flex gap-4 items-start p-4 bg-white/5 rounded-[20px] border border-white/5 animate-float">
                                        <span className="text-[10px] font-black text-slate-600 whitespace-nowrap mt-1">{item.time}</span>
                                        <p className="text-lg font-bold text-white leading-relaxed">{item.text}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-center gap-4 py-4">
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="w-1.5 bg-red-500 rounded-full animate-pulse" style={{ height: `${12 + Math.random() * 20}px`, animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </div>
                                <span className="text-sm font-black text-red-400 uppercase tracking-widest">Recording</span>
                            </div>

                            <button
                                onClick={handleStopBroadcast}
                                className="w-full py-7 bg-red-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(239,68,68,0.4)] tap-effect hover:bg-red-500 transition-all flex items-center justify-center gap-3"
                            >
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                                STOP BROADCAST
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

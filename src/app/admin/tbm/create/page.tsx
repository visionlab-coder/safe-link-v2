"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import { Suspense } from "react";
import { normalizeKo, normalizeKoAsync } from "@/utils/normalize";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import SafetyLibraryModal from "@/components/SafetyLibraryModal";

const adminUI: Record<string, any> = {
    ko: {
        title: "안전 브리핑 전파",
        subtitle: "현장 근로자 전원에게 즉시 전송",
        smartAssist: "AI 스마트 어시스트",
        generateTips: "AI 가이드 생성",
        processing: "처리 중...",
        koreanDraft: "한국어 초안",
        voiceInput: "음성 입력",
        listening: "듣고 있습니다...",
        placeholder: "오늘의 안전 수칙을 입력하세요...",
        normResult: "현장 은어 정규화 결과",
        changes: "개 변환됨",
        pushBtn: "📡 TBM 브로드캐스트",
        historyTitle: "최근 발송 이력",
        noHistory: "발송 이력이 없습니다.",
        pushSuccess: "전파 완료",
        back: "뒤로",
        previewNorm: "은어 자동 교정 미리보기",
        recTime: "녹음 중",
        library: "기초교육 라이브러리",
        libraryDesc: "위험성평가 항목 불러오기"
    },
    en: {
        title: "SAFETY BROADCAST",
        subtitle: "Instantly Push to Workers",
        smartAssist: "SMART-ASSIST",
        generateTips: "Generate AI Tips",
        processing: "Processing...",
        koreanDraft: "Korean Draft",
        voiceInput: "VOICE INPUT",
        listening: "LISTENING...",
        placeholder: "Enter daily safety rules...",
        normResult: "Normalization Result",
        changes: "Changes",
        pushBtn: "🚀 PUSH BROADCAST",
        historyTitle: "Recent History",
        noHistory: "No Broadcast History",
        pushSuccess: "Push Successful",
        back: "Back",
        previewNorm: "Auto-correction Preview",
        recTime: "Recording",
        library: "Safety Library",
        libraryDesc: "Load risk assessment items"
    },
    zh: {
        title: "安全简报发布",
        subtitle: "立即推送到全体员工",
        smartAssist: "AI智能助手",
        generateTips: "生成AI指南",
        processing: "处理中...",
        koreanDraft: "韩语草案",
        voiceInput: "语音输入",
        listening: "正在倾听...",
        placeholder: "输入今日安全守则...",
        normResult: "现场俚语规范化结果",
        changes: "项已转换",
        pushBtn: "📡 TBM 广播广播",
        historyTitle: "最近发送历史",
        noHistory: "暂无发送历史",
        pushSuccess: "发布成功",
        back: "返回",
        previewNorm: "自动校正预览",
        recTime: "录音中",
        library: "基础教育资料库",
        libraryDesc: "加载危险评估项目"
    }
};

const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

function AdminTBMCreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tbmText, setTbmText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiTips, setAiTips] = useState<string[]>([]);
    const [normalizeResult, setNormalizeResult] = useState<{ normalized: string; changes: { from: string; to: string }[] } | null>(null);
    const [adminLang, setAdminLang] = useState("ko");
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female');

    const changeGender = (g: 'male' | 'female') => {
        voiceGenderRef.current = g;
        setVoiceGender(g);
    };

    const urlLang = searchParams.get("lang");

    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [adminSiteId, setAdminSiteId] = useState<string | null>(null);

    const loadProfile = useCallback(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from("profiles").select("preferred_lang, site_id").eq("id", session.user.id).single();
            let finalLang = profile?.preferred_lang || "ko";

            if (urlLang && urlLang !== profile?.preferred_lang) {
                await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
                finalLang = urlLang;
            }
            setAdminLang(finalLang);
            setAdminSiteId(profile?.site_id || null);
        }
    }, [urlLang]);

    const fetchHistory = useCallback(async () => {
        const supabase = createClient();
        let query = supabase
            .from("tbm_notices")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);
        // 본사 관리자(site_id 없음)는 전체, 현장 관리자는 자기 현장만
        if (adminSiteId) query = query.eq("site_id", adminSiteId);
        const { data } = await query;
        if (data) setHistory(data);
    }, [adminSiteId]);

    useEffect(() => {
        loadProfile();
        fetchHistory();
    }, [loadProfile, fetchHistory]);

    const handleLibrarySelect = useCallback((text: string) => {
        setTbmText((prev) => {
            const base = prev.trim();
            return base ? base + "\n\n" + text : text;
        });
    }, []);

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true);
        setAiTips([]);
        try {
            const contextText = tbmText.trim();
            const res = await fetch("/api/tbm/ai-tips", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ context: contextText }),
            });
            const data = await res.json();
            if (data.error) {
                console.error("[AI-Tips] API Error:", data.error);
                alert(`AI 서비스 오류: ${data.error}`);
                setAiTips([]);
            } else {
                setAiTips(data.tips || []);
            }
        } catch (e: any) {
            console.error("[AI-Tips] Fetch failed:", e);
            alert("AI 연결에 실패했습니다. 인터넷 연결을 확인해주세요.");
        } finally {
            setIsGeneratingAI(false);
        }
    };


    // ── 정규화 미리보기 (디바운스) ──
    const [previewChanges, setPreviewChanges] = useState<{ from: string; to: string }[]>([]);
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        if (!tbmText.trim()) {
            setPreviewChanges([]);
            return;
        }
        previewTimerRef.current = setTimeout(() => {
            const { changes } = normalizeKo(tbmText.trim());
            setPreviewChanges(changes);
        }, 500);
        return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
    }, [tbmText]);

    const [sttError, setSttError] = useState<string | null>(null);

    const handleTranscript = useCallback((text: string) => {
        setSttError(null);
        setTbmText((prev) => {
            const base = prev.trim();
            return base ? base + " " + text : text;
        });
    }, []);

    const handleSTTError = useCallback((type: string, message: string) => {
        setSttError(message);
        setTimeout(() => setSttError(null), 5000);
    }, []);

    const { isRecording, toggle: toggleRecording } = useCloudSTT({
        lang: adminLang,
        onTranscript: handleTranscript,
        onError: handleSTTError,
    });

    // ── 녹음 경과 시간 (isRecording 선언 후) ──
    const [recSeconds, setRecSeconds] = useState(0);
    const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isRecording) {
            setRecSeconds(0);
            recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
        } else {
            if (recTimerRef.current) clearInterval(recTimerRef.current);
            recTimerRef.current = null;
            setRecSeconds(0);
        }
        return () => { if (recTimerRef.current) clearInterval(recTimerRef.current); };
    }, [isRecording]);

    const formatRecTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const handleSendTBM = async () => {
        if (!tbmText.trim()) return;
        setIsSending(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
            const { normalized, changes } = await normalizeKoAsync(tbmText.trim());
            setNormalizeResult({ normalized, changes });
            const payload: any = { content_ko: normalized, created_by: session.user.id };
            if ((profile as any)?.site_id) payload.site_id = (profile as any).site_id;
            const { error } = await supabase.from("tbm_notices").insert(payload);
            if (!error) {
                setTbmText("");
                fetchHistory();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(adminLang);

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">Safe-Link</span>
                                <span className="px-2 py-0.5 bg-blue-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Admin</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 shadow-inner">
                            <button
                                onClick={() => changeGender('male')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                MALE
                            </button>
                            <button
                                onClick={() => changeGender('female')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                FEMALE
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-3xl mx-auto w-full pb-20">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-4xl font-black text-white text-gradient tracking-tighter uppercase">{t.title}</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t.subtitle}</p>
                    </div>

                    <section className="glass rounded-[40px] p-8 border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all duration-1000" />
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-lg font-black text-white flex items-center gap-3 italic font-mono">
                                <span className="w-2 h-6 bg-purple-500 rounded-full" />
                                {t.smartAssist}
                            </h3>
                            <button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl text-xs font-black shadow-lg tap-effect disabled:opacity-50 tracking-widest uppercase">
                                {isGeneratingAI ? t.processing : t.generateTips}
                            </button>
                        </div>
                        {aiTips.length > 0 && (
                            <div className="flex flex-col gap-3 animate-float">
                                {aiTips.map((tip, idx) => (
                                    <button key={idx} onClick={() => { setTbmText(tip); setAiTips([]); }} className="text-left p-5 glass rounded-2xl text-slate-300 hover:text-white hover:bg-white/5 border-white/5 transition-all text-sm md:text-base tap-effect leading-relaxed">
                                        {tip}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 기초교육 라이브러리 섹션 */}
                    <section className="glass rounded-[40px] p-8 border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-green-500/10 blur-[60px] rounded-full -ml-16 -mt-16 group-hover:bg-green-500/20 transition-all duration-1000" />
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-white flex items-center gap-3 italic font-mono">
                                <span className="w-2 h-6 bg-green-500 rounded-full" />
                                {t.library}
                            </h3>
                            <button
                                onClick={() => setIsLibraryOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl text-xs font-black shadow-lg tap-effect tracking-widest uppercase"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                {t.libraryDesc}
                            </button>
                        </div>
                    </section>

                    <section className="flex flex-col flex-1 gap-6">
                        <div className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6 relative min-h-[400px]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">{t.koreanDraft}</h3>
                                <button onClick={toggleRecording} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all tap-effect relative ${isRecording ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "glass border-white/10 text-slate-400 hover:text-white"}`}>
                                    {isRecording && (
                                        <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        {isRecording ? (
                                            <>
                                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                {t.recTime} {formatRecTime(recSeconds)}
                                            </>
                                        ) : t.voiceInput}
                                    </span>
                                </button>
                            </div>
                            {sttError && (
                                <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold animate-float">
                                    {sttError}
                                </div>
                            )}
                            <textarea
                                value={tbmText}
                                onChange={(e) => setTbmText(e.target.value)}
                                placeholder={isRecording ? `${t.listening} [${adminLang}]` : t.placeholder}
                                className="flex-1 w-full bg-transparent text-2xl md:text-3xl font-bold text-white placeholder-slate-800 outline-none resize-none leading-snug tracking-tight"
                            />

                            {/* 실시간 정규화 미리보기 (전송 전) */}
                            {previewChanges.length > 0 && !normalizeResult && (
                                <div className="p-4 glass rounded-[24px] border-blue-500/20 bg-blue-500/[0.03] animate-float">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.previewNorm}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">{previewChanges.length} {t.changes}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {previewChanges.map((c, i) => (
                                            <div key={i} className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 text-xs font-bold">
                                                <span className="text-red-400/70 line-through decoration-red-500/50">{c.from}</span>
                                                <span className="text-slate-600">→</span>
                                                <span className="text-green-400">{c.to}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 전송 후 정규화 결과 */}
                            {normalizeResult && (
                                <div className="p-5 glass rounded-[28px] border-amber-500/20 bg-amber-500/[0.03]">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t.normResult}</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{normalizeResult.changes.length} {t.changes}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {normalizeResult.changes.map((c, i) => (
                                            <div key={i} className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 text-xs font-bold">
                                                <span className="text-red-400/70 line-through decoration-red-500/50">{c.from}</span>
                                                <span className="text-slate-600">→</span>
                                                <span className="text-green-400">{c.to}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                                <button onClick={handleSendTBM} disabled={isSending || tbmText.length === 0} className="w-full py-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-[32px] text-2xl font-black text-slate-950 shadow-[0_20px_50px_-15px_rgba(59,130,246,0.4)] tap-effect flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale transition-all">
                                    {isSending ? <div className="w-8 h-8 border-4 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>{t.pushBtn}</>}
                                </button>
                                <button
                                    onClick={() => router.push("/admin/chat")}
                                    className="w-full py-5 glass rounded-[28px] border-white/10 text-slate-300 hover:text-white hover:border-green-500/30 hover:bg-green-500/5 transition-all tap-effect flex items-center justify-center gap-3 group"
                                >
                                    <svg className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span className="font-black text-lg tracking-tight">
                                        {adminLang === "ko" ? "1:1 대화 바로가기" : adminLang === "zh" ? "进入1对1对话" : "Go to 1:1 Chat"}
                                    </span>
                                    <svg className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="mt-8 flex flex-col gap-6">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] px-4">{t.historyTitle}</h3>
                        <div className="flex flex-col gap-4">
                            {history.length === 0 ? (
                                <div className="p-12 glass rounded-[40px] border-dashed border-white/5 text-center text-slate-600 font-bold italic uppercase tracking-widest">{t.noHistory}</div>
                            ) : (
                                history.map((tbm) => (
                                    <div key={tbm.id} className="glass p-6 rounded-[32px] border-white/5 hover:border-white/10 transition-all group flex flex-col gap-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <p className="text-lg text-slate-300 font-bold leading-relaxed">{tbm.content_ko}</p>
                                            <button onClick={() => { setTbmText(tbm.content_ko); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-blue-500 hover:bg-blue-500/10 transition-colors flex-shrink-0 tap-effect">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            <span>{new Date(tbm.created_at).toLocaleString()}</span>
                                            <span className="w-1 h-1 bg-slate-800 rounded-full" />
                                            <span className="text-blue-900">{t.pushSuccess}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </main>
                <SafetyLibraryModal
                    isOpen={isLibraryOpen}
                    onClose={() => setIsLibraryOpen(false)}
                    onSelect={handleLibrarySelect}
                    lang={adminLang}
                />
            </div>
        </RoleGuard>
    );
}

export default function AdminTBMCreate() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <AdminTBMCreateContent />
        </Suspense>
    );
}

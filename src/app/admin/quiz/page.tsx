"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";

function AdminQuizContent() {
    const router = useRouter();
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState<any>(null);
    const [responses, setResponses] = useState<any[]>([]);
    const [siteId, setSiteId] = useState<string | null>(null);

    const loadActiveQuiz = useCallback(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase.from("profiles").select("site_id").eq("id", session.user.id).single();
        setSiteId(profile?.site_id || null);

        let query = supabase.from("safety_quizzes").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1);
        if (profile?.site_id) query = query.eq("site_id", profile.site_id);
        const { data } = await query;

        if (data && data.length > 0) {
            setActiveQuiz(data[0]);
            const { data: resps } = await supabase.from("quiz_responses").select("*").eq("quiz_id", data[0].id);
            setResponses(resps || []);
        }
    }, []);

    useEffect(() => {
        loadActiveQuiz();
    }, [loadActiveQuiz]);

    // Realtime responses
    useEffect(() => {
        if (!activeQuiz) return;
        const supabase = createClient();
        const channel = supabase
            .channel("quiz_responses_realtime")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "quiz_responses", filter: `quiz_id=eq.${activeQuiz.id}` },
                (payload) => { setResponses(prev => [...prev, payload.new]); }
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activeQuiz]);

    const handlePublish = async () => {
        if (!question.trim() || options.some(o => !o.trim())) return;
        setIsSending(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Deactivate previous quizzes
            if (siteId) {
                await supabase.from("safety_quizzes").update({ is_active: false }).eq("site_id", siteId).eq("is_active", true);
            } else {
                await supabase.from("safety_quizzes").update({ is_active: false }).eq("is_active", true);
            }

            const payload: any = {
                question_ko: question.trim(),
                options: options.map(o => o.trim()),
                correct_index: correctIndex,
                created_by: session.user.id,
                is_active: true,
            };
            if (siteId) payload.site_id = siteId;

            const { data, error } = await supabase.from("safety_quizzes").insert(payload).select().single();
            if (!error && data) {
                setActiveQuiz(data);
                setResponses([]);
                setQuestion("");
                setOptions(["", "", "", ""]);
            }
        } catch (e) {
            console.error("[Quiz] Error:", e);
        } finally {
            setIsSending(false);
        }
    };

    const handleEndQuiz = async () => {
        if (!activeQuiz) return;
        const supabase = createClient();
        await supabase.from("safety_quizzes").update({ is_active: false }).eq("id", activeQuiz.id);
        setActiveQuiz(null);
        setResponses([]);
    };

    const correctCount = responses.filter(r => r.is_correct).length;
    const totalCount = responses.length;
    const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // Per-option breakdown
    const optionCounts = activeQuiz ? activeQuiz.options.map((_: string, idx: number) => responses.filter(r => r.selected_index === idx).length) : [];

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black tracking-tight text-white uppercase italic">Safety Quiz</span>
                            <span className="px-2 py-0.5 bg-purple-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Live</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-3xl mx-auto w-full pb-20">
                    {/* Active Quiz Results */}
                    {activeQuiz && (
                        <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-black text-green-400 uppercase tracking-widest">Live Results</span>
                                </div>
                                <button onClick={handleEndQuiz} className="px-4 py-2 glass rounded-full text-xs font-black text-red-400 hover:bg-red-500/10 tap-effect">
                                    End Quiz
                                </button>
                            </div>

                            <h2 className="text-2xl font-black text-white leading-tight">{activeQuiz.question_ko}</h2>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-[24px] p-4 text-center">
                                    <span className="text-3xl font-black text-white">{totalCount}</span>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Responses</p>
                                </div>
                                <div className="bg-green-500/10 rounded-[24px] p-4 text-center border border-green-500/20">
                                    <span className="text-3xl font-black text-green-400">{correctRate}%</span>
                                    <p className="text-[10px] font-black text-green-500/60 uppercase tracking-widest mt-1">Correct</p>
                                </div>
                                <div className="bg-red-500/10 rounded-[24px] p-4 text-center border border-red-500/20">
                                    <span className="text-3xl font-black text-red-400">{totalCount - correctCount}</span>
                                    <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest mt-1">Wrong</p>
                                </div>
                            </div>

                            {/* Per-option Bar Chart */}
                            <div className="flex flex-col gap-3">
                                {activeQuiz.options.map((opt: string, idx: number) => {
                                    const count = optionCounts[idx] || 0;
                                    const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                                    const isCorrect = idx === activeQuiz.correct_index;
                                    return (
                                        <div key={idx} className={`rounded-2xl p-4 border ${isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`text-sm font-black ${isCorrect ? 'text-green-400' : 'text-slate-300'}`}>
                                                    {isCorrect && "✓ "}{opt}
                                                </span>
                                                <span className="text-xs font-black text-slate-500">{count} ({pct}%)</span>
                                            </div>
                                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isCorrect ? 'bg-green-500' : 'bg-slate-600'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Create New Quiz */}
                    {!activeQuiz && (
                        <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-8 bg-purple-500 rounded-full" />
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">New Quiz</h2>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Question (Korean)</label>
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="안전 퀴즈 질문을 입력하세요..."
                                    className="w-full h-28 bg-white/5 border border-white/10 rounded-[24px] p-5 text-white text-lg font-bold placeholder:text-slate-700 resize-none focus:outline-none focus:border-purple-500/50"
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Options (tap to mark correct)</label>
                                {options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <button
                                            onClick={() => setCorrectIndex(idx)}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${correctIndex === idx ? 'bg-green-500 text-white shadow-lg' : 'bg-white/5 text-slate-600 border border-white/10'}`}
                                        >
                                            {correctIndex === idx ? "✓" : idx + 1}
                                        </button>
                                        <input
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...options];
                                                newOpts[idx] = e.target.value;
                                                setOptions(newOpts);
                                            }}
                                            placeholder={`Option ${idx + 1}`}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white font-bold placeholder:text-slate-700 focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handlePublish}
                                disabled={isSending || !question.trim() || options.some(o => !o.trim())}
                                className="w-full py-7 bg-gradient-to-br from-purple-500 to-blue-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(147,51,234,0.4)] tap-effect disabled:opacity-30 transition-all"
                            >
                                {isSending ? "Publishing..." : "PUBLISH QUIZ"}
                            </button>
                        </section>
                    )}
                </main>
            </div>
        </RoleGuard>
    );
}

export default function AdminQuizPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <AdminQuizContent />
        </Suspense>
    );
}

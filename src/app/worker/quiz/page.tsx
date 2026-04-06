"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";

const i18n: Record<string, Record<string, string>> = {
    ko: { title: "안전 퀴즈", noQuiz: "현재 진행 중인 퀴즈가 없습니다", correct: "정답입니다!", wrong: "오답입니다", correctAnswer: "정답", back: "돌아가기", alreadyAnswered: "이미 응답했습니다", waiting: "번역 중..." },
    en: { title: "SAFETY QUIZ", noQuiz: "No active quiz right now", correct: "Correct!", wrong: "Wrong answer", correctAnswer: "Correct answer", back: "Back", alreadyAnswered: "Already answered", waiting: "Translating..." },
    zh: { title: "安全测验", noQuiz: "目前没有进行中的测验", correct: "回答正确！", wrong: "回答错误", correctAnswer: "正确答案", back: "返回", alreadyAnswered: "已经回答过了", waiting: "翻译中..." },
    vi: { title: "BAI KIEM TRA", noQuiz: "Hien khong co bai kiem tra", correct: "Dung roi!", wrong: "Sai roi", correctAnswer: "Dap an dung", back: "Quay lai", alreadyAnswered: "Da tra loi", waiting: "Dang dich..." },
    th: { title: "แบบทดสอบ", noQuiz: "ไม่มีแบบทดสอบ", correct: "ถูกต้อง!", wrong: "ผิด", correctAnswer: "คำตอบที่ถูก", back: "กลับ", alreadyAnswered: "ตอบแล้ว", waiting: "กำลังแปล..." },
};
const getT = (lang: string) => i18n[lang] || i18n["en"];

export default function WorkerQuizPage() {
    const router = useRouter();
    const [lang, setLang] = useState("ko");
    const [profile, setProfile] = useState<any>(null);
    const [quiz, setQuiz] = useState<any>(null);
    const [translatedQ, setTranslatedQ] = useState("");
    const [translatedOpts, setTranslatedOpts] = useState<string[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [alreadyAnswered, setAlreadyAnswered] = useState(false);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
            setProfile(prof);
            const workerLang = prof?.preferred_lang || "ko";
            setLang(workerLang);

            // Fetch active quiz
            let query = supabase.from("safety_quizzes").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1);
            if (prof?.site_id) query = query.eq("site_id", prof.site_id);
            const { data: quizzes } = await query;

            if (!quizzes || quizzes.length === 0) return;
            const activeQuiz = quizzes[0];
            setQuiz(activeQuiz);

            // Check if already answered
            const { data: existing } = await supabase.from("quiz_responses").select("*").eq("quiz_id", activeQuiz.id).eq("worker_id", session.user.id).limit(1);
            if (existing && existing.length > 0) {
                setAlreadyAnswered(true);
                setSelectedIndex(existing[0].selected_index);
                setIsCorrect(existing[0].is_correct);
            }

            // Translate if needed
            if (workerLang !== 'ko') {
                setIsTranslating(true);
                try {
                    const res = await fetch("/api/quiz", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ question: activeQuiz.question_ko, options: activeQuiz.options, targetLang: workerLang }),
                    });
                    const data = await res.json();
                    setTranslatedQ(data.question || activeQuiz.question_ko);
                    setTranslatedOpts(data.options || activeQuiz.options);
                } catch {
                    setTranslatedQ(activeQuiz.question_ko);
                    setTranslatedOpts(activeQuiz.options);
                } finally {
                    setIsTranslating(false);
                }
            } else {
                setTranslatedQ(activeQuiz.question_ko);
                setTranslatedOpts(activeQuiz.options);
            }
        };
        load();
    }, []);

    const t = getT(lang);

    const handleAnswer = async (idx: number) => {
        if (selectedIndex !== null || !quiz || !profile) return;
        setSelectedIndex(idx);
        const correct = idx === quiz.correct_index;
        setIsCorrect(correct);

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.from("quiz_responses").insert({
            quiz_id: quiz.id,
            worker_id: session.user.id,
            worker_name: profile.display_name || "Worker",
            selected_index: idx,
            is_correct: correct,
            lang,
        });
    };

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-6 pb-12 font-sans">
                <header className="flex items-center gap-4">
                    <button onClick={() => router.push("/worker")} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-black tracking-tight uppercase italic text-gradient">{t.title}</h1>
                </header>

                {!quiz && !isTranslating && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="glass rounded-[48px] p-16 text-center border-white/5">
                            <p className="text-xl text-slate-500 font-bold">{t.noQuiz}</p>
                        </div>
                    </div>
                )}

                {isTranslating && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-400 font-bold">{t.waiting}</span>
                        </div>
                    </div>
                )}

                {quiz && !isTranslating && (
                    <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-8">
                        {/* Question */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Question</span>
                            <h2 className="text-2xl font-black text-white leading-tight">{translatedQ}</h2>
                            {lang !== 'ko' && (
                                <p className="text-sm text-slate-500 font-bold mt-1">{quiz.question_ko}</p>
                            )}
                        </div>

                        {/* Options */}
                        <div className="flex flex-col gap-3">
                            {translatedOpts.map((opt, idx) => {
                                const isSelected = selectedIndex === idx;
                                const isAnswer = quiz.correct_index === idx;
                                const showResult = selectedIndex !== null;

                                let btnClass = "glass border-white/10 text-white";
                                if (showResult && isAnswer) {
                                    btnClass = "bg-green-500/20 border-green-500/50 text-green-400";
                                } else if (showResult && isSelected && !isCorrect) {
                                    btnClass = "bg-red-500/20 border-red-500/50 text-red-400";
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        disabled={selectedIndex !== null}
                                        className={`w-full p-6 rounded-[24px] border text-left font-black text-lg transition-all tap-effect ${btnClass} ${selectedIndex === null ? 'hover:bg-white/5 active:scale-95' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${showResult && isAnswer ? 'bg-green-500 text-white' : showResult && isSelected ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                                                {showResult && isAnswer ? "✓" : showResult && isSelected ? "✗" : idx + 1}
                                            </span>
                                            <span className="flex-1">{opt}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Result Feedback */}
                        {selectedIndex !== null && (
                            <div className={`p-6 rounded-[28px] text-center ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                <p className={`text-3xl font-black ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                    {isCorrect ? t.correct : t.wrong}
                                </p>
                                {!isCorrect && (
                                    <p className="text-sm text-slate-400 font-bold mt-2">
                                        {t.correctAnswer}: {translatedOpts[quiz.correct_index]}
                                    </p>
                                )}
                            </div>
                        )}

                        {alreadyAnswered && selectedIndex !== null && (
                            <p className="text-center text-slate-500 text-sm font-bold">{t.alreadyAnswered}</p>
                        )}
                    </section>
                )}

                <button onClick={() => router.push("/worker")} className="w-full py-5 glass rounded-[24px] border-white/10 text-slate-400 font-black tap-effect mt-auto">
                    {t.back}
                </button>
            </div>
        </RoleGuard>
    );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, XCircle, Brain, ChevronRight } from "lucide-react";

const i18n: Record<string, Record<string, string>> = {
  ko: {
    title: "안전 퀴즈", noQuiz: "현재 진행 중인 퀴즈가 없습니다",
    correct: "정답입니다!", wrong: "오답입니다", correctAnswer: "정답",
    back: "돌아가기", alreadyAnswered: "이미 응답 완료", waiting: "퀴즈 불러오는 중...",
    submit: "제출하기", score: "점수", outOf: "개 중", correct2: "개 정답",
    selectAll: "모든 문항에 답하세요", question: "문항", of: "/",
    result: "결과", excellent: "우수", good: "양호", tryAgain: "재교육 권장",
  },
  en: {
    title: "SAFETY QUIZ", noQuiz: "No active quiz right now",
    correct: "Correct!", wrong: "Wrong", correctAnswer: "Correct answer",
    back: "Back", alreadyAnswered: "Already submitted", waiting: "Loading quiz...",
    submit: "Submit", score: "Score", outOf: "out of", correct2: "correct",
    selectAll: "Answer all questions", question: "Question", of: "/",
    result: "Result", excellent: "Excellent", good: "Good", tryAgain: "Re-training recommended",
  },
  zh: {
    title: "安全测验", noQuiz: "目前没有进行中的测验",
    correct: "回答正确！", wrong: "回答错误", correctAnswer: "正确答案",
    back: "返回", alreadyAnswered: "已提交", waiting: "加载测验中...",
    submit: "提交", score: "分数", outOf: "共", correct2: "题正确",
    selectAll: "请回答所有题目", question: "题", of: "/",
    result: "结果", excellent: "优秀", good: "良好", tryAgain: "建议再培训",
  },
  vi: {
    title: "BÀI KIỂM TRA", noQuiz: "Không có bài kiểm tra nào",
    correct: "Đúng rồi!", wrong: "Sai rồi", correctAnswer: "Đáp án đúng",
    back: "Quay lại", alreadyAnswered: "Đã nộp bài", waiting: "Đang tải...",
    submit: "Nộp bài", score: "Điểm số", outOf: "trên", correct2: "câu đúng",
    selectAll: "Trả lời tất cả câu hỏi", question: "Câu", of: "/",
    result: "Kết quả", excellent: "Xuất sắc", good: "Tốt", tryAgain: "Khuyến nghị đào tạo lại",
  },
  th: {
    title: "แบบทดสอบ", noQuiz: "ไม่มีแบบทดสอบ",
    correct: "ถูกต้อง!", wrong: "ผิด", correctAnswer: "คำตอบที่ถูก",
    back: "กลับ", alreadyAnswered: "ส่งแล้ว", waiting: "กำลังโหลด...",
    submit: "ส่งคำตอบ", score: "คะแนน", outOf: "จาก", correct2: "ข้อถูก",
    selectAll: "ตอบทุกข้อ", question: "ข้อ", of: "/",
    result: "ผล", excellent: "ยอดเยี่ยม", good: "ดี", tryAgain: "แนะนำให้อบรมซ้ำ",
  },
  id: {
    title: "KUIS KESELAMATAN", noQuiz: "Tidak ada kuis aktif",
    correct: "Benar!", wrong: "Salah", correctAnswer: "Jawaban benar",
    back: "Kembali", alreadyAnswered: "Sudah dikirim", waiting: "Memuat kuis...",
    submit: "Kirim", score: "Skor", outOf: "dari", correct2: "benar",
    selectAll: "Jawab semua pertanyaan", question: "Soal", of: "/",
    result: "Hasil", excellent: "Sangat Baik", good: "Baik", tryAgain: "Disarankan pelatihan ulang",
  },
};
const getT = (lang: string) => i18n[lang] ?? i18n["en"];

type TranslatedQuestion = { question: string; options: string[] };
type QuizResponse = {
  id: string;
  lang: string;
  questions_translated: TranslatedQuestion[];
  answer_index_correct: number[];
  answers_submitted: number[] | null;
  score_pct: number | null;
  status: string;
  answered_at: string | null;
};

export default function WorkerQuizPage() {
  const router = useRouter();
  const [lang, setLang] = useState("ko");
  const [quizResponse, setQuizResponse] = useState<QuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; correct: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("preferred_lang")
        .eq("id", session.user.id)
        .maybeSingle();

      const workerLang = (prof as { preferred_lang?: string } | null)?.preferred_lang ?? "ko";
      setLang(workerLang);

      const { data: responses } = await supabase
        .from("tbm_quiz_responses")
        .select("id, lang, questions_translated, answer_index_correct, answers_submitted, score_pct, status, answered_at")
        .eq("worker_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (responses) {
        const qr = responses as QuizResponse;
        setQuizResponse(qr);
        if (qr.status === "answered") {
          setSubmitted(true);
          const total = qr.answer_index_correct.length;
          setResult({ scorePct: qr.score_pct ?? 0, correct: Math.round(((qr.score_pct ?? 0) / 100) * total), total });
          setSelectedAnswers(qr.answers_submitted ?? new Array(total).fill(null));
        } else {
          setSelectedAnswers(new Array(qr.questions_translated.length).fill(null));
        }
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const t = getT(lang);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => prev.map((v, i) => (i === qIdx ? optIdx : v)));
  };

  const handleSubmit = async () => {
    if (!quizResponse || submitting) return;
    const unanswered = selectedAnswers.some((a) => a === null);
    if (unanswered) { alert(t.selectAll); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quiz/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizResponseId: quizResponse.id, answers: selectedAnswers }),
      });
      const data = await res.json() as { ok?: boolean; scorePct?: number; correct?: number; total?: number; error?: string; score_pct?: number };
      if (res.ok && data.ok) {
        setResult({ scorePct: data.scorePct ?? 0, correct: data.correct ?? 0, total: data.total ?? 0 });
        setSubmitted(true);
      } else if (res.status === 409) {
        setSubmitted(true);
        const total = quizResponse.answer_index_correct.length;
        setResult({ scorePct: data.score_pct ?? 0, correct: Math.round(((data.score_pct ?? 0) / 100) * total), total });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-purple-400 animate-pulse" />
          <p className="text-gray-400 text-sm">{t.waiting}</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRole="worker">
      <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-6 pb-24 font-sans">
        <header className="flex items-center gap-4">
          <button onClick={() => router.push("/worker")} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-black tracking-tight uppercase italic text-gradient">{t.title}</h1>
        </header>

        {!quizResponse && (
          <div className="flex-1 flex items-center justify-center">
            <div className="glass rounded-[48px] p-16 text-center border-white/5">
              <Brain className="w-16 h-16 text-purple-400/40 mx-auto mb-4" />
              <p className="text-xl text-slate-500 font-bold">{t.noQuiz}</p>
            </div>
          </div>
        )}

        {quizResponse && !submitted && (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-purple-400 font-black uppercase tracking-widest">
                {quizResponse.questions_translated.length}{t.question}
              </span>
              <span className="text-xs text-slate-600 font-bold">
                {selectedAnswers.filter((a) => a !== null).length} {t.of} {quizResponse.questions_translated.length}
              </span>
            </div>

            <div className="flex flex-col gap-6">
              {quizResponse.questions_translated.map((q, qIdx) => (
                <section key={qIdx} className="glass rounded-[32px] p-6 border-white/10 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-black shrink-0 mt-0.5">
                      {qIdx + 1}
                    </span>
                    <h2 className="text-lg font-black text-white leading-snug">{q.question}</h2>
                  </div>
                  <div className="flex flex-col gap-2 pl-11">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[qIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelect(qIdx, optIdx)}
                          className={`w-full p-4 rounded-[18px] border text-left font-bold text-base transition-all tap-effect
                            ${isSelected
                              ? "bg-purple-500/20 border-purple-500/60 text-purple-300"
                              : "glass border-white/10 text-slate-300 hover:bg-white/5"}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0
                              ${isSelected ? "bg-purple-500 text-white" : "bg-white/10 text-slate-500"}`}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || selectedAnswers.some((a) => a === null)}
              className="w-full py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-2
                bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600
                text-white transition-all tap-effect"
            >
              {t.submit}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {quizResponse && submitted && result && (
          <div className="flex-1 flex flex-col gap-6">
            <div className={`glass rounded-[48px] p-10 flex flex-col items-center gap-6 border
              ${result.scorePct >= 80 ? "border-green-500/30" : result.scorePct >= 60 ? "border-yellow-500/30" : "border-red-500/30"}`}>
              <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black
                ${result.scorePct >= 80 ? "bg-green-500/20 text-green-400" : result.scorePct >= 60 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                {result.scorePct}%
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black
                  ${result.scorePct >= 80 ? "text-green-400" : result.scorePct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                  {result.scorePct >= 80 ? t.excellent : result.scorePct >= 60 ? t.good : t.tryAgain}
                </p>
                <p className="text-slate-400 text-sm font-bold mt-2">
                  {result.total}{t.outOf} {result.correct}{t.correct2}
                </p>
              </div>
            </div>

            {quizResponse.questions_translated.map((q, qIdx) => {
              const correctIdx = quizResponse.answer_index_correct[qIdx];
              const myAnswer = selectedAnswers[qIdx] ?? null;
              const isCorrect = myAnswer === correctIdx;
              return (
                <div key={qIdx} className={`glass rounded-[28px] p-5 border
                  ${isCorrect ? "border-green-500/20" : "border-red-500/20"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    {isCorrect
                      ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                    <p className="text-sm font-bold text-white">{q.question}</p>
                  </div>
                  <p className="text-xs text-slate-500 font-bold pl-8">
                    {t.correctAnswer}: <span className="text-green-400">{q.options[correctIdx]}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => router.push("/worker")} className="w-full py-4 glass rounded-[24px] border-white/10 text-slate-400 font-black tap-effect">
          {t.back}
        </button>
      </div>
    </RoleGuard>
  );
}

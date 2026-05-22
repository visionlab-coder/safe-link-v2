"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";

type Phase = "select" | "generating" | "preview" | "sending" | "live" | "daily_sending";

interface TbmSession {
  id: string;
  title: string | null;
  started_at: string;
  status: string;
  tbm_notices: { content_ko: string | null; title: string | null } | null;
}

interface GeneratedQuestion {
  id: string;
  keyword: string;
  question_ko: string;
  options_ko: string[];
  answer_index: number;
  included: boolean;
}

interface LiveResponse {
  id: string;
  worker_id: string;
  lang: string;
  status: string;
  submitted_at: string | null;
}

function AdminQuizContent() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select");
  const [tbmSessions, setTbmSessions] = useState<TbmSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TbmSession | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [liveResponses, setLiveResponses] = useState<LiveResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quizSource, setQuizSource] = useState<"tbm" | "fallback" | null>(null);

  const loadSessions = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("site_id")
      .eq("id", session.user.id)
      .single();

    let query = supabase
      .from("nfc_tbm_sessions")
      .select("id, title, started_at, status, tbm_notices(content_ko, title)")
      .order("started_at", { ascending: false })
      .limit(10);

    if (profile?.site_id) query = query.eq("site_id", profile.site_id);

    const { data } = await query;
    setTbmSessions((data as unknown as TbmSession[]) ?? []);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleGenerate = async () => {
    if (!selectedSession) return;
    setPhase("generating");
    setError(null);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tbmSessionId: selectedSession.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generation_failed");
      const qs: GeneratedQuestion[] = (data.questions ?? []).map(
        (q: Omit<GeneratedQuestion, "included">) => ({ ...q, included: true })
      );
      setQuestions(qs);
      setQuizSessionId(data.quizSessionId ?? null);
      setQuizSource(data.source ?? null);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패. 다시 시도하세요.");
      setPhase("select");
    }
  };

  const handleSend = async () => {
    if (!quizSessionId) return;
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/quiz/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizSessionId, tbmSessionId: selectedSession?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send_failed");
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "발송 실패. 다시 시도하세요.");
      setPhase("preview");
    }
  };

  const resetFlow = () => {
    setPhase("select");
    setSelectedSession(null);
    setQuestions([]);
    setQuizSessionId(null);
    setLiveResponses([]);
    setError(null);
    setQuizSource(null);
  };

  const handleDailyQuiz = async () => {
    setPhase("daily_sending");
    setError(null);
    try {
      const res = await fetch("/api/quiz/daily", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "daily_quiz_failed");
      if (data.quizSessionId) {
        setQuizSessionId(data.quizSessionId);
        setQuizSource(data.source ?? null);
      }
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "자동 출제 실패. 다시 시도하세요.");
      setPhase("select");
    }
  };

  // Realtime live responses
  useEffect(() => {
    if (phase !== "live" || !quizSessionId) return;
    const supabase = createClient();

    supabase
      .from("tbm_quiz_responses")
      .select("id, worker_id, lang, status, submitted_at")
      .eq("quiz_session_id", quizSessionId)
      .then(({ data }) => setLiveResponses((data as LiveResponse[]) ?? []));

    const channel = supabase
      .channel("tbm_quiz_live")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tbm_quiz_responses",
        filter: `quiz_session_id=eq.${quizSessionId}`,
      }, (payload) => {
        const updated = payload.new as LiveResponse;
        setLiveResponses(prev => {
          const idx = prev.findIndex(r => r.id === updated.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phase, quizSessionId]);

  const answeredCount = liveResponses.filter(r => r.status === "answered").length;
  const totalSent = liveResponses.length;

  const handleExport = async (format: ExportFormat) => {
    const rows = phase === "live"
      ? liveResponses.map((response) => ({
          type: "response",
          id: response.id,
          worker: response.worker_id,
          lang: response.lang,
          status: response.status,
          submitted_at: response.submitted_at ?? "",
        }))
      : questions.map((question, index) => ({
          type: "question",
          id: question.id,
          worker: `${index + 1}`,
          lang: question.keyword,
          status: question.included ? "included" : "excluded",
          submitted_at: question.question_ko,
        }));

    await exportData(format, {
      title: "안전 퀴즈 리포트",
      subtitle: `${selectedSession?.title ?? selectedSession?.id ?? "선택 세션"} / ${new Date().toLocaleString("ko-KR")}`,
      filename: `safety_quiz_${quizSessionId || selectedSession?.id || "draft"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "문항", value: questions.length },
        { label: "발송", value: totalSent },
        { label: "응답", value: answeredCount },
        { label: "응답률", value: totalSent > 0 ? `${Math.round((answeredCount / totalSent) * 100)}%` : "0%" },
      ],
      columns: [
        { key: "type", label: "구분" },
        { key: "id", label: "ID" },
        { key: "worker", label: "근로자/번호" },
        { key: "lang", label: "언어/키워드" },
        { key: "status", label: "상태" },
        { key: "submitted_at", label: "내용/제출시각" },
      ],
      rows,
      raw: { selectedSession, quizSessionId, questions, liveResponses },
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
        <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white uppercase italic">Safety Quiz</span>
            <span className="px-2 py-0.5 bg-purple-500 text-[10px] font-black rounded text-white tracking-widest uppercase">AI</span>
          </div>
          {phase === "live" && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-black text-green-400 uppercase tracking-widest">Live</span>
            </span>
          )}
          {(questions.length > 0 || liveResponses.length > 0) && (
            <div className={phase === "live" ? "ml-3" : "ml-auto"}>
              <ExportMenu onExport={handleExport} />
            </div>
          )}
        </header>

        <div className="relative overflow-hidden h-40 w-full">
          <Image
            src="/images/safelink-pages/quiz-worker-training.png"
            alt="Safety Quiz"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>

        <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-3xl mx-auto w-full pb-20">

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 text-red-400 text-sm font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* PHASE: select */}
          {phase === "select" && (
            <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2.5 h-8 bg-purple-500 rounded-full" />
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">TBM 선택</h2>
                </div>
                <p className="text-slate-500 text-sm ml-5">최근 TBM 교육 내용에서 AI가 퀴즈를 자동으로 생성합니다</p>
              </div>

              <div className="flex flex-col gap-2">
                {tbmSessions.length === 0 && (
                  <p className="text-slate-600 text-sm text-center py-8">TBM 세션이 없습니다</p>
                )}
                {tbmSessions.map(s => {
                  const isSelected = selectedSession?.id === s.id;
                  const hasContent = !!s.tbm_notices?.content_ko;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`flex items-center justify-between rounded-2xl px-5 py-4 text-left border transition-all tap-effect ${
                        isSelected
                          ? "bg-purple-500/20 border-purple-500/50"
                          : "bg-white/5 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div>
                        <p className="font-black text-white text-sm">
                          {s.title ?? s.id.slice(0, 8) + "…"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(s.started_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          <span className={s.status === "running" ? "text-green-400" : "text-slate-500"}>{s.status}</span>
                        </p>
                        {!hasContent && (
                          <p className="text-[10px] text-yellow-500 mt-0.5">⚠️ TBM 내용 없음 (발화 기록 기반 생성)</p>
                        )}
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedSession}
                className="w-full py-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(147,51,234,0.4)] tap-effect disabled:opacity-30 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 문제 자동 생성
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-600 font-bold">또는</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={handleDailyQuiz}
                className="w-full py-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[32px] text-base font-black text-white shadow-[0_20px_50px_-15px_rgba(245,158,11,0.35)] tap-effect transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                오늘의 퀴즈 3문제 자동 출제
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">TBM 없으면 예시 출제</span>
              </button>
            </section>
          )}

          {/* PHASE: generating */}
          {phase === "generating" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">AI 퀴즈 생성 중...</p>
                <p className="text-slate-500 text-sm mt-2">TBM 교육 공지 + 현장 발화 내용을 분석해 문제를 출제합니다 (약 10~20초)</p>
              </div>
            </section>
          )}

          {/* PHASE: preview */}
          {phase === "preview" && (
            <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-8 bg-green-500 rounded-full" />
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                    생성된 문제{" "}
                    <span className="text-green-400">{questions.length}</span>
                  </h2>
                </div>
                <button
                  onClick={resetFlow}
                  className="text-xs text-slate-500 hover:text-white tap-effect px-3 py-1 rounded-full glass"
                >
                  다시 선택
                </button>
              </div>
              {quizSource === "fallback" && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300 font-bold">
                  📋 TBM 내용이 없어 예시 안전 문제로 출제됐습니다. TBM 작성 후 재생성하면 맞춤 문제가 출제됩니다.
                </div>
              )}

              <div className="flex flex-col gap-4">
                {questions.map((q, qi) => (
                  <div
                    key={q.id}
                    className={`rounded-2xl p-5 border transition-all ${
                      q.included ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-40"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-1 rounded-full shrink-0">
                        {q.keyword}
                      </span>
                      <button
                        onClick={() =>
                          setQuestions(prev =>
                            prev.map((pq, i) => i === qi ? { ...pq, included: !pq.included } : pq)
                          )
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                          q.included ? "bg-green-500 text-white" : "bg-white/10 text-slate-600"
                        }`}
                      >
                        {q.included ? "✓" : "×"}
                      </button>
                    </div>
                    <p className="text-white font-bold mb-3">{q.question_ko}</p>
                    <div className="flex flex-col gap-2">
                      {q.options_ko.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`rounded-xl px-4 py-2.5 text-sm ${
                            oi === q.answer_index
                              ? "bg-green-500/20 border border-green-500/40 text-green-300 font-bold"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {oi === q.answer_index && "✓ "}
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {!quizSessionId && (
                <p className="text-xs text-yellow-500 text-center">⚠️ 퀴즈 세션 ID 없음 — 발송 불가. TBM 세션을 재선택하세요.</p>
              )}

              <button
                onClick={handleSend}
                disabled={!questions.some(q => q.included) || !quizSessionId}
                className="w-full py-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(34,197,94,0.4)] tap-effect disabled:opacity-30 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                근로자 전원에게 발송
              </button>
            </section>
          )}

          {/* PHASE: daily_sending */}
          {phase === "daily_sending" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">오늘의 퀴즈 생성 + 발송 중...</p>
                <p className="text-slate-500 text-sm mt-2">오늘의 TBM 내용으로 3문제를 생성하고 근로자 전원에게 발송합니다</p>
              </div>
            </section>
          )}

          {/* PHASE: sending */}
          {phase === "sending" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">번역 후 발송 중...</p>
                <p className="text-slate-500 text-sm mt-2">근로자 모국어로 번역하여 개별 발송합니다</p>
              </div>
            </section>
          )}

          {/* PHASE: live */}
          {phase === "live" && (
            <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-green-400 uppercase tracking-widest">실시간 응답</span>
                </div>
                <button
                  onClick={resetFlow}
                  className="px-4 py-2 glass rounded-full text-xs font-black text-slate-400 hover:bg-white/5 tap-effect"
                >
                  새 퀴즈
                </button>
              </div>

              <h2 className="text-lg font-black text-white">
                {selectedSession?.title ?? selectedSession?.id.slice(0, 8)}
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-[24px] p-4 text-center">
                  <span className="text-3xl font-black text-white">{totalSent}</span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">발송</p>
                </div>
                <div className="bg-blue-500/10 rounded-[24px] p-4 text-center border border-blue-500/20">
                  <span className="text-3xl font-black text-blue-400">{answeredCount}</span>
                  <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mt-1">응답</p>
                </div>
                <div className="bg-purple-500/10 rounded-[24px] p-4 text-center border border-purple-500/20">
                  <span className="text-3xl font-black text-purple-400">
                    {totalSent > 0 ? Math.round((answeredCount / totalSent) * 100) : 0}%
                  </span>
                  <p className="text-[10px] font-black text-purple-500/60 uppercase tracking-widest mt-1">응답률</p>
                </div>
              </div>

              {liveResponses.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-6">근로자 응답 대기 중...</p>
              )}

              <div className="flex flex-col gap-2">
                {liveResponses.map(r => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 border ${
                      r.status === "answered"
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-white/5 border-white/5"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-white font-bold">{r.worker_id.slice(0, 12)}…</p>
                      <p className="text-xs text-slate-500">{r.lang.toUpperCase()}</p>
                    </div>
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full ${
                        r.status === "answered"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {r.status === "answered" ? "응답 완료" : "대기"}
                    </span>
                  </div>
                ))}
              </div>
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

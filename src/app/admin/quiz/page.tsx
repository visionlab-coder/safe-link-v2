"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const QUIZ_UI: Record<string, Record<string, string>> = {
  ko: { title:"안전 퀴즈", desc:"TBM 내용을 기반으로 안전 이해도를 확인합니다.", generated:"생성 실패. 다시 시도하세요.", sentFailed:"발송 실패. 다시 시도하세요.", dailyFailed:"자동 출제 실패. 다시 시도하세요.", report:"안전 퀴즈 리포트", selected:"선택 세션", questions:"문항", sent:"발송", responses:"응답", rate:"응답률", category:"구분", worker:"근로자/번호", language:"언어/키워드", status:"상태", content:"내용/제출시각", select:"TBM 선택", selectDesc:"최근 TBM 교육 내용에서 AI가 퀴즈를 자동으로 생성합니다", noSession:"TBM 세션이 없습니다", noContent:"⚠️ TBM 내용 없음 (발화 기록 기반 생성)", generate:"AI 문제 자동 생성", or:"또는", daily:"오늘의 퀴즈 3문제 자동 출제", fallbackBadge:"TBM 없으면 예시 출제", generating:"AI 퀴즈 생성 중...", generatingDesc:"TBM 교육 공지와 현장 발화 내용을 분석해 문제를 출제합니다 (약 10~20초)", generatedQuestions:"생성된 문제", reselect:"다시 선택", fallback:"📋 TBM 내용이 없어 예시 안전 문제로 출제됐습니다. TBM 작성 후 재생성하면 맞춤 문제가 출제됩니다.", missingId:"⚠️ 퀴즈 세션 ID 없음 — 발송 불가. TBM 세션을 재선택하세요.", sendAll:"근로자 전원에게 발송", dailySending:"오늘의 퀴즈 생성 + 발송 중...", dailySendingDesc:"오늘의 TBM 내용으로 3문제를 생성하고 근로자 전원에게 발송합니다", sending:"번역 후 발송 중...", sendingDesc:"근로자 모국어로 번역하여 개별 발송합니다", live:"실시간 응답", newQuiz:"새 퀴즈", waiting:"근로자 응답 대기 중...", complete:"응답 완료", pending:"대기", issued:"출제 문제 및 정답" },
  en: { title:"Safety Quiz", desc:"Check safety understanding based on TBM content.", generated:"Generation failed. Please try again.", sentFailed:"Sending failed. Please try again.", dailyFailed:"Automatic quiz generation failed. Please try again.", report:"Safety Quiz Report", selected:"Selected session", questions:"Questions", sent:"Sent", responses:"Responses", rate:"Response rate", category:"Category", worker:"Worker/number", language:"Language/keyword", status:"Status", content:"Content/submitted at", select:"Select TBM", selectDesc:"AI automatically creates a quiz from recent TBM training.", noSession:"No TBM sessions.", noContent:"⚠️ No TBM content (generated from speech records)", generate:"Generate AI questions", or:"or", daily:"Automatically issue 3 daily quiz questions", fallbackBadge:"Use examples when no TBM exists", generating:"Generating AI quiz...", generatingDesc:"Analyzing TBM notices and site speech to create questions (about 10–20 seconds)", generatedQuestions:"Generated questions", reselect:"Select again", fallback:"📋 No TBM content was available, so example safety questions were generated. Create a TBM and regenerate for tailored questions.", missingId:"⚠️ No quiz session ID — cannot send. Select the TBM session again.", sendAll:"Send to all workers", dailySending:"Generating and sending today’s quiz...", dailySendingDesc:"Creating 3 questions from today’s TBM and sending them to all workers", sending:"Translating and sending...", sendingDesc:"Translated and sent individually in each worker’s native language", live:"Live responses", newQuiz:"New quiz", waiting:"Waiting for worker responses...", complete:"Answered", pending:"Waiting", issued:"Issued questions and answers" },
  zh: { title:"安全测验", desc:"根据 TBM 内容确认安全理解度。", generated:"生成失败，请重试。", sentFailed:"发送失败，请重试。", dailyFailed:"自动出题失败，请重试。", report:"安全测验报告", selected:"已选择会话", questions:"题目", sent:"已发送", responses:"回答", rate:"回答率", category:"分类", worker:"工人/编号", language:"语言/关键词", status:"状态", content:"内容/提交时间", select:"选择 TBM", selectDesc:"AI 会根据最近的 TBM 培训自动生成测验。", noSession:"没有 TBM 会话。", noContent:"⚠️ 没有 TBM 内容（基于语音记录生成）", generate:"自动生成 AI 题目", or:"或", daily:"自动出今日 3 道测验题", fallbackBadge:"无 TBM 时使用示例题", generating:"正在生成 AI 测验...", generatingDesc:"正在分析 TBM 公告和现场语音以生成题目（约 10–20 秒）", generatedQuestions:"已生成题目", reselect:"重新选择", fallback:"📋 没有 TBM 内容，因此生成了示例安全题。创建 TBM 后重新生成可获得定制题目。", missingId:"⚠️ 没有测验会话 ID，无法发送。请重新选择 TBM 会话。", sendAll:"发送给全体工人", dailySending:"正在生成并发送今日测验...", dailySendingDesc:"根据今日 TBM 生成 3 道题并发送给全体工人", sending:"正在翻译并发送...", sendingDesc:"翻译成每位工人的母语后分别发送", live:"实时回答", newQuiz:"新测验", waiting:"正在等待工人回答...", complete:"已回答", pending:"等待中", issued:"已出题目及答案" },
  vi: { title:"Câu hỏi an toàn", desc:"Kiểm tra mức độ hiểu an toàn dựa trên nội dung TBM.", generated:"Tạo thất bại. Hãy thử lại.", sentFailed:"Gửi thất bại. Hãy thử lại.", dailyFailed:"Tạo câu hỏi tự động thất bại. Hãy thử lại.", report:"Báo cáo câu hỏi an toàn", selected:"Phiên đã chọn", questions:"Câu hỏi", sent:"Đã gửi", responses:"Phản hồi", rate:"Tỷ lệ phản hồi", category:"Phân loại", worker:"Công nhân/số", language:"Ngôn ngữ/từ khóa", status:"Trạng thái", content:"Nội dung/thời gian gửi", select:"Chọn TBM", selectDesc:"AI tự động tạo câu hỏi từ buổi đào tạo TBM gần đây.", noSession:"Không có phiên TBM.", noContent:"⚠️ Không có nội dung TBM (tạo từ bản ghi lời nói)", generate:"Tự động tạo câu hỏi AI", or:"hoặc", daily:"Tự động ra 3 câu hỏi hôm nay", fallbackBadge:"Dùng câu ví dụ nếu không có TBM", generating:"Đang tạo câu hỏi AI...", generatingDesc:"Phân tích thông báo TBM và lời nói tại công trường để tạo câu hỏi (khoảng 10–20 giây)", generatedQuestions:"Câu hỏi đã tạo", reselect:"Chọn lại", fallback:"📋 Không có nội dung TBM nên các câu hỏi an toàn mẫu đã được tạo. Hãy tạo TBM rồi tạo lại để có câu hỏi phù hợp.", missingId:"⚠️ Không có ID phiên câu hỏi — không thể gửi. Hãy chọn lại phiên TBM.", sendAll:"Gửi cho tất cả công nhân", dailySending:"Đang tạo và gửi câu hỏi hôm nay...", dailySendingDesc:"Tạo 3 câu hỏi từ TBM hôm nay và gửi cho tất cả công nhân", sending:"Đang dịch và gửi...", sendingDesc:"Dịch sang tiếng mẹ đẻ của từng công nhân và gửi riêng", live:"Phản hồi trực tiếp", newQuiz:"Câu hỏi mới", waiting:"Đang chờ phản hồi của công nhân...", complete:"Đã trả lời", pending:"Đang chờ", issued:"Câu hỏi và đáp án đã ra" },
  ru: { title:"Тест по безопасности", desc:"Проверьте понимание безопасности на основе содержания TBM.", generated:"Не удалось создать тест. Повторите попытку.", sentFailed:"Не удалось отправить. Повторите попытку.", dailyFailed:"Не удалось автоматически создать вопросы. Повторите попытку.", report:"Отчёт по тесту безопасности", selected:"Выбранная сессия", questions:"Вопросы", sent:"Отправлено", responses:"Ответы", rate:"Доля ответов", category:"Категория", worker:"Работник/номер", language:"Язык/ключевое слово", status:"Статус", content:"Содержание/время отправки", select:"Выберите TBM", selectDesc:"ИИ автоматически создаёт тест по последнему обучению TBM.", noSession:"Нет сессий TBM.", noContent:"⚠️ Нет содержания TBM (создано по записям речи)", generate:"Создать вопросы ИИ", or:"или", daily:"Автоматически выдать 3 вопроса дня", fallbackBadge:"Примеры, если нет TBM", generating:"Создание теста ИИ...", generatingDesc:"Анализируются объявления TBM и речь на объекте (около 10–20 секунд)", generatedQuestions:"Созданные вопросы", reselect:"Выбрать снова", fallback:"📋 Содержания TBM нет, поэтому созданы примерные вопросы по безопасности. Создайте TBM и повторите генерацию для индивидуальных вопросов.", missingId:"⚠️ Нет ID сессии теста — отправка невозможна. Выберите сессию TBM повторно.", sendAll:"Отправить всем работникам", dailySending:"Создание и отправка теста дня...", dailySendingDesc:"Создаём 3 вопроса по сегодняшнему TBM и отправляем всем работникам", sending:"Перевод и отправка...", sendingDesc:"Переводим на родной язык каждого работника и отправляем отдельно", live:"Ответы в реальном времени", newQuiz:"Новый тест", waiting:"Ожидание ответов работников...", complete:"Ответ получен", pending:"Ожидание", issued:"Выданные вопросы и ответы" },
};

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
  const lang = useDisplayLanguage();
  const t = QUIZ_UI[lang] || QUIZ_UI.en;
  const locale = ({ ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" } as Record<string, string>)[lang] || "en-US";
  const [phase, setPhase] = useState<Phase>("select");
  const [tbmSessions, setTbmSessions] = useState<TbmSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TbmSession | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [liveResponses, setLiveResponses] = useState<LiveResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quizSource, setQuizSource] = useState<"tbm" | "fallback" | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/quiz/tbm-sessions", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json() as { sessions?: TbmSession[] };
    setTbmSessions(data.sessions ?? []);
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
      setError(e instanceof Error ? e.message : t.generated);
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
      setError(e instanceof Error ? e.message : t.sentFailed);
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
      setError(e instanceof Error ? e.message : t.dailyFailed);
      setPhase("select");
    }
  };

  // Server-managed live responses
  useEffect(() => {
    if (phase !== "live" || !quizSessionId) return;
    let cancelled = false;
    const loadLive = async () => {
      const res = await fetch(`/api/quiz/responses?quizSessionId=${encodeURIComponent(quizSessionId)}`, { cache: "no-store" });
      if (!cancelled && res.ok) {
        const data = await res.json() as { responses?: LiveResponse[] };
        setLiveResponses(data.responses ?? []);
      }
      if (!cancelled && questions.length === 0 && selectedSession?.id) {
        const listRes = await fetch(`/api/quiz/generate?tbmSessionId=${encodeURIComponent(selectedSession.id)}`, { cache: "no-store" });
        if (listRes.ok) {
          const listData = await listRes.json() as { quizSessions?: Array<{ questions?: Omit<GeneratedQuestion, "included">[] }> };
          const loaded = listData.quizSessions?.[0]?.questions;
          if (loaded) setQuestions(loaded.map((q) => ({ ...q, included: true })));
        }
      }
    };
    loadLive();
    const timer = window.setInterval(loadLive, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, quizSessionId, questions.length, selectedSession?.id]);

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
      title: t.report,
      subtitle: `${selectedSession?.title ?? selectedSession?.id ?? t.selected} / ${new Date().toLocaleString(locale)}`,
      filename: `safety_quiz_${quizSessionId || selectedSession?.id || "draft"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: t.questions, value: questions.length },
        { label: t.sent, value: totalSent },
        { label: t.responses, value: answeredCount },
        { label: t.rate, value: totalSent > 0 ? `${Math.round((answeredCount / totalSent) * 100)}%` : "0%" },
      ],
      columns: [
        { key: "type", label: t.category },
        { key: "id", label: "ID" },
        { key: "worker", label: t.worker },
        { key: "lang", label: t.language },
        { key: "status", label: t.status },
        { key: "submitted_at", label: t.content },
      ],
      rows,
      raw: { selectedSession, quizSessionId, questions, liveResponses },
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="visualization-light min-h-screen font-sans flex flex-col selection:bg-blue-500/30">
        <header className="concept-page-header safe-area-sticky-top sticky z-50">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white uppercase italic">{t.title}</span>
            <span className="px-2 py-0.5 bg-purple-500 text-[10px] font-black rounded text-white tracking-widest uppercase">AI</span>
          </div>
          {phase === "live" && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-black text-green-400 uppercase tracking-widest">{t.live}</span>
            </span>
          )}
          {(questions.length > 0 || liveResponses.length > 0) && (
            <div className={phase === "live" ? "ml-3" : "ml-auto"}>
              <ExportMenu onExport={handleExport} />
            </div>
          )}
        </header>

        <div className="admin-concept-hero relative overflow-hidden h-40 w-full">
          <picture>
            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/education.webp" />
            <Image src="/images/mobile-v3/website/education.webp" alt="Safety Quiz" fill className="object-cover" />
          </picture>
          <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
            <p className="text-[10px] font-black tracking-[.18em] text-purple-200">SQ LINK EDUCATION</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
          </div>
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
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t.select}</h2>
                </div>
                <p className="text-slate-500 text-sm ml-5">{t.selectDesc}</p>
              </div>

              <div className="flex flex-col gap-2">
                {tbmSessions.length === 0 && (
                  <p className="text-slate-600 text-sm text-center py-8">{t.noSession}</p>
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
                          {new Date(s.started_at).toLocaleDateString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          <span className={s.status === "running" ? "text-green-400" : "text-slate-500"}>{s.status}</span>
                        </p>
                        {!hasContent && (
                          <p className="text-[10px] text-yellow-500 mt-0.5">{t.noContent}</p>
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
                {t.generate}
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-600 font-bold">{t.or}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={handleDailyQuiz}
                className="w-full py-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[32px] text-base font-black text-white shadow-[0_20px_50px_-15px_rgba(245,158,11,0.35)] tap-effect transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t.daily}
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{t.fallbackBadge}</span>
              </button>
            </section>
          )}

          {/* PHASE: generating */}
          {phase === "generating" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">{t.generating}</p>
                <p className="text-slate-500 text-sm mt-2">{t.generatingDesc}</p>
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
                    {t.generatedQuestions}{" "}
                    <span className="text-green-400">{questions.length}</span>
                  </h2>
                </div>
                <button
                  onClick={resetFlow}
                  className="text-xs text-slate-500 hover:text-white tap-effect px-3 py-1 rounded-full glass"
                >
                  {t.reselect}
                </button>
              </div>
              {quizSource === "fallback" && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300 font-bold">
                  {t.fallback}
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
                <p className="text-xs text-yellow-500 text-center">{t.missingId}</p>
              )}

              <button
                onClick={handleSend}
                disabled={!questions.some(q => q.included) || !quizSessionId}
                className="w-full py-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-[32px] text-xl font-black text-white shadow-[0_20px_50px_-15px_rgba(34,197,94,0.4)] tap-effect disabled:opacity-30 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {t.sendAll}
              </button>
            </section>
          )}

          {/* PHASE: daily_sending */}
          {phase === "daily_sending" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">{t.dailySending}</p>
                <p className="text-slate-500 text-sm mt-2">{t.dailySendingDesc}</p>
              </div>
            </section>
          )}

          {/* PHASE: sending */}
          {phase === "sending" && (
            <section className="glass rounded-[48px] p-16 border-white/10 shadow-3xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xl font-black text-white">{t.sending}</p>
                <p className="text-slate-500 text-sm mt-2">{t.sendingDesc}</p>
              </div>
            </section>
          )}

          {/* PHASE: live */}
          {phase === "live" && (
            <section className="glass rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-green-400 uppercase tracking-widest">{t.live}</span>
                </div>
                <button
                  onClick={resetFlow}
                  className="px-4 py-2 glass rounded-full text-xs font-black text-slate-400 hover:bg-white/5 tap-effect"
                >
                  {t.newQuiz}
                </button>
              </div>

              <h2 className="text-lg font-black text-white">
                {selectedSession?.title ?? selectedSession?.id.slice(0, 8)}
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-[24px] p-4 text-center">
                  <span className="text-3xl font-black text-white">{totalSent}</span>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{t.sent}</p>
                </div>
                <div className="bg-blue-500/10 rounded-[24px] p-4 text-center border border-blue-500/20">
                  <span className="text-3xl font-black text-blue-400">{answeredCount}</span>
                  <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mt-1">{t.responses}</p>
                </div>
                <div className="bg-purple-500/10 rounded-[24px] p-4 text-center border border-purple-500/20">
                  <span className="text-3xl font-black text-purple-400">
                    {totalSent > 0 ? Math.round((answeredCount / totalSent) * 100) : 0}%
                  </span>
                  <p className="text-[10px] font-black text-purple-500/60 uppercase tracking-widest mt-1">{t.rate}</p>
                </div>
              </div>

              {liveResponses.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-6">{t.waiting}</p>
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
                      {r.status === "answered" ? t.complete : t.pending}
                    </span>
                  </div>
                ))}
              </div>

              {/* 출제된 문제 및 정답 */}
              {questions.length > 0 && (
                <div className="mt-2 flex flex-col gap-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t.issued}</p>
                  {questions.map((q, qi) => (
                    <div key={q.id} className="rounded-2xl p-4 bg-white/5 border border-white/10">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                          {qi + 1}
                        </span>
                        <p className="text-sm font-bold text-white">{q.question_ko}</p>
                      </div>
                      <div className="flex flex-col gap-1 pl-7">
                        {q.options_ko.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`text-xs px-3 py-1.5 rounded-lg ${
                              oi === q.answer_index
                                ? "bg-green-500/20 text-green-300 font-bold"
                                : "text-slate-500"
                            }`}
                          >
                            {oi === q.answer_index && "✓ "}{opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

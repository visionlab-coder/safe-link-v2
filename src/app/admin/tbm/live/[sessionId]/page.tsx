"use client";
/**
 * TBM NFC 실시간 참석 확인 보드
 * 관리자(Android Chrome)가 이 화면을 열고 "스캔 시작" 클릭 후
 * 근로자가 자신의 NFC 스티커를 가져다 대면 자동으로 참석 확인.
 *
 * 탭 1회 = TBM 참석 확인 (출퇴근 아님).
 */
import { useEffect, useState, useRef, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Nfc, Square, RefreshCw, CheckCircle, Users, AlertTriangle, Brain } from "lucide-react";
import { NfcScanner, detectNfcSupport, NfcError } from "@/utils/nfc/web-nfc";
import { NFC_BASE_URL } from "@/utils/nfc/constants";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const LIVE_SESSION_UI: Record<string, Record<string, string>> = {
  ko: { unsupported:"이 기기는 NFC를 지원하지 않습니다. Android Chrome이 필요합니다.", failed:"처리 실패", scanError:"스캔 오류", error:"오류 발생", closeConfirm:"세션을 종료하시겠습니까?", loading:"로딩 중...", close:"세션 종료", fallback:"TBM NFC 참석", people:"명 참석", startHint:"스캔 시작 후 근로자가 스티커를 가까이 대면 자동 확인됩니다.", start:"스캔 시작", waiting:"스캔 대기 중", stop:"중지", checked:"① 참석 대기 등록 완료", certifyHint:"TBM 종료 후 다시 스캔 → 이수 인증", certified:"② 이수 인증 완료", already:"이미 이수 인증 완료됨", closed:"종료된 세션입니다.", attendees:"참석자", none:"아직 참석자가 없습니다.", complete:"이수완료", pending:"대기중", quiz:"AI 안전 퀴즈", quizSent:"퀴즈가 근로자 모국어로 발송되었습니다.", quizDesc:"TBM 발화 내용에서 AI가 퀴즈를 자동 생성하여 근로자 모국어로 발송합니다.", generating:"퀴즈 생성 중...", sendQuiz:"AI 퀴즈 생성 및 발송", list:"세션 목록" },
  en: { unsupported:"This device does not support NFC. Android Chrome is required.", failed:"Processing failed", scanError:"Scan error", error:"An error occurred", closeConfirm:"Close this session?", loading:"Loading...", close:"Close session", fallback:"TBM NFC attendance", people:"attendees", startHint:"After starting the scan, attendance is confirmed automatically when a worker holds a sticker close.", start:"Start scan", waiting:"Waiting to scan", stop:"Stop", checked:"① Attendance recorded", certifyHint:"Scan again after TBM ends to certify completion", certified:"② Completion certified", already:"Already certified", closed:"This session is closed.", attendees:"Attendees", none:"No attendees yet.", complete:"Completed", pending:"Pending", quiz:"AI Safety Quiz", quizSent:"The quiz was sent in each worker’s native language.", quizDesc:"AI creates a quiz from TBM speech and sends it in each worker’s native language.", generating:"Generating quiz...", sendQuiz:"Generate and send AI quiz", list:"Session list" },
  zh: { unsupported:"此设备不支持 NFC，需要 Android Chrome。", failed:"处理失败", scanError:"扫描错误", error:"发生错误", closeConfirm:"要结束此会话吗？", loading:"正在加载...", close:"结束会话", fallback:"TBM NFC 参与", people:"人参与", startHint:"开始扫描后，工人将贴纸靠近即可自动确认参与。", start:"开始扫描", waiting:"等待扫描", stop:"停止", checked:"① 已记录参与", certifyHint:"TBM 结束后再次扫描以认证完成", certified:"② 已认证完成", already:"已完成认证", closed:"此会话已结束。", attendees:"参与者", none:"暂无参与者。", complete:"已完成", pending:"等待中", quiz:"AI 安全测验", quizSent:"测验已按工人母语发送。", quizDesc:"AI 会根据 TBM 语音自动生成测验并按工人母语发送。", generating:"正在生成测验...", sendQuiz:"生成并发送 AI 测验", list:"会话列表" },
  vi: { unsupported:"Thiết bị này không hỗ trợ NFC. Cần Android Chrome.", failed:"Xử lý thất bại", scanError:"Lỗi quét", error:"Đã xảy ra lỗi", closeConfirm:"Kết thúc phiên này?", loading:"Đang tải...", close:"Kết thúc phiên", fallback:"Điểm danh TBM NFC", people:"người tham dự", startHint:"Sau khi bắt đầu quét, điểm danh được xác nhận tự động khi công nhân đưa nhãn lại gần.", start:"Bắt đầu quét", waiting:"Đang chờ quét", stop:"Dừng", checked:"① Đã ghi nhận tham dự", certifyHint:"Quét lại sau khi TBM kết thúc để chứng nhận hoàn thành", certified:"② Đã chứng nhận hoàn thành", already:"Đã chứng nhận", closed:"Phiên này đã kết thúc.", attendees:"Người tham dự", none:"Chưa có người tham dự.", complete:"Hoàn thành", pending:"Đang chờ", quiz:"Câu hỏi an toàn AI", quizSent:"Câu hỏi đã gửi bằng tiếng mẹ đẻ của công nhân.", quizDesc:"AI tạo câu hỏi từ lời nói TBM và gửi bằng tiếng mẹ đẻ của mỗi công nhân.", generating:"Đang tạo câu hỏi...", sendQuiz:"Tạo và gửi câu hỏi AI", list:"Danh sách phiên" },
  ru: { unsupported:"Это устройство не поддерживает NFC. Требуется Android Chrome.", failed:"Ошибка обработки", scanError:"Ошибка сканирования", error:"Произошла ошибка", closeConfirm:"Завершить эту сессию?", loading:"Загрузка...", close:"Завершить сессию", fallback:"Участие TBM NFC", people:"участников", startHint:"После начала сканирования участие подтверждается автоматически, когда работник подносит метку.", start:"Начать сканирование", waiting:"Ожидание сканирования", stop:"Остановить", checked:"① Участие записано", certifyHint:"После окончания TBM отсканируйте снова для сертификации", certified:"② Завершение подтверждено", already:"Уже подтверждено", closed:"Эта сессия завершена.", attendees:"Участники", none:"Пока нет участников.", complete:"Завершено", pending:"Ожидание", quiz:"ИИ-тест по безопасности", quizSent:"Тест отправлен на родном языке каждого работника.", quizDesc:"ИИ создаёт тест по речи TBM и отправляет его на родном языке работника.", generating:"Создание теста...", sendQuiz:"Создать и отправить ИИ-тест", list:"Список сессий" },
};

interface AttendanceRecord {
  id: string;
  worker_id: string;
  tapped_at: string;
  lang_used: string | null;
}

interface AttendanceWithWorker extends AttendanceRecord {
  worker_code?: string;
  full_name?: string;
  nationality?: string;
  trade?: string;
  certified_at?: string | null;
  is_certified?: boolean;
}

interface Session {
  id: string;
  site_id: string;
  title: string | null;
  status: "open" | "running" | "closed";
  started_at: string;
}

type ScanState = "idle" | "scanning" | "checked_in" | "certified" | "already_certified" | "error";

export default function TbmLiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = LIVE_SESSION_UI[lang] || LIVE_SESSION_UI.en;

  const [session, setSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<AttendanceWithWorker[]>([]);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [lastWorker, setLastWorker] = useState<{ name: string; code: string; nationality: string } | null>(null);
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizSent, setQuizSent] = useState(false);
  const [quizError, setQuizError] = useState("");

  const scannerRef = useRef<NfcScanner | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nfcSupport = detectNfcSupport();

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/nfc/tbm-session/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data.session);
      setAttendance(data.attendance ?? []);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const startScan = async () => {
    if (!nfcSupport.supported) {
      setScanError(t.unsupported);
      return;
    }

    abortRef.current = new AbortController();
    const scanner = new NfcScanner();
    scannerRef.current = scanner;
    setScanState("scanning");
    setScanError("");

    try {
      while (!abortRef.current.signal.aborted) {
        const result = await scanner.scanOnce({
          signal: abortRef.current.signal,
          expectedBaseUrl: NFC_BASE_URL,
          timeoutMs: 0,
        });

        // 탭 API 호출
        const res = await fetch(`/api/nfc/tbm-session/${sessionId}/tap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.rawPayload }),
        });

        const data = await res.json();

        if (res.ok) {
          setLastWorker({ name: data.worker.full_name, code: data.worker.worker_code, nationality: data.worker.nationality });
          if (data.action === "checked_in") {
            setScanState("checked_in");
            await fetchSession();
          } else if (data.action === "certified") {
            setScanState("certified");
            await fetchSession();
          } else {
            setScanState("already_certified");
          }
          // 2.5초 후 scanning 상태로 복귀
          setTimeout(() => setScanState("scanning"), 2500);
        } else {
          setScanError(data.error || t.failed);
          setScanState("error");
          setTimeout(() => { setScanState("scanning"); setScanError(""); }, 3000);
        }

        scanner.reset();
      }
    } catch (err) {
      if (err instanceof NfcError && err.code === "aborted") {
        setScanState("idle");
      } else {
        setScanError(err instanceof Error ? err.message : t.scanError);
        setScanState("error");
      }
    }
  };

  const stopScan = () => {
    abortRef.current?.abort();
    setScanState("idle");
  };

  // 청구항 11: TBM 종료 후 AI 퀴즈 자동 생성 → 발송
  const handleGenerateAndSendQuiz = async () => {
    if (!sessionId) return;
    setQuizGenerating(true);
    setQuizError("");
    try {
      // 1. 퀴즈 생성
      const genRes = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tbmSessionId: sessionId }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error ?? "generation_failed");

      // 2. 생성된 퀴즈 세션 조회
      const listRes = await fetch(`/api/quiz/generate?tbmSessionId=${sessionId}`);
      const listData = await listRes.json();
      const quizSessionId = listData.quizSessions?.[0]?.id;
      if (!quizSessionId) throw new Error("quiz_session_not_saved");

      // 3. 근로자에게 발송
      const sendRes = await fetch("/api/quiz/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizSessionId, tbmSessionId: sessionId }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error ?? "send_failed");

      setQuizSent(true);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : t.error);
    } finally {
      setQuizGenerating(false);
    }
  };

  const handleCloseSession = async () => {
    if (!confirm(t.closeConfirm)) return;
    await fetch(`/api/nfc/tbm-session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    await fetchSession();
    stopScan();
  };

  if (loading) {
    return (
      <div className="visualization-light min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  const isActive = session?.status !== "closed";

  return (
    <RoleGuard allowedRole="admin">
      <div className="visualization-light min-h-screen">
        {/* 헤더 */}
        <div className="concept-page-header">
          <div className="flex w-full items-center justify-between">
            <p className="font-black tracking-tight text-[#063789]">SQ LINK</p>
            {isActive && (
              <button onClick={handleCloseSession} className="bg-red-800 hover:bg-red-700 text-red-100 text-xs px-3 py-1.5 rounded-lg transition-colors">
                {t.close}
              </button>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* 스캔 영역 */}
          <div className="admin-concept-hero relative h-40 w-full overflow-hidden rounded-2xl border border-gray-800">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v4/mobile/tbm/03.webp" />
              <Image src="/images/mobile-v4/web/tbm/03.webp" alt="Live TBM attendance scan" fill className="object-cover" priority />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ LINK TBM NFC</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{session?.title || t.fallback}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{session?.site_id} · {attendance.length} {t.people}</p>
            </div>
          </div>

          {isActive && (
            <div className={`rounded-2xl p-6 text-center transition-all ${
              scanState === "scanning"         ? "bg-green-950 border-2 border-green-600" :
              scanState === "checked_in"       ? "bg-blue-900 border-2 border-blue-400" :
              scanState === "certified"        ? "bg-green-800 border-2 border-green-400" :
              scanState === "already_certified"? "bg-yellow-900 border-2 border-yellow-600" :
              scanState === "error"            ? "bg-red-900 border-2 border-red-600" :
              "bg-gray-800 border border-gray-700"
            }`}>
              <Nfc className={`w-12 h-12 mx-auto mb-3 ${
                scanState === "scanning"          ? "text-green-400 animate-pulse" :
                scanState === "checked_in"        ? "text-blue-300" :
                scanState === "certified"         ? "text-green-300" :
                scanState === "already_certified" ? "text-yellow-400" :
                scanState === "error"             ? "text-red-400" :
                "text-gray-600"
              }`} />

              {scanState === "idle" && (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    {nfcSupport.supported ? t.startHint : t.unsupported}
                  </p>
                  {nfcSupport.supported && (
                    <button onClick={startScan} className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-xl font-medium text-white transition-colors">
                      {t.start}
                    </button>
                  )}
                </>
              )}

              {scanState === "scanning" && (
                <>
                  <p className="text-green-300 font-medium mb-1">{t.waiting}</p>
                  <p className="text-gray-400 text-sm mb-4">{t.startHint}</p>
                  <button onClick={stopScan} className="flex items-center gap-2 mx-auto bg-gray-700 hover:bg-gray-600 px-6 py-2.5 rounded-xl text-sm transition-colors">
                    <Square className="w-4 h-4" /> {t.stop}
                  </button>
                </>
              )}

              {scanState === "checked_in" && lastWorker && (
                <>
                  <p className="text-blue-200 font-bold text-lg">{lastWorker.name}</p>
                  <p className="text-blue-400 text-sm">{lastWorker.code} · {lastWorker.nationality}</p>
                  <p className="text-blue-300 text-base font-semibold mt-1">{t.checked}</p>
                  <p className="text-blue-500 text-xs mt-1">{t.certifyHint}</p>
                </>
              )}

              {scanState === "certified" && lastWorker && (
                <>
                  <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-2" />
                  <p className="text-green-300 font-bold text-lg">{lastWorker.name}</p>
                  <p className="text-green-500 text-sm">{lastWorker.code} · {lastWorker.nationality}</p>
                  <p className="text-green-300 text-base font-semibold mt-1">{t.certified}</p>
                </>
              )}

              {scanState === "already_certified" && lastWorker && (
                <>
                  <p className="text-yellow-300 font-bold">{lastWorker.name}</p>
                  <p className="text-yellow-500 text-sm">{t.already}</p>
                </>
              )}

              {scanState === "error" && (
                <>
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm">{scanError || t.error}</p>
                </>
              )}
            </div>
          )}

          {/* 종료된 세션 안내 */}
          {!isActive && (
            <div className="bg-gray-800 rounded-2xl p-6 text-center border border-gray-700">
              <CheckCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">{t.closed} {attendance.length} {t.people}.</p>
            </div>
          )}

          {/* 참석자 목록 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <h2 className="font-medium">{t.attendees} ({attendance.length})</h2>
              </div>
              <button onClick={fetchSession} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {attendance.length === 0 ? (
              <p className="text-center text-gray-600 py-8 text-sm">{t.none}</p>
            ) : (
              <div className="space-y-2">
                {[...attendance].reverse().map((a, idx) => (
                  <div key={a.id} className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
                    (a as AttendanceWithWorker).is_certified
                      ? "bg-green-950 border-green-800"
                      : "bg-gray-800 border-gray-700"
                  }`}>
                    <span className="text-gray-600 text-sm w-6 shrink-0">{attendance.length - idx}</span>
                    <CheckCircle className={`w-4 h-4 shrink-0 ${(a as AttendanceWithWorker).is_certified ? "text-green-400" : "text-blue-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm">
                        {(a as AttendanceWithWorker).full_name || `Worker ${a.worker_id.slice(0, 6)}`}
                      </span>
                      {(a as AttendanceWithWorker).worker_code && (
                        <span className="text-gray-500 text-xs ml-2 font-mono">{(a as AttendanceWithWorker).worker_code}</span>
                      )}
                      <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${
                        (a as AttendanceWithWorker).is_certified
                          ? "bg-green-800 text-green-300"
                          : "bg-blue-900 text-blue-300"
                      }`}>
                        {(a as AttendanceWithWorker).is_certified ? t.complete : t.pending}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs shrink-0">
                      {new Date(a.tapped_at).toLocaleTimeString(({ ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" } as Record<string, string>)[lang] || "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 청구항 11: AI 퀴즈 생성 & 발송 */}
          {!isActive && attendance.some((a) => (a as AttendanceWithWorker).is_certified) && (
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium text-white">{t.quiz}</h3>
              </div>
              {quizSent ? (
                <p className="text-green-400 text-sm font-medium">{t.quizSent}</p>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-3">{t.quizDesc}</p>
                  {quizError && <p className="text-red-400 text-xs mb-2">{quizError}</p>}
                  <button
                    onClick={handleGenerateAndSendQuiz}
                    disabled={quizGenerating}
                    className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    {quizGenerating ? t.generating : t.sendQuiz}
                  </button>
                </>
              )}
            </div>
          )}

          <button onClick={() => router.push("/admin/tbm/live")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← {t.list}
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}

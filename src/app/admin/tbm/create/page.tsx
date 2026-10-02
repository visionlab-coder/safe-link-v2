"use client";
import { tbmDraftSummaryUI } from "@/lib/tbm-draft-summary-ui";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { Suspense } from "react";
import { normalizeKo, normalizeKoAsync } from "@/utils/normalize";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import { TbmLiveBroadcast } from "@/utils/tbm-live-broadcast";
import { appendTbmTranscript, cleanTbmTranscriptFragment } from "@/utils/tbm-transcript";
import SafetyLibraryModal from "@/components/SafetyLibraryModal";
import { resolveDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

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
        libraryDesc: "위험성평가 항목 불러오기",
        deleteHistory: "이력 숨기기", chat: "1:1 대화 바로가기", male: "남성", female: "여성",
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
        libraryDesc: "Load risk assessment items",
        deleteHistory: "Hide", chat: "Go to 1:1 Chat", male: "Male", female: "Female",
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
        libraryDesc: "加载危险评估项目",
        deleteHistory: "隐藏记录", chat: "进入一对一对话", male: "男声", female: "女声",
    },
    vi: {
        title: "Phát thông báo an toàn", subtitle: "Gửi ngay cho toàn bộ công nhân", smartAssist: "TRỢ LÝ AI", generateTips: "Tạo hướng dẫn AI", processing: "Đang xử lý...", koreanDraft: "Bản nháp TBM", voiceInput: "NHẬP GIỌNG NÓI", listening: "ĐANG NGHE...", placeholder: "Nhập quy tắc an toàn hôm nay...", normResult: "Kết quả chuẩn hóa", changes: "thay đổi", pushBtn: "📡 PHÁT TBM", historyTitle: "Lịch sử gửi gần đây", noHistory: "Không có lịch sử phát", pushSuccess: "Đã phát", back: "Quay lại", previewNorm: "Xem trước tự động sửa", recTime: "Đang ghi", library: "Thư viện đào tạo cơ bản", libraryDesc: "Tải hạng mục đánh giá rủi ro", deleteHistory: "Ẩn", chat: "Đi đến trò chuyện 1:1", male: "NAM", female: "NỮ"
    },
    ru: {
        title: "Рассылка инструктажа", subtitle: "Мгновенная отправка всем работникам", smartAssist: "ИИ-АССИСТЕНТ", generateTips: "Создать рекомендации ИИ", processing: "Обработка...", koreanDraft: "Черновик TBM", voiceInput: "ГОЛОСОВОЙ ВВОД", listening: "СЛУШАЕМ...", placeholder: "Введите сегодняшние правила безопасности...", normResult: "Результат нормализации", changes: "изменений", pushBtn: "📡 РАЗОСЛАТЬ TBM", historyTitle: "Последние рассылки", noHistory: "Истории рассылок нет", pushSuccess: "Рассылка завершена", back: "Назад", previewNorm: "Предпросмотр автокоррекции", recTime: "Запись", library: "Библиотека базового обучения", libraryDesc: "Загрузить пункты оценки рисков", deleteHistory: "Скрыть", chat: "Перейти в личный чат", male: "МУЖСКОЙ", female: "ЖЕНСКИЙ"
    }
};

const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

type BroadcastResult = {
    type: "success" | "error";
    message: string;
};

function getBroadcastErrorMessage(lang: string, error?: string, detail?: string) {
    if (lang === "ko") {
        if (error === "site_id_required" || error === "admin_site_required") {
            return "TBM을 전파할 현장이 연결되어 있지 않습니다. 관리자 프로필에서 현장을 설정한 뒤 다시 시도하세요.";
        }
        if (error === "cross_site_access_denied") {
            return "다른 현장으로는 TBM을 전파할 수 없습니다. 관리자와 근로자의 현장이 같은지 확인하세요.";
        }
        if (error === "site_id_invalid") return "현장 ID 형식이 올바르지 않습니다.";
        if (error === "content_required") return "전파할 TBM 내용을 입력하세요.";
        return `TBM 저장에 실패했습니다.${detail ? ` (${detail})` : ""}`;
    }

    const messages = {
        zh: { site: "此管理员账户未关联现场。请设置现场后重试。", access: "无法向其他现场发布 TBM。请确认管理员与工人属于同一现场。", invalid: "现场 ID 格式无效。", content: "请输入要发布的 TBM 内容。", failed: "TBM 保存失败。" },
        vi: { site: "Tài khoản quản trị chưa được liên kết với công trường. Hãy thiết lập công trường rồi thử lại.", access: "Không thể phát TBM sang công trường khác. Hãy kiểm tra quản trị viên và công nhân thuộc cùng công trường.", invalid: "ID công trường không hợp lệ.", content: "Hãy nhập nội dung TBM để phát.", failed: "Không thể lưu TBM." },
        ru: { site: "К этому аккаунту администратора не привязан объект. Укажите объект и повторите попытку.", access: "Нельзя отправить TBM на другой объект. Проверьте, что администратор и работники относятся к одному объекту.", invalid: "Неверный формат ID объекта.", content: "Введите содержание TBM для рассылки.", failed: "Не удалось сохранить TBM." },
    }[lang];
    if (messages) {
        if (error === "site_id_required" || error === "admin_site_required") return messages.site;
        if (error === "cross_site_access_denied") return messages.access;
        if (error === "site_id_invalid") return messages.invalid;
        if (error === "content_required") return messages.content;
        return `${messages.failed}${detail ? ` (${detail})` : ""}`;
    }

    if (error === "site_id_required" || error === "admin_site_required") {
        return "No site is linked to this admin account. Set the admin site and try again.";
    }
    if (error === "cross_site_access_denied") {
        return "TBM cannot be broadcast to another site. Check that the admin and workers are assigned to the same site.";
    }
    if (error === "site_id_invalid") return "The site ID is invalid.";
    if (error === "content_required") return "Enter TBM content to broadcast.";
    return `Failed to save TBM.${detail ? ` (${detail})` : ""}`;
}

function AdminTBMCreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const displayLang = useDisplayLanguage();
    const [tbmText, setTbmText] = useState("");
    const [draftTextarea, setDraftTextarea] = useState<HTMLTextAreaElement | null>(null);
    const resizeDraft = useCallback(() => {
        const field = draftTextarea;
        if (!field) return;
        field.style.height = "auto";
        const borderHeight = field.offsetHeight - field.clientHeight;
        field.style.height = `${field.scrollHeight + borderHeight}px`;
    }, [draftTextarea]);

    useEffect(() => { resizeDraft(); }, [tbmText, resizeDraft]);
    useEffect(() => {
        const field = draftTextarea;
        if (!field) return;
        let previousWidth = field.getBoundingClientRect().width;
        const observer = new ResizeObserver(() => {
            const width = field.getBoundingClientRect().width;
            if (width !== previousWidth) {
                previousWidth = width;
                resizeDraft();
            }
        });
        observer.observe(field);
        let mounted = true;
        document.fonts.ready.then(() => { if (mounted) resizeDraft(); });
        return () => { mounted = false; observer.disconnect(); };
    }, [draftTextarea, resizeDraft]);
    const [summaryText, setSummaryText] = useState("");
    const [summarySource, setSummarySource] = useState("");
    const [summaryBusy, setSummaryBusy] = useState(false);
    const [summaryError, setSummaryError] = useState(false);
    const summaryRequestRef = useRef(0);
    const summaryAttemptRef = useRef("");
    const [draftEdited, setDraftEdited] = useState(false);
    const [liveFinalizing, setLiveFinalizing] = useState(false);
    const [liveCompleted, setLiveCompleted] = useState(false);
    const finalDraftRef = useRef("");
    // Updated by STT synchronously, including the final callback before React renders.
    const draftRef = useRef(tbmText);
    draftRef.current = tbmText;
    const [isDraining, setIsDraining] = useState(false);
    const recordingActionRef = useRef(false);
    const [isSending, setIsSending] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [hiddenNoticeIds, setHiddenNoticeIds] = useState<string[]>([]);
    const [normalizeResult, setNormalizeResult] = useState<{ normalized: string; changes: { from: string; to: string }[] } | null>(null);
    const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);
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
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as {
            user?: { id: string };
            profile?: { preferred_lang?: string | null; site_id?: string | null } | null;
        };
        if (!data.user) return;
        setAdminLang(resolveDisplayLanguage(data.profile?.preferred_lang, urlLang));
        setAdminSiteId(data.profile?.site_id || null);
        setUserId(data.user.id);
    }, [urlLang]);

    const fetchHistory = useCallback(async () => {
        const params = new URLSearchParams({ limit: "10" });
        if (adminSiteId) params.set("site_id", adminSiteId);
        const res = await fetch(`/api/tbm/notices?${params.toString()}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { tbms?: any[] };
        if (data.tbms) setHistory(data.tbms);
    }, [adminSiteId]);

    useEffect(() => {
        loadProfile();
        fetchHistory();
    }, [loadProfile, fetchHistory]);

    const hideNotice = useCallback((id: string) => {
        if (!userId) return;
        setHiddenNoticeIds(prev => {
            const next = [...prev, id];
            localStorage.setItem(`safelink_hidden_notices_${userId}`, JSON.stringify(next));
            return next;
        });
    }, [userId]);

    const handleLibrarySelect = useCallback((text: string) => {
        if (liveFinalizing) return;
        setTbmText((prev) => {
            const base = prev.trim();
            return base ? base + "\n\n" + text : text;
        });
    }, [liveFinalizing]);

    useEffect(() => {
        if (!userId) return;
        const stored = localStorage.getItem(`safelink_hidden_notices_${userId}`);
        if (stored) setHiddenNoticeIds(JSON.parse(stored) as string[]);
    }, [userId]);


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
    const broadcaster = useRef(new TbmLiveBroadcast());
    const [broadcastBusy, setBroadcastBusy] = useState(false);
    const [broadcastActive, setBroadcastActive] = useState(false);
    useEffect(() => {
        if (!draftEdited || (!broadcastActive && !liveFinalizing) || liveCompleted || isSending) return;
        // Coalesce typing and, after an edit, keep subsequent STT additions in the same snapshot.
        const timer = setTimeout(() => {
            void broadcaster.current.syncDraft(tbmText).catch(() => {
                setBroadcastResult({ type: "error", message: getBroadcastErrorMessage(displayLang || adminLang) });
            });
        }, 700);
        return () => clearTimeout(timer);
    }, [tbmText, draftEdited, broadcastActive, liveFinalizing, liveCompleted, isSending, displayLang, adminLang]);
    useEffect(() => {
        const current = broadcaster.current;
        return () => { void current.stop().catch(() => {}); };
    }, []);

    const handleTranscript = useCallback(async (text: string) => {
        const liveText = cleanTbmTranscriptFragment(text);
        if (!liveText) return;
        setSttError(null);
        draftRef.current = appendTbmTranscript(draftRef.current, liveText);
        setTbmText(draftRef.current);
        // 라이브 STT는 1초 안팎의 조각마다 임의의 마침표를 붙일 수 있다.
        // 그 값을 그대로 전송하면 수신 화면에서 단어마다 문장이 끊긴 것처럼 보인다.
        try {
            await broadcaster.current.publish(liveText);
        } catch {
            setSttError("일부 음성을 실시간 전송하지 못했습니다. 초안은 보존되며 종료 후 최종 전파할 수 있습니다.");
        }
    }, []);

    const handleSTTError = useCallback((_type: string, message: string) => {
        setSttError(message);
        setTimeout(() => setSttError(null), 5000);
    }, []);

    const { isRecording, toggle: toggleRecording, stopAndDrain } = useCloudSTT({
        lang: "ko",
        siteId: adminSiteId,
        live: true,
        // TBM은 문장 전체가 끝날 때까지 기다리지 않고 짧은 발화 조각 단위로 전달한다.
        chunkInterval: 1800,
        silenceDuration: 500,
        liveMinChunkMs: 1200,
        onTranscript: handleTranscript,
        onError: handleSTTError,
        onSpeechStart: () => { void broadcaster.current.announceSpeaking(); },
    });

    const showBroadcastError = (error: unknown) => {
        const code = error instanceof Error ? error.message : "";
        console.error(`[TBM live] broadcast action failed: ${code || String(error)} (siteId=${adminSiteId ?? "none"})`);
        if (code.endsWith("_401") || code.endsWith("_403")) {
            setSttError("TBM 방송 권한 또는 현장 연결을 확인하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.");
        } else if (code.endsWith("_404")) {
            setSttError("실시간 TBM 방송 기능이 서버에 반영되지 않았습니다. 서버 상태를 확인해 주세요.");
        } else if (code.endsWith("_502") || code.endsWith("_503") || code.endsWith("_504")) {
            setSttError("실시간 TBM 방송 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        } else {
            setSttError("TBM 실시간 방송을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    };

    const completeLiveTbm = useCallback(async () => {
        const requestId = ++summaryRequestRef.current;
        setSummaryBusy(true);
        setSummaryError(false);
        const source = draftRef.current;
        summaryAttemptRef.current = source;
        try {
            const { normalized, changes } = await normalizeKoAsync(source.trim());
            const response = await fetch("/api/tbm/summary", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteId: adminSiteId, text: normalized }),
                signal: AbortSignal.timeout(65000),
            });
            if (!response.ok) throw new Error("summary_failed");
            const result = await response.json();
            if (!result.text?.trim()) throw new Error("summary_empty");
            if (requestId !== summaryRequestRef.current || draftRef.current !== source) return null;
            setSummaryText(result.text);
            setSummarySource(source);
            setNormalizeResult({ normalized, changes });
            return result.text as string;
        } catch {
            if (requestId === summaryRequestRef.current && draftRef.current === source) setSummaryError(true);
            return null;
        } finally {
            if (requestId === summaryRequestRef.current) setSummaryBusy(false);
        }
    }, [adminSiteId]);

    useEffect(() => {
        if (!liveFinalizing || liveCompleted || isDraining || isSending || summaryBusy || !tbmText.trim()
            || summarySource === tbmText || summaryAttemptRef.current === tbmText) return;
        const timer = setTimeout(() => { void completeLiveTbm(); }, 900);
        return () => clearTimeout(timer);
    }, [tbmText, liveFinalizing, liveCompleted, isDraining, isSending, summaryBusy, summarySource, completeLiveTbm]);

    const handleRecording = async () => {
        if (recordingActionRef.current) return;
        recordingActionRef.current = true;
        setBroadcastBusy(true);
        try {
            if (isRecording) {
                setIsDraining(true);
                await stopAndDrain();
                finalDraftRef.current = draftRef.current;
                setLiveFinalizing(true);
                await broadcaster.current.stop().catch(() => {}); // complete retries a failed stop
                setBroadcastActive(false);
                setIsDraining(false);
                if (!finalDraftRef.current.trim()) {
                    setLiveFinalizing(false);
                    setSttError(getBroadcastErrorMessage(displayLang || adminLang, "content_required"));
                    return;
                }
                await completeLiveTbm();
            } else {
                if (!adminSiteId) {
                    setSttError("방송할 현장 정보를 확인하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.");
                    return;
                }
                if (broadcastActive) {
                    try {
                        await broadcaster.current.stop();
                    } catch (error) {
                        showBroadcastError(error);
                        return;
                    }
                    setBroadcastActive(false);
                }
                try {
                    await broadcaster.current.start(adminSiteId);
                } catch (error) {
                    showBroadcastError(error);
                    return;
                }
                setBroadcastActive(true);
                if (liveCompleted) {
                    draftRef.current = "";
                    setTbmText("");
                }
                setLiveFinalizing(false);
                setLiveCompleted(false);
                setDraftEdited(false);
                summaryAttemptRef.current = "";
                setSummaryError(false);
                setBroadcastResult(null);
                setSummaryText("");
                setSummarySource("");
                const started = await toggleRecording();
                if (started === true) setBroadcastActive(true);
                else {
                    // toggleRecording은 마이크 권한/연결 오류를 이미 화면에 정확히 표시한다.
                    // 그 메시지를 일반적인 방송 오류로 덮어쓰지 않는다.
                    await broadcaster.current.stop().catch(() => {});
                    setBroadcastActive(false);
                }
            }
        } catch (error) {
            showBroadcastError(error);
        } finally {
            setBroadcastBusy(false);
            setIsDraining(false);
            recordingActionRef.current = false;
        }
    };

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
        if (isSending || liveCompleted || isRecording || isDraining || summaryBusy) return;
        if (!tbmText.trim()) return;
        setIsSending(true);
        setBroadcastResult(null);
        setNormalizeResult(null);
        try {
            const { normalized, changes } = await normalizeKoAsync(tbmText.trim());

            if (liveFinalizing) {
                // Save the same final source first, then publish only a summary of that source.
                await broadcaster.current.syncDraft(normalized);
                const reviewedSummary = summarySource === tbmText && summaryText.trim()
                    ? summaryText.trim() : await completeLiveTbm();
                if (!reviewedSummary) return;
                // Manual publication links the final notice to this exact live session.
                await broadcaster.current.complete(normalized, reviewedSummary);
                setNormalizeResult({ normalized, changes });
                setLiveCompleted(true);
                setBroadcastResult({ type: "success", message: t.pushSuccess });
                await fetchHistory();
                return;
            }

            const res = await fetch("/api/tbm/broadcast", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": crypto.randomUUID(),
                },
                body: JSON.stringify({
                    content_ko: normalized,
                    summary_ko: summarySource === tbmText ? summaryText.trim() || undefined : undefined,
                    site_id: adminSiteId ?? undefined,
                }),
            });
            const result = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };

            if (!res.ok) {
                setBroadcastResult({
                    type: "error",
                    message: getBroadcastErrorMessage(displayLang || adminLang, result.error, result.detail),
                });
                return;
            }

            setNormalizeResult({ normalized, changes });
            setBroadcastResult({ type: "success", message: t.pushSuccess });
            setTbmText("");
            await fetchHistory();
        } catch (e) {
            console.error(e);
            setBroadcastResult({
                type: "error",
                message: getBroadcastErrorMessage(displayLang || adminLang),
            });
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(displayLang || adminLang);
    const summaryUI = tbmDraftSummaryUI(displayLang || adminLang);
    const locale = ({ ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" } as Record<string, string>)[displayLang || adminLang] || "en-US";

    return (
        <RoleGuard allowedRole="admin">
            <div className="visualization-light min-h-screen font-sans flex flex-col selection:bg-blue-500/30">
                <header className="concept-page-header safe-area-sticky-top sticky z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">SQ Link</span>
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
                                {t.male}
                            </button>
                            <button
                                onClick={() => changeGender('female')}
                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {t.female}
                            </button>
                        </div>
                    </div>
                </header>

                <div className="admin-concept-hero relative overflow-hidden h-40 w-full">
                  <picture>
                    <source media="(max-width: 639px)" srcSet="/images/mobile-v4/mobile/tbm/03.webp" />
                    <Image src="/images/mobile-v4/web/tbm/03.webp" alt="TBM Field Briefing" fill className="object-cover" />
                  </picture>
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                    <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ LINK TBM</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h2>
                    <p className="mt-2 text-sm font-bold text-slate-100">{t.subtitle}</p>
                  </div>
                </div>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-3xl mx-auto w-full pb-20">
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
                        <div className="glass tbm-compose-panel rounded-[48px] p-8 border-white/10 shadow-3xl flex flex-col gap-6 relative min-h-[400px]">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">{t.koreanDraft}</h3>
                                <button onClick={handleRecording} disabled={isDraining || isSending || broadcastBusy || summaryBusy || (liveFinalizing && !liveCompleted) || !adminSiteId} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all tap-effect relative ${isRecording ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "glass border-white/10 text-slate-400 hover:text-white"}`}>
                                    {isRecording && (
                                        <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        {isRecording ? (
                                            <>
                                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                {t.recTime} {formatRecTime(recSeconds)}
                                            </>
                                        ) : (broadcastBusy ? t.processing : (adminLang === "ko" ? "TBM 방송 시작" : t.voiceInput))}
                                    </span>
                                </button>
                            </div>
                            {sttError && (
                                <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold animate-float">
                                    {sttError}
                                </div>
                            )}
                            <textarea
                                ref={setDraftTextarea}
                                rows={5}
                                value={tbmText}
                                readOnly={isSending || liveCompleted}
                                onChange={(e) => { draftRef.current = e.target.value; setTbmText(e.target.value); setDraftEdited(true); }}
                                placeholder={isRecording ? `${t.listening} [${displayLang || adminLang}]` : t.placeholder}
                                className="w-full min-h-[180px] shrink-0 overflow-hidden bg-transparent text-2xl md:text-3xl font-bold text-white placeholder-slate-800 outline-none resize-none leading-snug tracking-tight"
                            />

                            {(isDraining || liveFinalizing) && <section className="rounded-2xl border border-blue-200 bg-white p-5 text-slate-900">
                                <label htmlFor="tbm-summary-draft" className="block font-bold mb-3">{summaryUI.title}</label>
                                {(summaryBusy || isDraining) && <p role="status" className="text-blue-800">{summaryUI.busy}</p>}
                                {(summaryError || (!summaryBusy && !liveCompleted && summarySource !== tbmText)) && <div role="status" className="text-red-800">
                                    {summaryError && <p>{summaryUI.failed}</p>}
                                    <button type="button" disabled={summaryBusy} onClick={() => void completeLiveTbm()} className="mt-2 rounded-xl bg-blue-700 px-4 py-2 text-white">{summaryUI.retry}</button>
                                </div>}
                                <textarea id="tbm-summary-draft" value={summarySource === tbmText ? summaryText : ""}
                                    onChange={e => setSummaryText(e.target.value)}
                                    disabled={summaryBusy || isDraining || liveCompleted || summarySource !== tbmText}
                                    rows={6} className="w-full rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-900 disabled:opacity-60" />
                            </section>}

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

                            {broadcastResult && (
                                <div
                                    className={`p-4 rounded-[24px] border text-sm font-bold leading-relaxed ${
                                        broadcastResult.type === "success"
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                            : "border-red-500/30 bg-red-500/10 text-red-200"
                                    }`}
                                >
                                    {broadcastResult.message}
                                </div>
                            )}

                            <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                                <button onClick={handleSendTBM} disabled={liveCompleted || isSending || !tbmText.trim() || isRecording || isDraining || summaryBusy} className="w-full py-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-[32px] text-2xl font-black text-slate-950 shadow-[0_20px_50px_-15px_rgba(59,130,246,0.4)] tap-effect flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale transition-all">
                                    {isSending ? <div className="w-8 h-8 border-4 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>{liveCompleted ? t.pushSuccess : t.pushBtn}</>}
                                </button>
                                <button
                                    onClick={() => router.push("/admin/chat")}
                                    className="w-full py-5 glass rounded-[28px] border-white/10 text-slate-300 hover:text-white hover:border-green-500/30 hover:bg-green-500/5 transition-all tap-effect flex items-center justify-center gap-3 group"
                                >
                                    <svg className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span className="font-black text-lg tracking-tight">
                                        {t.chat}
                                    </span>
                                    <svg className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="tbm-history-section mt-8 flex flex-col gap-6">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] px-4">{t.historyTitle}</h3>
                        <div className="flex flex-col gap-4">
                            {history.filter(tbm => !hiddenNoticeIds.includes(tbm.id)).length === 0 ? (
                                <div className="p-12 glass rounded-[40px] border-dashed border-white/5 text-center text-slate-600 font-bold italic uppercase tracking-widest">{t.noHistory}</div>
                            ) : (
                                history.filter(tbm => !hiddenNoticeIds.includes(tbm.id)).map((tbm) => (
                                    <div key={tbm.id} className="glass p-6 rounded-[32px] border-white/5 hover:border-white/10 transition-all group flex flex-col gap-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <p className="text-lg text-slate-300 font-bold leading-relaxed">{tbm.content_ko}</p>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button onClick={() => hideNotice(tbm.id)} title={t.deleteHistory} className="w-10 h-10 glass rounded-2xl flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors tap-effect">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                                <button onClick={() => { setTbmText(tbm.content_ko); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-blue-500 hover:bg-blue-500/10 transition-colors tap-effect">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            <span>{new Date(tbm.created_at).toLocaleString(locale)}</span>
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

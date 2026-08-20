"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { Award, CheckCircle, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const INCENTIVE_UI: Record<string, Record<string, string>> = {
  ko: { claim:"청구항 12", title:"안전장비 인센티브 지급", desc:"안전 퀴즈 성과에 따라 지급 대상과 이력을 관리합니다.", select:"퀴즈 세션을 선택하세요", loading:"로딩 중...", empty:"퀴즈 세션이 없습니다.", sendQuiz:"TBM 세션 종료 후 퀴즈를 먼저 발송하세요.", quiz:"퀴즈 세션", back:"세션 목록으로", selected:"선택된 퀴즈 세션", responses:"응답 로딩 중...", none:"아직 응답이 없습니다.", noResponse:"미응답", granted:"지급완료", notGranted:"미지급", grant:"장비 지급", history:"지급 이력", equipment:"장비 유형 선택", cancel:"취소", confirm:"지급 확정", report:"안전장비 인센티브 지급 리포트", all:"전체", site:"현장", response:"응답", eligible:"80점 이상", issued:"지급", workerCode:"근로자 코드", name:"이름", language:"언어", score:"점수", status:"상태", answeredAt:"응답시각", equipmentIssue:"장비 지급" },
  en: { claim:"Claim 12", title:"Safety Equipment Incentives", desc:"Manage eligible workers and grant history based on safety quiz results.", select:"Select a quiz session", loading:"Loading...", empty:"No quiz sessions.", sendQuiz:"Send a quiz after the TBM session ends.", quiz:"Quiz session", back:"Back to sessions", selected:"Selected quiz session", responses:"Loading responses...", none:"No responses yet.", noResponse:"No response", granted:"Granted", notGranted:"Not granted", grant:"Grant equipment", history:"Grant history", equipment:"Select equipment type", cancel:"Cancel", confirm:"Confirm grant", report:"Safety Equipment Incentive Report", all:"All", site:"Site", response:"Responses", eligible:"80 or above", issued:"Issued", workerCode:"Worker code", name:"Name", language:"Language", score:"Score", status:"Status", answeredAt:"Answered at", equipmentIssue:"Equipment issue" },
  zh: { claim:"权利要求 12", title:"安全设备激励发放", desc:"根据安全测验结果管理发放对象和历史记录。", select:"请选择测验会话", loading:"正在加载...", empty:"没有测验会话。", sendQuiz:"请在 TBM 会话结束后先发送测验。", quiz:"测验会话", back:"返回会话列表", selected:"已选择的测验会话", responses:"正在加载回答...", none:"暂无回答。", noResponse:"未回答", granted:"已发放", notGranted:"未发放", grant:"发放设备", history:"发放记录", equipment:"选择设备类型", cancel:"取消", confirm:"确认发放", report:"安全设备激励发放报告", all:"全部", site:"现场", response:"回答", eligible:"80 分以上", issued:"已发放", workerCode:"工人代码", name:"姓名", language:"语言", score:"分数", status:"状态", answeredAt:"回答时间", equipmentIssue:"设备发放" },
  vi: { claim:"Yêu cầu 12", title:"Cấp khuyến khích thiết bị an toàn", desc:"Quản lý đối tượng và lịch sử cấp phát theo kết quả câu đố an toàn.", select:"Chọn phiên câu đố", loading:"Đang tải...", empty:"Không có phiên câu đố.", sendQuiz:"Hãy gửi câu đố sau khi kết thúc phiên TBM.", quiz:"Phiên câu đố", back:"Quay lại danh sách", selected:"Phiên đã chọn", responses:"Đang tải câu trả lời...", none:"Chưa có phản hồi.", noResponse:"Chưa trả lời", granted:"Đã cấp", notGranted:"Chưa cấp", grant:"Cấp thiết bị", history:"Lịch sử cấp", equipment:"Chọn loại thiết bị", cancel:"Hủy", confirm:"Xác nhận cấp", report:"Báo cáo cấp thiết bị an toàn", all:"Tất cả", site:"Công trường", response:"Phản hồi", eligible:"Từ 80 điểm", issued:"Đã cấp", workerCode:"Mã công nhân", name:"Tên", language:"Ngôn ngữ", score:"Điểm", status:"Trạng thái", answeredAt:"Thời gian trả lời", equipmentIssue:"Cấp thiết bị" },
  ru: { claim:"Пункт 12", title:"Выдача средств защиты", desc:"Управляйте получателями и историей выдачи по результатам тестов.", select:"Выберите сессию теста", loading:"Загрузка...", empty:"Нет сессий теста.", sendQuiz:"Сначала отправьте тест после завершения сессии TBM.", quiz:"Сессия теста", back:"К списку сессий", selected:"Выбранная сессия", responses:"Загрузка ответов...", none:"Ответов пока нет.", noResponse:"Нет ответа", granted:"Выдано", notGranted:"Не выдано", grant:"Выдать оборудование", history:"История выдачи", equipment:"Выберите тип оборудования", cancel:"Отмена", confirm:"Подтвердить выдачу", report:"Отчёт о выдаче средств защиты", all:"Все", site:"Объект", response:"Ответы", eligible:"80 и выше", issued:"Выдано", workerCode:"Код работника", name:"Имя", language:"Язык", score:"Баллы", status:"Статус", answeredAt:"Время ответа", equipmentIssue:"Выдача оборудования" },
};

const EQUIPMENT_TYPES = [
  "안전모", "안전화", "안전조끼", "안전장갑", "안전안경",
  "방진마스크", "방음귀마개", "안전벨트", "안전고리",
];

const EQUIPMENT_LABELS: Record<string, Record<string, string>> = {
  ko: { "안전모":"안전모", "안전화":"안전화", "안전조끼":"안전조끼", "안전장갑":"안전장갑", "안전안경":"안전안경", "방진마스크":"방진마스크", "방음귀마개":"방음귀마개", "안전벨트":"안전벨트", "안전고리":"안전고리" },
  en: { "안전모":"Safety helmet", "안전화":"Safety shoes", "안전조끼":"Safety vest", "안전장갑":"Safety gloves", "안전안경":"Safety glasses", "방진마스크":"Dust mask", "방음귀마개":"Hearing protection", "안전벨트":"Safety belt", "안전고리":"Safety hook" },
  zh: { "안전모":"安全帽", "안전화":"安全鞋", "안전조끼":"安全背心", "안전장갑":"安全手套", "안전안경":"护目镜", "방진마스크":"防尘口罩", "방음귀마개":"隔音耳塞", "안전벨트":"安全带", "안전고리":"安全挂钩" },
  vi: { "안전모":"Mũ bảo hộ", "안전화":"Giày bảo hộ", "안전조끼":"Áo phản quang", "안전장갑":"Găng tay bảo hộ", "안전안경":"Kính bảo hộ", "방진마스크":"Khẩu trang chống bụi", "방음귀마개":"Nút tai chống ồn", "안전벨트":"Dây an toàn", "안전고리":"Móc an toàn" },
  ru: { "안전모":"Каска", "안전화":"Защитная обувь", "안전조끼":"Защитный жилет", "안전장갑":"Защитные перчатки", "안전안경":"Защитные очки", "방진마스크":"Противопылевая маска", "방음귀마개":"Беруши", "안전벨트":"Страховочный пояс", "안전고리":"Страховочный крюк" },
};

const LOCALES: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" };

type QuizSession = {
  id: string;
  tbm_session_id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type QuizResponse = {
  id: string;
  worker_id: string;
  lang: string;
  score_pct: number | null;
  status: string;
  answered_at: string | null;
  nfc_workers: { full_name: string; worker_code: string } | null;
};

type Grant = {
  worker_id: string;
  equipment_type: string;
  granted_at: string;
};

export default function AdminIncentivePage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = INCENTIVE_UI[lang] || INCENTIVE_UI.en;
  const equipmentLabels = EQUIPMENT_LABELS[lang] || EQUIPMENT_LABELS.en;
  const locale = LOCALES[lang] || LOCALES.en;
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResps, setLoadingResps] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantForm, setGrantForm] = useState<{ workerId: string; type: string } | null>(null);
  const [adminSiteId, setAdminSiteId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json() as { profile?: { site_id?: string | null } | null };
      if (data.profile?.site_id) setAdminSiteId(data.profile.site_id);
    });
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/quiz/sessions", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json() as { sessions?: QuizSession[] };
      setSessions(data.sessions ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadResponses = useCallback(async (session: QuizSession) => {
    setLoadingResps(true);
    setSelectedSession(session);
    setResponses([]);
    setGrants([]);

    const res = await fetch(`/api/quiz/responses?quizSessionId=${encodeURIComponent(session.id)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json() as { responses?: QuizResponse[] };
      setResponses(data.responses ?? []);
    }

    const grantRes = await fetch(`/api/incentive/grant?quizSessionId=${session.id}`);
    if (grantRes.ok) {
      const grantData = await grantRes.json() as { grants?: Grant[] };
      setGrants(grantData.grants ?? []);
    }
    setLoadingResps(false);
  }, []);

  const handleGrant = async () => {
    if (!grantForm || !selectedSession) return;
    setGrantingId(grantForm.workerId);
    try {
      const resp = responses.find((r) => r.worker_id === grantForm.workerId);
      await fetch("/api/incentive/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: grantForm.workerId,
          quizSessionId: selectedSession.id,
          scorePct: resp?.score_pct,
          equipmentType: grantForm.type,
          siteId: adminSiteId || null,
        }),
      });
      setGrantForm(null);
      loadResponses(selectedSession);
    } finally {
      setGrantingId(null);
    }
  };

  const alreadyGranted = (workerId: string) => grants.some((g) => g.worker_id === workerId);

  const handleExport = async (format: ExportFormat) => {
    const rows = responses.map((response) => ({
      worker_code: response.nfc_workers?.worker_code ?? response.worker_id,
      full_name: response.nfc_workers?.full_name ?? "",
      lang: response.lang,
      score_pct: response.score_pct ?? "",
      status: response.status,
      answered_at: response.answered_at ?? "",
      granted: alreadyGranted(response.worker_id) ? t.issued : t.notGranted,
    }));

    await exportData(format, {
      title: t.report,
      subtitle: `${selectedSession?.id ?? t.all} / ${t.site} ${adminSiteId || "-"}`,
      filename: `safety_incentive_${selectedSession?.id ?? "all"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: t.response, value: responses.length },
        { label: t.eligible, value: responses.filter((response) => (response.score_pct ?? 0) >= 80).length },
        { label: t.issued, value: grants.length },
      ],
      columns: [
        { key: "worker_code", label: t.workerCode },
        { key: "full_name", label: t.name },
        { key: "lang", label: t.language },
        { key: "score_pct", label: t.score },
        { key: "status", label: t.status },
        { key: "answered_at", label: t.answeredAt },
        { key: "granted", label: t.equipmentIssue },
      ],
      rows,
      raw: { selectedSession, responses, grants },
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="visualization-light min-h-screen p-4">
        <div className="max-w-3xl mx-auto">
          <div className="concept-page-header">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => router.back()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-slate-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Award className="w-6 h-6 shrink-0 text-yellow-500" />
              <span className="whitespace-nowrap rounded bg-yellow-50 px-2 py-0.5 text-xs font-bold text-yellow-700">{t.claim}</span>
            </div>
            <ExportMenu disabled={responses.length === 0} onExport={handleExport} />
          </div>

          <div className="admin-concept-hero relative rounded-2xl overflow-hidden h-40 w-full mb-4 border border-gray-800">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/education.webp" />
              <Image src="/images/mobile-v3/website/education.webp" alt="Safety incentive training" fill className="object-cover" />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-yellow-200">SQ-LINK INCENTIVE</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
            </div>
          </div>

          {!selectedSession ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm">{t.select}</p>
                <button onClick={loadSessions} className="p-2 text-gray-500 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {loading ? (
                <p className="text-gray-500 text-sm">{t.loading}</p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t.empty}</p>
                  <p className="text-xs mt-1">{t.sendQuiz}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadResponses(s)}
                      className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-4 flex items-center justify-between text-left border border-gray-700 hover:border-yellow-500/30 transition-all"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">{t.quiz}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{s.id.slice(0, 8)}…</p>
                        <p className="text-xs text-gray-600 mt-0.5">{new Date(s.created_at).toLocaleString(locale)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.status === "sent" ? "bg-green-900 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                          {s.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setSelectedSession(null)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4">
                <ArrowLeft className="w-4 h-4" />
                {t.back}
              </button>

              <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-1">{t.selected}</p>
                <p className="font-mono text-sm text-gray-300">{selectedSession.id.slice(0, 16)}…</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(selectedSession.created_at).toLocaleString(locale)}</p>
              </div>

              {loadingResps ? (
                <p className="text-gray-500 text-sm">{t.responses}</p>
              ) : (
                <div className="space-y-3">
                  {responses.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">{t.none}</p>
                  )}
                  {responses.map((r) => {
                    const score = r.score_pct ?? 0;
                    const eligible = score >= 80;
                    const granted = alreadyGranted(r.worker_id);
                    return (
                      <div key={r.id} className={`bg-gray-800 rounded-xl p-4 border ${eligible ? "border-yellow-500/20" : "border-gray-700"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{r.nfc_workers?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-500 font-mono">{r.nfc_workers?.worker_code}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-black ${score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                              {r.status === "answered" ? `${score}%` : t.noResponse}
                            </span>
                            {granted ? (
                              <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
                                <CheckCircle className="w-4 h-4" />
                                {t.granted}
                              </span>
                            ) : eligible && r.status === "answered" ? (
                              <button
                                onClick={() => setGrantForm({ workerId: r.worker_id, type: EQUIPMENT_TYPES[0] })}
                                disabled={grantingId === r.worker_id}
                                className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Award className="w-3.5 h-3.5" />
                                {t.grant}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-600">
                                {r.status !== "answered" ? t.noResponse : "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {grants.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{t.history}</p>
                  <div className="space-y-2">
                    {grants.map((g, i) => (
                      <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between border border-gray-800">
                        <span className="text-sm text-gray-300 font-bold">{g.equipment_type}</span>
                        <span className="text-xs text-gray-600">{new Date(g.granted_at).toLocaleString(locale)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {grantForm && (
        <div className="safe-area-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setGrantForm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-white mb-4">{t.equipment}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {EQUIPMENT_TYPES.map((equipmentType) => (
                <button
                  key={equipmentType}
                  onClick={() => setGrantForm((prev) => prev ? { ...prev, type: equipmentType } : null)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${grantForm.type === equipmentType ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  {equipmentLabels[equipmentType] || equipmentType}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGrantForm(null)} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl text-sm font-bold">{t.cancel}</button>
              <button
                onClick={handleGrant}
                disabled={grantingId !== null}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}

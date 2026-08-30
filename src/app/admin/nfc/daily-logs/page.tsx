"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { CalendarDays, CheckCircle2, ClipboardList, RefreshCw, XCircle } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const DAILY_LOG_UI: Record<string, Record<string, string>> = {
  ko: { title:"NFC 일일 안전일지", desc:"퇴근 태깅 시 자동 업로드된 출결 및 TBM 서명 기록", refresh:"새로고침", report:"NFC 일일 안전 로그", site:"현장", allLogs:"전체 로그", tbmSigned:"TBM 서명", unsigned:"미서명", worker:"근로자", workerCode:"근로자 코드", nationality:"국적", trade:"공종", checkIn:"출근", checkOut:"퇴근", signature:"서명", completed:"퇴근 완료", noName:"이름 없음", noLogs:"해당 날짜의 퇴근 태깅 안전일지가 없습니다.", loading:"불러오는 중..." },
  en: { title:"NFC Daily Safety Log", desc:"Attendance and TBM signature records uploaded automatically when workers tag out", refresh:"Refresh", report:"NFC Daily Safety Log", site:"Site", allLogs:"All logs", tbmSigned:"TBM signed", unsigned:"Unsigned", worker:"Worker", workerCode:"Worker code", nationality:"Nationality", trade:"Trade", checkIn:"Check-in", checkOut:"Check-out", signature:"Signature", completed:"Checked out", noName:"Unnamed", noLogs:"There are no safety logs for this date.", loading:"Loading..." },
  zh: { title:"NFC 每日安全日志", desc:"下班刷卡时自动上传的出勤和 TBM 签名记录", refresh:"刷新", report:"NFC 每日安全日志", site:"现场", allLogs:"全部日志", tbmSigned:"TBM 已签名", unsigned:"未签名", worker:"工人", workerCode:"工人代码", nationality:"国籍", trade:"工种", checkIn:"上班", checkOut:"下班", signature:"签名", completed:"已下班", noName:"未命名", noLogs:"该日期没有下班刷卡安全日志。", loading:"正在加载..." },
  vi: { title:"Nhật ký an toàn NFC hằng ngày", desc:"Bản ghi chấm công và chữ ký TBM tự động tải lên khi quét ra về", refresh:"Làm mới", report:"Nhật ký an toàn NFC hằng ngày", site:"Công trường", allLogs:"Tất cả nhật ký", tbmSigned:"Đã ký TBM", unsigned:"Chưa ký", worker:"Công nhân", workerCode:"Mã công nhân", nationality:"Quốc tịch", trade:"Công việc", checkIn:"Vào làm", checkOut:"Ra về", signature:"Chữ ký", completed:"Đã ra về", noName:"Không có tên", noLogs:"Không có nhật ký an toàn quét ra về cho ngày này.", loading:"Đang tải..." },
  ru: { title:"Ежедневный журнал безопасности NFC", desc:"Данные о посещаемости и подписях TBM автоматически загружаются при отметке ухода", refresh:"Обновить", report:"Ежедневный журнал безопасности NFC", site:"Объект", allLogs:"Все записи", tbmSigned:"TBM подписан", unsigned:"Не подписано", worker:"Работник", workerCode:"Код работника", nationality:"Гражданство", trade:"Специальность", checkIn:"Приход", checkOut:"Уход", signature:"Подпись", completed:"Отметка ухода", noName:"Без имени", noLogs:"За эту дату нет журнала безопасности с отметкой ухода.", loading:"Загрузка..." },
};

const DAILY_LOG_LOCALES: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", ru: "ru-RU" };

type DailyLog = {
  id: string;
  worker_id: string;
  site_id: string;
  work_date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  tbm_signed_at: string | null;
  attendance_summary: {
    tbm_count?: number;
    tbm_signed_count?: number;
    has_tbm_signature?: boolean;
  };
  worker?: {
    worker_code?: string;
    full_name?: string;
    nationality?: string;
    trade?: string;
    preferred_lang?: string;
  } | null;
};

function todaySeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function timeLabel(value: string | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminNfcDailyLogsPage() {
  const lang = useDisplayLanguage();
  const t = DAILY_LOG_UI[lang] || DAILY_LOG_UI.en;
  const locale = DAILY_LOG_LOCALES[lang] || DAILY_LOG_LOCALES.en;
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [workDate, setWorkDate] = useState(todaySeoul());
  const [adminSiteId, setAdminSiteId] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ work_date: workDate, limit: "200" });
    if (adminSiteId) params.set("site_id", adminSiteId);
    const res = await fetch(`/api/nfc/daily-safety-logs?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
    }
    setLoading(false);
  }, [adminSiteId, workDate]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: { site_id?: string | null } } | null) => {
        if (!cancelled && data?.profile?.site_id) {
          setAdminSiteId(data.profile.site_id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const signedCount = logs.filter((log) => log.attendance_summary?.has_tbm_signature).length;

  const handleExport = async (format: ExportFormat) => {
    await exportData(format, {
      title: t.report,
      subtitle: `${workDate} / ${t.site} ${adminSiteId || "-"}`,
      filename: `nfc_daily_logs_${adminSiteId || "site"}_${workDate}`,
      summary: [
        { label: t.allLogs, value: logs.length },
        { label: t.tbmSigned, value: signedCount },
        { label: t.unsigned, value: Math.max(logs.length - signedCount, 0) },
      ],
      columns: [
        { key: "worker", label: t.worker, value: (row) => row.worker?.full_name ?? row.worker_id },
        { key: "worker_code", label: t.workerCode, value: (row) => row.worker?.worker_code ?? "" },
        { key: "nationality", label: t.nationality, value: (row) => row.worker?.nationality ?? "" },
        { key: "trade", label: t.trade, value: (row) => row.worker?.trade ?? "" },
        { key: "check_in_at", label: t.checkIn, value: (row) => timeLabel(row.check_in_at, locale) },
        { key: "check_out_at", label: t.checkOut, value: (row) => timeLabel(row.check_out_at, locale) },
        { key: "tbm", label: "TBM", value: (row) => `${row.attendance_summary?.tbm_signed_count ?? 0}/${row.attendance_summary?.tbm_count ?? 0}` },
        { key: "tbm_signed_at", label: t.signature, value: (row) => row.attendance_summary?.has_tbm_signature ? timeLabel(row.tbm_signed_at, locale) : t.unsigned },
      ],
      rows: logs,
      raw: { siteId: adminSiteId, workDate, logs },
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <main className="visualization-light min-h-screen p-4">
        <section className="max-w-5xl mx-auto">
          <div className="concept-page-header flex-wrap">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-green-400" />
            </div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <ExportMenu disabled={logs.length === 0} onExport={handleExport} />
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={workDate}
                  onChange={(event) => setWorkDate(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={fetchLogs}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-2"
                aria-label={t.refresh}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="admin-concept-hero relative mb-5 h-40 w-full overflow-hidden rounded-2xl border border-gray-800">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/diary.webp" />
              <Image src="/images/mobile-v3/website/diary.webp" alt="NFC daily safety logs" fill className="object-cover" />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ LINK DAILY LOG</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t.completed}</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t.tbmSigned}</p>
              <p className="text-2xl font-bold">{signedCount}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t.unsigned}</p>
              <p className="text-2xl font-bold">{Math.max(logs.length - signedCount, 0)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">{t.worker}</th>
                  <th className="text-left px-3 py-3 font-medium">{t.checkIn}</th>
                  <th className="text-left px-3 py-3 font-medium">{t.checkOut}</th>
                  <th className="text-left px-3 py-3 font-medium">TBM</th>
                  <th className="text-left px-3 py-3 font-medium">{t.signature}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {logs.map((log) => {
                  const hasSignature = Boolean(log.attendance_summary?.has_tbm_signature);
                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">{log.worker?.full_name ?? t.noName}</p>
                        <p className="text-xs text-gray-500 font-mono">{log.worker?.worker_code ?? log.worker_id}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-300">{timeLabel(log.check_in_at, locale)}</td>
                      <td className="px-3 py-3 text-gray-300">{timeLabel(log.check_out_at, locale)}</td>
                      <td className="px-3 py-3 text-gray-300">
                        {log.attendance_summary?.tbm_signed_count ?? 0}/{log.attendance_summary?.tbm_count ?? 0}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                          hasSignature ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
                        }`}>
                          {hasSignature ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {hasSignature ? timeLabel(log.tbm_signed_at, locale) : t.unsigned}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                      {t.noLogs}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                      {t.loading}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </RoleGuard>
  );
}

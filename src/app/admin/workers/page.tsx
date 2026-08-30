"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, QrCode, RefreshCw, Search, UserX, Users, X } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const WORKERS_UI: Record<string, Record<string, string>> = {
  ko: { report:"NFC 근로자 관리대장", site:"현장", all:"전체 근로자", active:"활성", inactive:"비활성", consent:"동의 서명", workerCode:"근로자 코드", name:"이름", nationality:"국적", trade:"공종", language:"언어", status:"상태", consentDate:"동의 서명일", enrolledAt:"등록일", deactivateConfirm:"{name} 근로자를 비활성화하시겠습니까? 활성 NFC/QR 링크가 모두 폐기됩니다.", qrFailed:"QR URL 발급에 실패했습니다.", issueCard:"카드 발급", title:"NFC 근로자 관리", desc:"근로자 등록 정보와 NFC 카드 발급 상태를 관리합니다.", searchPlaceholder:"이름 또는 근로자 코드 검색", search:"검색", loading:"불러오는 중...", workers:"근로자 {count}명", qrTitle:"NFC 사용이 어려울 때 쓰는 근로자 SQ Link QR", deactivate:"비활성화", empty:"등록된 근로자가 없습니다.", back:"뒤로 가기", workerQr:"근로자 SQ Link QR", qrInfo:"NFC 인식이 어려울 때 근로자가 이 QR을 스캔할 수 있습니다.", reissueQr:"새 QR 발급" },
  en: { report:"NFC Worker Register", site:"Site", all:"All workers", active:"Active", inactive:"Inactive", consent:"Consent signature", workerCode:"Worker code", name:"Name", nationality:"Nationality", trade:"Trade", language:"Language", status:"Status", consentDate:"Consent signed at", enrolledAt:"Registered at", deactivateConfirm:"Deactivate worker {name}? All active NFC/QR links will be revoked.", qrFailed:"Failed to issue QR URL.", issueCard:"Issue card", title:"NFC Worker Management", desc:"Manage worker registration information and NFC card issuance status.", searchPlaceholder:"Search by name or worker code", search:"Search", loading:"Loading...", workers:"{count} workers", qrTitle:"Worker SQ Link QR for cases where NFC is difficult to use", deactivate:"Deactivate", empty:"No workers are registered.", back:"Back", workerQr:"Worker SQ Link QR", qrInfo:"Workers can scan this QR when NFC recognition is difficult.", reissueQr:"Issue new QR" },
  zh: { report:"NFC 工人管理台账", site:"现场", all:"全部工人", active:"已激活", inactive:"未激活", consent:"同意签名", workerCode:"工人代码", name:"姓名", nationality:"国籍", trade:"工种", language:"语言", status:"状态", consentDate:"同意签名日期", enrolledAt:"登记日期", deactivateConfirm:"要停用工人 {name} 吗？所有有效 NFC/QR 链接将被废止。", qrFailed:"二维码网址发放失败。", issueCard:"发放卡片", title:"NFC 工人管理", desc:"管理工人登记信息和 NFC 卡发放状态。", searchPlaceholder:"按姓名或工人代码搜索", search:"搜索", loading:"正在加载...", workers:"{count} 名工人", qrTitle:"NFC 使用困难时使用的工人 SQ Link 二维码", deactivate:"停用", empty:"没有已登记的工人。", back:"返回", workerQr:"工人 SQ Link 二维码", qrInfo:"当 NFC 识别困难时，工人可以扫描此二维码。", reissueQr:"重新发放二维码" },
  vi: { report:"Sổ quản lý công nhân NFC", site:"Công trường", all:"Tất cả công nhân", active:"Đang hoạt động", inactive:"Không hoạt động", consent:"Chữ ký đồng ý", workerCode:"Mã công nhân", name:"Tên", nationality:"Quốc tịch", trade:"Công việc", language:"Ngôn ngữ", status:"Trạng thái", consentDate:"Ngày ký đồng ý", enrolledAt:"Ngày đăng ký", deactivateConfirm:"Vô hiệu hóa công nhân {name}? Tất cả liên kết NFC/QR đang hoạt động sẽ bị hủy.", qrFailed:"Không thể cấp URL QR.", issueCard:"Cấp thẻ", title:"Quản lý công nhân NFC", desc:"Quản lý thông tin đăng ký công nhân và trạng thái cấp thẻ NFC.", searchPlaceholder:"Tìm theo tên hoặc mã công nhân", search:"Tìm kiếm", loading:"Đang tải...", workers:"{count} công nhân", qrTitle:"QR SQ Link cho công nhân khi khó dùng NFC", deactivate:"Vô hiệu hóa", empty:"Không có công nhân đã đăng ký.", back:"Quay lại", workerQr:"QR SQ Link công nhân", qrInfo:"Công nhân có thể quét QR này khi nhận diện NFC khó khăn.", reissueQr:"Cấp QR mới" },
  ru: { report:"Реестр работников NFC", site:"Объект", all:"Все работники", active:"Активные", inactive:"Неактивные", consent:"Подпись согласия", workerCode:"Код работника", name:"Имя", nationality:"Гражданство", trade:"Специальность", language:"Язык", status:"Статус", consentDate:"Дата подписи согласия", enrolledAt:"Дата регистрации", deactivateConfirm:"Деактивировать работника {name}? Все активные ссылки NFC/QR будут отозваны.", qrFailed:"Не удалось выдать QR URL.", issueCard:"Выдать карту", title:"Управление работниками NFC", desc:"Управляйте данными регистрации работников и статусом выдачи NFC-карт.", searchPlaceholder:"Поиск по имени или коду работника", search:"Поиск", loading:"Загрузка...", workers:"Работников: {count}", qrTitle:"QR SQ Link для работника, если NFC трудно использовать", deactivate:"Деактивировать", empty:"Нет зарегистрированных работников.", back:"Назад", workerQr:"QR SQ Link работника", qrInfo:"Работник может отсканировать этот QR, если NFC распознаётся с трудом.", reissueQr:"Выдать новый QR" },
};
const WORKERS_LOCALES: Record<string, string> = { ko:"ko-KR", en:"en-US", zh:"zh-CN", vi:"vi-VN", ru:"ru-RU" };

interface Worker {
  id: string;
  worker_code: string;
  full_name: string;
  nationality: string;
  trade: string;
  preferred_lang: string;
  is_active: boolean;
  consent_signed_at: string | null;
  created_at: string;
}

type QrData = {
  qrUrl: string;
  sigVersion?: number;
  ndefBytes?: number;
};

type QrModal = {
  worker: Worker;
  token: QrData | null;
  loading: boolean;
  error: string;
};

export default function AdminWorkersPage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = WORKERS_UI[lang] || WORKERS_UI.en;
  const locale = WORKERS_LOCALES[lang] || WORKERS_LOCALES.en;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [adminSiteId, setAdminSiteId] = useState("");
  const [qrModal, setQrModal] = useState<QrModal | null>(null);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", "100");
    const res = await fetch(`/api/nfc/workers?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setWorkers(data.workers ?? []);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { profile?: { site_id?: string | null } | null } | null) => {
        const siteId = data?.profile?.site_id;
        if (siteId) setAdminSiteId(siteId);
      })
      .catch(() => undefined);
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(search.trim());
  };

  const handleExport = async (format: ExportFormat) => {
    await exportData(format, {
      title: t.report,
      subtitle: `${t.site} ${adminSiteId || "-"} / ${new Date().toLocaleString(locale)}`,
      filename: `nfc_workers_${adminSiteId || "site"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: t.all, value: workers.length },
        { label: t.active, value: workers.filter((worker) => worker.is_active).length },
        { label: t.consent, value: workers.filter((worker) => worker.consent_signed_at).length },
      ],
      columns: [
        { key: "worker_code", label: t.workerCode }, { key: "full_name", label: t.name }, { key: "nationality", label: t.nationality }, { key: "trade", label: t.trade }, { key: "preferred_lang", label: t.language },
        { key: "is_active", label: t.status, value: (row) => row.is_active ? t.active : t.inactive }, { key: "consent_signed_at", label: t.consentDate }, { key: "created_at", label: t.enrolledAt },
      ],
      rows: workers,
      raw: { siteId: adminSiteId, workers },
    });
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(t.deactivateConfirm.replace("{name}", name))) return;
    await fetch(`/api/nfc/workers/${id}`, { method: "DELETE" });
    fetchWorkers();
  };

  const handleOpenQr = async (worker: Worker) => {
    setQrModal({ worker, token: null, loading: true, error: "" });
    try {
      const res = await fetch("/api/nfc/sticker/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: worker.id, revoke_previous: false }),
      });
      const data = await res.json() as {
        url?: string;
        sig_version?: number;
        ndef_bytes?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.url) throw new Error(data.detail ?? data.error ?? t.qrFailed);
      const qrUrl = data.url;
      setQrModal((prev) => prev ? {
        ...prev,
        token: { qrUrl, sigVersion: data.sig_version, ndefBytes: data.ndef_bytes },
        loading: false,
      } : null);
    } catch (err) {
      setQrModal((prev) => prev ? {
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      } : null);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="concept-page-header flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              {adminSiteId && <p className="text-xs text-gray-500 font-mono">{adminSiteId}</p>}
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu disabled={workers.length === 0} onExport={handleExport} />
            <button
              onClick={() => router.push("/admin/workers/enroll")}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.issueCard}
            </button>
            </div>
          </div>

          <div className="admin-concept-hero relative rounded-2xl overflow-hidden h-40 w-full mb-4">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/onboarding.webp" />
              <Image src="/images/mobile-v3/website/onboarding.webp" alt="Workers Roster" fill className="object-cover" />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ LINK WORKERS</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
              {t.search}
            </button>
            <button type="button" onClick={fetchWorkers} className="bg-gray-700 hover:bg-gray-600 p-2.5 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </form>

          <p className="text-gray-500 text-sm mb-3">
            {loading ? t.loading : t.workers.replace("{count}", String(workers.length))}
          </p>

          <div className="space-y-2">
            {workers.map((worker) => (
              <div key={worker.id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{worker.full_name}</span>
                    <span className="text-xs text-gray-500 font-mono">{worker.worker_code}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {worker.nationality} | {worker.trade} | {worker.preferred_lang.toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => router.push(`/admin/workers/enroll?worker_id=${worker.id}`)}
                    className="bg-green-800 hover:bg-green-700 text-green-100 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    NFC
                  </button>
                  <button
                    onClick={() => handleOpenQr(worker)}
                    className="bg-purple-800 hover:bg-purple-700 text-purple-100 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    title={t.qrTitle}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR
                  </button>
                  <button
                    onClick={() => handleDeactivate(worker.id, worker.full_name)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title={t.deactivate}
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            ))}
            {!loading && workers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t.empty}</p>
              </div>
            )}
          </div>

          <button onClick={() => router.back()} className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors">
            {t.back}
          </button>
        </div>
      </div>

      {qrModal && (
        <div className="safe-area-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setQrModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-white">{qrModal.worker.full_name}</p>
                <p className="text-xs text-gray-500 font-mono">{qrModal.worker.worker_code}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-4">
              {t.workerQr}
            </p>
            {qrModal.loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {qrModal.error && (
              <p className="text-red-400 text-sm text-center py-4">{qrModal.error}</p>
            )}
            {qrModal.token && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl">
                  <Image
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrModal.token.qrUrl)}`}
                    alt={t.workerQr}
                    width={240}
                    height={240}
                    unoptimized
                  />
                </div>
                <p className="text-xs font-mono text-blue-400 break-all text-center">{qrModal.token.qrUrl}</p>
                <p className="text-xs text-gray-500 text-center">
                  {t.qrInfo}
                </p>
                <button
                  onClick={() => handleOpenQr(qrModal.worker)}
                  className="w-full bg-purple-700 hover:bg-purple-600 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                >
                  {t.reissueQr}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}

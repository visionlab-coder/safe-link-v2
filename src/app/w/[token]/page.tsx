"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, ShieldX, HardHat, Crown, Loader2, AlertTriangle, MapPin } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const SCAN_UI: Record<string, Record<string, string>> = {
  ko: { loading: "근로자 정보를 조회 중입니다...", worker: "현장 근로자", manager: "관리자", trade: "공종", site: "현장", safety: "안전교육", valid: "안전교육 이수 완료", invalid: "안전교육 미이수", id: "근로자 ID", missing: "미등록 NFC 카드", duplicate: "중복 토큰 감지", error: "조회 오류", request: "관리자에게 NFC 카드 등록을 요청하세요.", lookupFailed: "조회 중 오류가 발생했습니다" },
  en: { loading: "Loading worker information...", worker: "Site worker", manager: "Manager", trade: "Trade", site: "Worksite", safety: "Safety training", valid: "Safety training completed", invalid: "Safety training incomplete", id: "Worker ID", missing: "Unregistered NFC card", duplicate: "Duplicate token detected", error: "Lookup error", request: "Ask the manager to register this NFC card.", lookupFailed: "An error occurred while looking up information." },
  zh: { loading: "正在查询工人信息...", worker: "现场工人", manager: "管理员", trade: "工种", site: "现场", safety: "安全教育", valid: "已完成安全教育", invalid: "未完成安全教育", id: "工人 ID", missing: "未注册的 NFC 卡", duplicate: "检测到重复令牌", error: "查询错误", request: "请管理员登记此 NFC 卡。", lookupFailed: "查询时发生错误。" },
  vi: { loading: "Đang tra cứu thông tin công nhân...", worker: "Công nhân công trường", manager: "Quản lý", trade: "Ngành nghề", site: "Công trường", safety: "Đào tạo an toàn", valid: "Đã hoàn thành đào tạo an toàn", invalid: "Chưa hoàn thành đào tạo an toàn", id: "ID công nhân", missing: "Thẻ NFC chưa đăng ký", duplicate: "Phát hiện mã trùng lặp", error: "Lỗi tra cứu", request: "Hãy yêu cầu quản lý đăng ký thẻ NFC này.", lookupFailed: "Đã xảy ra lỗi khi tra cứu." },
  ru: { loading: "Загрузка данных работника...", worker: "Работник объекта", manager: "Администратор", trade: "Специальность", site: "Объект", safety: "Обучение безопасности", valid: "Обучение безопасности пройдено", invalid: "Обучение безопасности не пройдено", id: "ID работника", missing: "Незарегистрированная NFC-карта", duplicate: "Обнаружен повторяющийся токен", error: "Ошибка проверки", request: "Попросите администратора зарегистрировать эту NFC-карту.", lookupFailed: "При проверке произошла ошибка." },
};

type WorkerData = {
  worker_id: string;
  name: string;
  nationality: string;
  language: string;
  site_id: string;
  role: "worker" | "manager";
  trade?: string;
  safety_cert_valid: boolean;
};

type ApiResult =
  | { status: "success"; data: WorkerData; timestamp: string }
  | { status: "not_found" | "duplicate" | "error"; error_code: string; message: string }
  | { status: "error"; error_code: "E003"; message: string };

const ISO_TO_FLAG: Record<string, string> = {
  KR: "kr", VN: "vn", CN: "cn", TH: "th", UZ: "uz",
  PH: "ph", KH: "kh", ID: "id", MN: "mn", MM: "mm",
  NP: "np", BD: "bd", KZ: "kz", RU: "ru", IN: "in",
};

export default function WorkerNfcScanPage() {
  const params = useParams();
  const token = params.token as string;
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const language = useDisplayLanguage();
  const t = SCAN_UI[language] ?? SCAN_UI.en;

  useEffect(() => {
    if (!token) return;
    fetch(`/api/hiinfo/lookup/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: ApiResult) => setResult(data))
      .catch(() =>
        setResult({ status: "error", error_code: "E500", message: t.lookupFailed })
      )
      .finally(() => setLoading(false));
  }, [token, t.lookupFailed]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: "#050508" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <BrandLogo compact className="justify-center opacity-60" imageClassName="max-w-[140px]" />

        {loading && <LoadingCard text={t.loading} />}
        {!loading && result?.status === "success" && <WorkerCard data={result.data} t={t} />}
        {!loading && result && result.status !== "success" && <ErrorCard result={result as Exclude<ApiResult, { status: "success" }>} t={t} />}

        <p className="text-[10px] text-slate-700 font-black tracking-[0.4em] uppercase">
          SQ Link · POWERED BY HI-INFO
        </p>
      </div>
    </main>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div
      className="w-full rounded-3xl p-8 flex flex-col items-center gap-4"
      style={{ background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      <p className="text-slate-400 text-sm font-bold tracking-wide">{text}</p>
    </div>
  );
}

function WorkerCard({ data, t }: { data: WorkerData; t: Record<string, string> }) {
  const flagIso = ISO_TO_FLAG[data.nationality.toUpperCase()] ?? "un";
  const isManager = data.role === "manager";

  return (
    <div
      className="w-full rounded-3xl overflow-hidden"
      style={{ background: "rgba(10,11,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
    >
      {/* 상단 색상 배너 */}
      <div
        className="h-2 w-full"
        style={{
          background: isManager
            ? "linear-gradient(90deg,#2563EB,#3B82F6)"
            : "linear-gradient(90deg,#059669,#10B981)",
        }}
      />

      <div className="p-6 flex flex-col gap-5">
        {/* 이름 + 국기 */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isManager ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)",
              border: `1px solid ${isManager ? "rgba(59,130,246,0.3)" : "rgba(16,185,129,0.3)"}`,
            }}
          >
            {isManager
              ? <Crown className="w-7 h-7" style={{ color: "#93C5FD" }} />
              : <HardHat className="w-7 h-7" style={{ color: "#6EE7B7" }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-lg font-black leading-tight truncate">{data.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-6 h-4 rounded overflow-hidden border border-white/10 flex-shrink-0">
                <Image
                  src={`https://flagcdn.com/w40/${flagIso}.png`}
                  alt={data.nationality}
                  width={24}
                  height={16}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="text-xs text-slate-400 font-bold">{data.nationality}</span>
              <span className="text-slate-700">·</span>
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{
                  background: isManager ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)",
                  color: isManager ? "#93C5FD" : "#6EE7B7",
                }}
              >
                {data.role === "manager" ? t.manager : t.worker}
              </span>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

        {/* 상세 정보 */}
        <div className="flex flex-col gap-3">
          {data.trade && (
            <InfoRow icon="🔧" label={t.trade} value={data.trade} />
          )}
          <InfoRow
            icon={<MapPin className="w-3.5 h-3.5 text-slate-500" />}
            label={t.site}
            value={data.site_id}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">{t.safety}</span>
            <div className="flex items-center gap-1.5">
              {data.safety_cert_valid
                ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
                : <ShieldX className="w-4 h-4 text-red-400" />
              }
              <span
                className="text-xs font-black"
                style={{ color: data.safety_cert_valid ? "#34D399" : "#F87171" }}
              >
                {data.safety_cert_valid ? t.valid : t.invalid}
              </span>
            </div>
          </div>
        </div>

        {/* 근로자 ID */}
        <div
          className="rounded-xl px-3 py-2 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{t.id}</span>
          <span className="text-xs text-slate-400 font-mono">{data.worker_id}</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {typeof icon === "string" ? (
          <span className="text-xs">{icon}</span>
        ) : icon}
        <span className="text-xs text-slate-500 font-bold">{label}</span>
      </div>
      <span className="text-xs text-slate-300 font-bold">{value}</span>
    </div>
  );
}

function ErrorCard({ result, t }: { result: Exclude<ApiResult, { status: "success" }>; t: Record<string, string> }) {
  const isNotFound = result.status === "not_found";
  const isDuplicate = result.status === "duplicate";

  const colors = isNotFound
    ? { border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.06)", icon: "text-red-400" }
    : isDuplicate
      ? { border: "rgba(245,158,11,0.3)", bg: "rgba(245,158,11,0.06)", icon: "text-amber-400" }
      : { border: "rgba(100,116,139,0.3)", bg: "rgba(100,116,139,0.06)", icon: "text-slate-400" };

  return (
    <div
      className="w-full rounded-3xl p-6 flex flex-col items-center gap-4 text-center"
      style={{
        background: "rgba(10,11,20,0.95)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: colors.bg }}
      >
        <AlertTriangle className={`w-7 h-7 ${colors.icon}`} />
      </div>
      <div>
        <p className="text-white font-black text-base">
          {isNotFound ? t.missing : isDuplicate ? t.duplicate : t.error}
        </p>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">{result.message}</p>
        <p className="text-slate-700 text-[10px] font-mono mt-2">{result.error_code}</p>
      </div>
      {isNotFound && (
        <p className="text-xs text-slate-600 leading-relaxed">
          {t.request}
        </p>
      )}
    </div>
  );
}

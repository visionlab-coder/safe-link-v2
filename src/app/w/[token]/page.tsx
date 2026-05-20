"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, ShieldX, HardHat, Crown, Loader2, AlertTriangle, MapPin } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

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

const ROLE_LABEL: Record<string, string> = {
  worker: "현장 근로자",
  manager: "관리자",
};

const SAFETY_LABEL = {
  valid: "안전교육 이수 완료",
  invalid: "안전교육 미이수",
};

export default function WorkerNfcScanPage() {
  const params = useParams();
  const token = params.token as string;
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/hiinfo/lookup/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: ApiResult) => setResult(data))
      .catch(() =>
        setResult({ status: "error", error_code: "E500", message: "조회 중 오류가 발생했습니다" })
      )
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: "#050508" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <BrandLogo compact className="justify-center opacity-60" imageClassName="max-w-[140px]" />

        {loading && <LoadingCard />}
        {!loading && result?.status === "success" && <WorkerCard data={result.data} />}
        {!loading && result && result.status !== "success" && <ErrorCard result={result as Exclude<ApiResult, { status: "success" }>} />}

        <p className="text-[10px] text-slate-700 font-black tracking-[0.4em] uppercase">
          SAFE-LINK · POWERED BY HI-INFO
        </p>
      </div>
    </main>
  );
}

function LoadingCard() {
  return (
    <div
      className="w-full rounded-3xl p-8 flex flex-col items-center gap-4"
      style={{ background: "rgba(10,11,20,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      <p className="text-slate-400 text-sm font-bold tracking-wide">근로자 정보 조회 중...</p>
    </div>
  );
}

function WorkerCard({ data }: { data: WorkerData }) {
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
                {ROLE_LABEL[data.role] ?? data.role}
              </span>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

        {/* 상세 정보 */}
        <div className="flex flex-col gap-3">
          {data.trade && (
            <InfoRow icon="🔧" label="공종" value={data.trade} />
          )}
          <InfoRow
            icon={<MapPin className="w-3.5 h-3.5 text-slate-500" />}
            label="현장"
            value={data.site_id}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">안전교육</span>
            <div className="flex items-center gap-1.5">
              {data.safety_cert_valid
                ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
                : <ShieldX className="w-4 h-4 text-red-400" />
              }
              <span
                className="text-xs font-black"
                style={{ color: data.safety_cert_valid ? "#34D399" : "#F87171" }}
              >
                {data.safety_cert_valid ? SAFETY_LABEL.valid : SAFETY_LABEL.invalid}
              </span>
            </div>
          </div>
        </div>

        {/* 근로자 ID */}
        <div
          className="rounded-xl px-3 py-2 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Worker ID</span>
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

function ErrorCard({ result }: { result: Exclude<ApiResult, { status: "success" }> }) {
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
          {isNotFound ? "미등록 NFC 카드" : isDuplicate ? "중복 토큰 감지" : "조회 오류"}
        </p>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">{result.message}</p>
        <p className="text-slate-700 text-[10px] font-mono mt-2">{result.error_code}</p>
      </div>
      {isNotFound && (
        <p className="text-xs text-slate-600 leading-relaxed">
          관리자에게 NFC 카드 등록을 요청하세요.
        </p>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { BarChart3, ArrowLeft, RefreshCw, Shield, Users, AlertTriangle, PenLine, Link, Mic } from "lucide-react";

type Site = { id: string; name: string; code?: string | null };
type EsgReport = {
  siteId: string;
  period: { from: string; to: string };
  tbm: { totalSessions: number; totalAttendance: number; certificationRate: number };
  quiz: { avgScore: number | null };
  safetyEquipment: { totalGrants: number };
  stopWork: { totalIncidents: number; resolvedCount: number };
  pledges: { totalPledges: number; signedCount: number; signatureRate: number };
  auditChain: { totalEvents: number };
  interpretation: { totalSessions: number | null };
  generatedAt: string;
  report?: unknown;
};

type EsgMetricRow = {
  category: string;
  metric: string;
  value: string | number;
  detail: string;
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  rate,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  rate?: number;
}) {
  return (
    <div className={`bg-gray-800 rounded-2xl p-5 border border-gray-700 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/10`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        {rate !== undefined && (
          <span className={`text-sm font-black ${rate >= 0.8 ? "text-green-400" : rate >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
            {(rate * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      {rate !== undefined && (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${rate >= 0.8 ? "bg-green-500" : rate >= 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(rate * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function VennDiagram({ report }: { report: EsgReport }) {
  const tbm = Math.round(report.tbm.certificationRate * 100);
  const pledge = Math.round(report.pledges.signatureRate * 100);
  const stopWork =
    report.stopWork.totalIncidents > 0
      ? Math.round((report.stopWork.resolvedCount / report.stopWork.totalIncidents) * 100)
      : 100;
  const overlap = Math.round((tbm + pledge + stopWork) / 3);

  return (
    <div className="mt-4 bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Safety Venn</p>
          <h2 className="text-lg font-black text-white">TBM · 서약 · 작업중지 교차 집계</h2>
        </div>
        <p className="text-3xl font-black text-emerald-400">{overlap}%</p>
      </div>
      <div className="max-w-[280px] mx-auto relative h-60">
        <div className="absolute left-0 top-0 w-[150px] h-[150px] rounded-full bg-blue-500/30 border border-blue-400/50 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wide">TBM</span>
          <span className="text-3xl font-black text-blue-100">{tbm}%</span>
        </div>
        <div className="absolute right-0 top-0 w-[150px] h-[150px] rounded-full bg-emerald-500/30 border border-emerald-400/50 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-emerald-300 font-bold">서약</span>
          <span className="text-3xl font-black text-emerald-100">{pledge}%</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[150px] h-[150px] rounded-full bg-amber-500/30 border border-amber-400/50 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-amber-300 font-bold">작업중지</span>
          <span className="text-3xl font-black text-amber-100">{stopWork}%</span>
        </div>
        <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 bg-gray-950/95 border border-white/20 rounded-xl px-3 py-2 text-center z-10 shadow-xl">
          <p className="text-[10px] text-gray-400 font-bold">교차 평균</p>
          <p className="text-xl font-black text-white">{overlap}%</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminEsgPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<EsgReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSites, setLoadingSites] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: prof } = await supabase.from("profiles").select("role, site_id").eq("id", session.user.id).maybeSingle();
      const isHq = ["HQ_ADMIN", "ROOT", "HQ_OFFICER", "SUPER_ADMIN"].includes((prof as { role?: string } | null)?.role ?? "");

      let siteRows: Site[] = [];
      if (isHq) {
        const { data } = await supabase.from("sites").select("id, name, code").order("name");
        siteRows = (data ?? []) as Site[];
      } else if ((prof as { site_id?: string } | null)?.site_id) {
        const { data } = await supabase.from("sites").select("id, name, code").eq("id", (prof as { site_id: string }).site_id).limit(1);
        siteRows = (data ?? []) as Site[];
      }

      setSites(siteRows);
      setSelectedSiteId((prof as { site_id?: string } | null)?.site_id ?? siteRows[0]?.id ?? "");
      setLoadingSites(false);
    });
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/esg/report?siteId=${selectedSiteId}&from=${from}&to=${to}`);
      const data = await res.json() as EsgReport & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setReport(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId, from, to]);

  useEffect(() => {
    if (selectedSiteId && !loadingSites) {
      fetchReport();
    }
  }, [fetchReport, loadingSites, selectedSiteId]);

  const buildExportRows = (current: EsgReport): EsgMetricRow[] => [
    {
      category: "TBM",
      metric: "TBM 세션",
      value: current.tbm.totalSessions,
      detail: `참석 ${current.tbm.totalAttendance}명`,
    },
    {
      category: "TBM",
      metric: "TBM 인증률",
      value: `${Math.round(current.tbm.certificationRate * 100)}%`,
      detail: `${Math.round(current.tbm.certificationRate * current.tbm.totalAttendance)} / ${current.tbm.totalAttendance}명`,
    },
    {
      category: "서약",
      metric: "안전서약",
      value: current.pledges.totalPledges,
      detail: `서명 완료 ${current.pledges.signedCount}건, 서명률 ${Math.round(current.pledges.signatureRate * 100)}%`,
    },
    {
      category: "작업중지",
      metric: "작업중지 개입",
      value: current.stopWork.totalIncidents,
      detail: `해결 ${current.stopWork.resolvedCount} / 총 ${current.stopWork.totalIncidents}`,
    },
    {
      category: "감사",
      metric: "감사체인 이벤트",
      value: current.auditChain.totalEvents,
      detail: "SHA-256 리포트 무결성 기록",
    },
    {
      category: "통역",
      metric: "라이브 통역 세션",
      value: current.interpretation.totalSessions ?? "-",
      detail: "기간 내 라이브 통역 집계",
    },
    {
      category: "장비",
      metric: "안전장비 지급",
      value: current.safetyEquipment.totalGrants,
      detail: "퀴즈/인센티브 기반 지급 건수",
    },
  ];

  const esgScore = report
    ? Math.round(
        (report.tbm.certificationRate * 40) +
        (report.pledges.signatureRate * 30) +
        (report.stopWork.totalIncidents > 0 ? (report.stopWork.resolvedCount / report.stopWork.totalIncidents) * 20 : 20) +
        (report.tbm.totalSessions > 0 ? 10 : 0),
      )
    : 0;

  const handleExport = async (format: ExportFormat) => {
    if (!report) return;
    await exportData(format, {
      title: "ESG 안전 리포트",
      subtitle: `${report.period.from} ~ ${report.period.to} / 자동 집계`,
      filename: `esg_safety_report_${report.siteId}_${report.period.from}_${report.period.to}`,
      summary: [
        { label: "ESG 종합 점수", value: `${esgScore}/100` },
        { label: "TBM 인증률", value: `${Math.round(report.tbm.certificationRate * 100)}%` },
        { label: "서약 서명률", value: `${Math.round(report.pledges.signatureRate * 100)}%` },
        { label: "작업중지 해결", value: `${report.stopWork.resolvedCount}/${report.stopWork.totalIncidents}` },
      ],
      columns: [
        { key: "category", label: "구분" },
        { key: "metric", label: "지표" },
        { key: "value", label: "값" },
        { key: "detail", label: "상세" },
      ],
      rows: buildExportRows(report),
      raw: report,
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold">ESG 안전 리포트</h1>
            <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-bold">청구항 24</span>
          </div>

          <div className="relative rounded-2xl overflow-hidden h-40 w-full mb-4">
            <Image
              src="/images/safelink-pages/esg-safety-report.png"
              alt="ESG Safety Report"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          <div className="bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-700 flex flex-col gap-3">
            {loadingSites ? (
              <p className="text-sm text-gray-500">현장 로딩 중...</p>
            ) : (
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.code ? `[${s.code}] ` : ""}{s.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 block">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 block">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchReport}
                disabled={loading || !selectedSiteId}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                리포트 생성
              </button>
              <ExportMenu disabled={!report} includeJson onExport={handleExport} />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4 text-sm text-red-400">{error}</div>
          )}

          {report && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  {report.period.from} ~ {report.period.to}
                </p>
                <p className="text-xs text-gray-600">{new Date(report.generatedAt).toLocaleString("ko-KR")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Shield}
                  label="TBM 세션"
                  value={report.tbm.totalSessions}
                  sub={`참석 ${report.tbm.totalAttendance}명`}
                  color="blue"
                  rate={report.tbm.certificationRate}
                />
                <StatCard
                  icon={Users}
                  label="이수 인증율"
                  value={`${(report.tbm.certificationRate * 100).toFixed(0)}%`}
                  sub={`${Math.round(report.tbm.certificationRate * report.tbm.totalAttendance)} / ${report.tbm.totalAttendance}명`}
                  color="green"
                  rate={report.tbm.certificationRate}
                />
                <StatCard
                  icon={PenLine}
                  label="안전 서약"
                  value={report.pledges.totalPledges}
                  sub={`서명 완료 ${report.pledges.signedCount}건`}
                  color="purple"
                  rate={report.pledges.signatureRate}
                />
                <StatCard
                  icon={AlertTriangle}
                  label="작업중지 요청"
                  value={report.stopWork.totalIncidents}
                  sub={`해결 ${report.stopWork.resolvedCount} / 총 ${report.stopWork.totalIncidents}`}
                  color="red"
                  rate={report.stopWork.totalIncidents > 0 ? report.stopWork.resolvedCount / report.stopWork.totalIncidents : 1}
                />
                <StatCard
                  icon={Link}
                  label="감사 체인 기록"
                  value={report.auditChain.totalEvents}
                  sub="SHA-256 해시 체인"
                  color="yellow"
                />
                <StatCard
                  icon={Mic}
                  label="실시간 통역"
                  value={report.interpretation.totalSessions ?? "—"}
                  sub="다국어 세션"
                  color="cyan"
                />
              </div>

              {report.safetyEquipment.totalGrants > 0 && (
                <div className="mt-3 bg-gray-800 rounded-2xl p-4 border border-yellow-500/20 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">안전장비 지급</p>
                    <p className="text-2xl font-black text-yellow-400">{report.safetyEquipment.totalGrants}건</p>
                  </div>
                </div>
              )}

              <VennDiagram report={report} />

              <div className="mt-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">ESG 종합 점수</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-emerald-400">
                    {Math.round(
                      ((report.tbm.certificationRate * 40) +
                       (report.pledges.signatureRate * 30) +
                       (report.stopWork.totalIncidents > 0 ? (report.stopWork.resolvedCount / report.stopWork.totalIncidents) * 20 : 20) +
                       (report.tbm.totalSessions > 0 ? 10 : 0))
                    )}
                  </span>
                  <span className="text-gray-500 text-lg font-bold mb-1">/ 100</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">TBM인증률(40) + 서약서명률(30) + 작업중지해결률(20) + 세션실시(10)</p>
              </div>
            </>
          )}

          {!report && !loading && (
            <div className="text-center py-16 text-gray-600">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold">현장과 기간을 선택 후 리포트를 생성하세요</p>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

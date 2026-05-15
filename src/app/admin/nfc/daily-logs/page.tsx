"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { CalendarDays, CheckCircle2, ClipboardList, RefreshCw, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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

function timeLabel(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminNfcDailyLogsPage() {
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
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("profiles")
        .select("site_id")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          const siteId = (data as { site_id?: string } | null)?.site_id;
          if (siteId) setAdminSiteId(siteId);
        });
    });
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const signedCount = logs.filter((log) => log.attendance_summary?.has_tbm_signature).length;

  return (
    <RoleGuard allowedRole="admin">
      <main className="min-h-screen bg-gray-950 text-white p-4">
        <section className="max-w-5xl mx-auto">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-green-400" />
              <div>
                <h1 className="text-xl font-bold">NFC 일일 안전일지</h1>
                <p className="text-xs text-gray-500">
                  퇴근 태깅 시 자동 업로드된 출결 및 TBM 서명 기록
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                aria-label="새로고침"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">퇴근 완료</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">TBM 서명</p>
              <p className="text-2xl font-bold">{signedCount}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">미서명</p>
              <p className="text-2xl font-bold">{Math.max(logs.length - signedCount, 0)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">근로자</th>
                  <th className="text-left px-3 py-3 font-medium">출근</th>
                  <th className="text-left px-3 py-3 font-medium">퇴근</th>
                  <th className="text-left px-3 py-3 font-medium">TBM</th>
                  <th className="text-left px-3 py-3 font-medium">서명</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {logs.map((log) => {
                  const hasSignature = Boolean(log.attendance_summary?.has_tbm_signature);
                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">{log.worker?.full_name ?? "이름 없음"}</p>
                        <p className="text-xs text-gray-500 font-mono">{log.worker?.worker_code ?? log.worker_id}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-300">{timeLabel(log.check_in_at)}</td>
                      <td className="px-3 py-3 text-gray-300">{timeLabel(log.check_out_at)}</td>
                      <td className="px-3 py-3 text-gray-300">
                        {log.attendance_summary?.tbm_signed_count ?? 0}/{log.attendance_summary?.tbm_count ?? 0}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                          hasSignature ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
                        }`}>
                          {hasSignature ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {hasSignature ? timeLabel(log.tbm_signed_at) : "미서명"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                      해당 날짜의 퇴근 태깅 안전일지가 없습니다.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                      불러오는 중...
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

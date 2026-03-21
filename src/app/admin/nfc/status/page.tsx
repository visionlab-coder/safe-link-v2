"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { languages } from "@/constants";

interface AttendanceRecord {
  id: string;
  checked_at: string;
  check_type: string;
  nfc_workers: { id: string; preferred_lang: string; display_name: string | null; device_id: string };
}

interface TbmAckRecord {
  id: string;
  confirmed_at: string;
  tbm_notice_id: string;
  nfc_workers: { id: string; preferred_lang: string; display_name: string | null };
}

export default function NfcStatusPage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [acks, setAcks] = useState<TbmAckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWorkers, setTotalWorkers] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // Today's date range (KST)
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
      todayStart.setTime(todayStart.getTime() - kstOffset);

      const [attRes, ackRes, workerRes] = await Promise.all([
        supabase
          .from("nfc_attendance")
          .select("id, checked_at, check_type, nfc_workers(id, preferred_lang, display_name, device_id)")
          .gte("checked_at", todayStart.toISOString())
          .order("checked_at", { ascending: false }),
        supabase
          .from("nfc_tbm_ack")
          .select("id, confirmed_at, tbm_notice_id, nfc_workers(id, preferred_lang, display_name)")
          .gte("confirmed_at", todayStart.toISOString())
          .order("confirmed_at", { ascending: false }),
        supabase.from("nfc_workers").select("id", { count: "exact" }),
      ]);

      setAttendance((attRes.data || []) as any);
      setAcks((ackRes.data || []) as any);
      setTotalWorkers(workerRes.count || 0);
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  // Deduplicate attendance by worker
  const uniqueCheckIns = new Map<string, AttendanceRecord>();
  attendance.forEach((a) => {
    const wId = (a.nfc_workers as any)?.id;
    if (wId && !uniqueCheckIns.has(wId)) uniqueCheckIns.set(wId, a);
  });

  // Count by language
  const langCounts: Record<string, number> = {};
  uniqueCheckIns.forEach((a) => {
    const lang = (a.nfc_workers as any)?.preferred_lang || "unknown";
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  });

  const uniqueAckWorkers = new Set(acks.map(a => (a.nfc_workers as any)?.id).filter(Boolean));

  const getLangName = (code: string) => languages.find(l => l.code === code)?.name || code;
  const getLangIso = (code: string) => languages.find(l => l.code === code)?.iso || "";

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-mesh text-white p-4 md:p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-black tracking-tighter italic text-gradient">NFC Status</h1>
              <p className="text-slate-500 font-bold mt-1">Real-time Monitoring</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/admin/nfc")}
                className="px-4 py-2 glass-card rounded-full text-xs font-black text-blue-400 hover:text-white transition-colors"
              >
                Tag Management
              </button>
              <button
                onClick={() => router.push("/admin")}
                className="px-4 py-2 glass-card rounded-full text-xs font-black text-slate-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass-card rounded-3xl p-6 text-center">
                  <p className="text-5xl font-black text-blue-400">{uniqueCheckIns.size}</p>
                  <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-2">Today Check-ins</p>
                </div>
                <div className="glass-card rounded-3xl p-6 text-center">
                  <p className="text-5xl font-black text-green-400">{uniqueAckWorkers.size}</p>
                  <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-2">TBM Confirmed</p>
                </div>
                <div className="glass-card rounded-3xl p-6 text-center">
                  <p className="text-5xl font-black text-amber-400">{totalWorkers}</p>
                  <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-2">Total Workers</p>
                </div>
              </div>

              {/* TBM Confirmation Rate */}
              {uniqueCheckIns.size > 0 && (
                <div className="glass-card rounded-3xl p-6 mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-white uppercase tracking-wider">TBM Confirmation Rate</p>
                    <p className="text-3xl font-black text-green-400">
                      {uniqueCheckIns.size > 0 ? Math.round((uniqueAckWorkers.size / uniqueCheckIns.size) * 100) : 0}%
                    </p>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000"
                      style={{ width: `${uniqueCheckIns.size > 0 ? (uniqueAckWorkers.size / uniqueCheckIns.size) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Language Breakdown */}
              {Object.keys(langCounts).length > 0 && (
                <div className="glass-card rounded-3xl p-6 mb-8">
                  <p className="text-sm font-black text-white uppercase tracking-wider mb-4">By Language</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(langCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([code, count]) => (
                        <div key={code} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                          {getLangIso(code) && (
                            <img
                              src={`https://flagcdn.com/w40/${getLangIso(code)}.png`}
                              alt=""
                              className="w-8 h-6 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="text-white font-black text-lg">{count}</p>
                            <p className="text-slate-500 text-[10px] font-bold">{getLangName(code)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="glass-card rounded-3xl p-6">
                <p className="text-sm font-black text-white uppercase tracking-wider mb-4">Recent Activity</p>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {attendance.slice(0, 30).map((record) => {
                    const w = record.nfc_workers as any;
                    const langName = getLangName(w?.preferred_lang || "");
                    return (
                      <div key={record.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <div className={`w-2 h-2 rounded-full ${record.check_type === "check_in" ? "bg-blue-500" : "bg-green-500"}`} />
                        <span className="text-xs font-black text-slate-400 w-16">{formatTime(record.checked_at)}</span>
                        <span className="text-xs font-bold text-white">{w?.display_name || w?.device_id?.slice(0, 8) || "Unknown"}</span>
                        <span className="text-[10px] font-bold text-slate-600 ml-auto">{langName}</span>
                      </div>
                    );
                  })}
                  {attendance.length === 0 && (
                    <p className="text-slate-600 font-bold text-center py-4">No activity today</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

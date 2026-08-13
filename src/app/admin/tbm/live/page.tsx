"use client";
import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Nfc, Plus, ChevronRight, Clock, CheckCircle } from "lucide-react";

interface Session {
  id: string;
  site_id: string;
  title: string | null;
  status: "open" | "running" | "closed";
  started_at: string;
  ended_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "대기중", color: "text-yellow-400" },
  running: { label: "진행중", color: "text-green-400" },
  closed: { label: "종료", color: "text-gray-500" },
};

export default function TbmLiveIndexPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (siteId) params.set("site_id", siteId);
    const res = await fetch(`/api/nfc/tbm-session?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions ?? []);
    }
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    const loadSite = async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { profile?: { site_id?: string | null } | null };
      if (data.profile?.site_id) setSiteId(String(data.profile.site_id));
    };
    loadSite().catch(() => undefined);
  }, []);

  useEffect(() => { void fetchSessions(); }, [fetchSessions]);

  const handleCreate = async () => {
    if (!siteId) { alert("현장 ID가 없습니다. 프로필을 확인하세요."); return; }
    const res = await fetch("/api/nfc/tbm-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, title: newTitle.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/tbm/live/${data.session.id}`);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="visualization-light min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          <div className="concept-page-header">
            <div className="flex items-center gap-3">
              <Nfc className="w-6 h-6 text-green-400" />
            </div>
            <button
              onClick={() => setCreating(!creating)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 세션
            </button>
          </div>

          {/* 새 세션 생성 폼 */}
          <div className="admin-concept-hero relative mb-6 h-40 w-full overflow-hidden rounded-2xl border border-gray-800">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v4/mobile/tbm/03.webp" />
              <Image src="/images/mobile-v4/web/tbm/03.webp" alt="TBM NFC session management" fill className="object-cover" priority />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ-LINK TBM NFC</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">TBM NFC 참석 확인</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">현장 세션을 개설하고 NFC 태그 참석 현황을 확인합니다.</p>
            </div>
          </div>

          {creating && (
            <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-green-800">
              <p className="text-sm text-gray-400 mb-3">새 TBM NFC 참석 세션을 개설합니다.</p>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="세션 제목 (선택, 예: 05월 07일 오전 TBM)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm mb-3 focus:outline-none focus:border-green-500"
              />
              <div className="flex gap-3">
                <button onClick={() => setCreating(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">취소</button>
                <button onClick={handleCreate} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg text-sm font-medium transition-colors">세션 시작</button>
              </div>
            </div>
          )}

          {/* 세션 목록 */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-center text-gray-500 py-12">로딩 중...</p>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Nfc className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>세션이 없습니다. 새 세션을 시작하세요.</p>
              </div>
            ) : (
              sessions.map((s) => {
                const st = STATUS_LABELS[s.status] ?? STATUS_LABELS.closed;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/admin/tbm/live/${s.id}`)}
                    className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-4 flex items-center gap-3 text-left border border-gray-700 hover:border-gray-500 transition-all"
                  >
                    <div className="shrink-0">
                      {s.status === "closed" ? <CheckCircle className="w-5 h-5 text-gray-600" /> : <Clock className="w-5 h-5 text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">{s.title || "TBM 세션"}</div>
                      <div className="text-sm text-gray-400">
                        {new Date(s.started_at).toLocaleString("ko-KR")} · {s.site_id}
                      </div>
                    </div>
                    <div className={`text-sm font-medium shrink-0 ${st.color}`}>{st.label}</div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          <button onClick={() => router.back()} className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← 뒤로
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { Users, Plus, Search, ChevronRight, RefreshCw, UserX, QrCode, X } from "lucide-react";
import { TRADES } from "@/utils/nfc/constants";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

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

const TRADE_MAP = Object.fromEntries(TRADES.map((t) => [t.code, t.name_ko]));

type QrTokenData = { token: string; qrUrl: string; expiresInMinutes: number };
type QrModal = { worker: Worker; siteId: string; token: QrTokenData | null; loading: boolean; error: string };

export default function AdminWorkersPage() {
  const router = useRouter();
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

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from("profiles").select("site_id").eq("id", session.user.id).maybeSingle().then(({ data }) => {
        if ((data as { site_id?: string } | null)?.site_id) setAdminSiteId((data as { site_id: string }).site_id);
      });
    });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 근로자를 비활성화하시겠습니까? 스티커도 모두 폐기됩니다.`)) return;
    await fetch(`/api/nfc/workers/${id}`, { method: "DELETE" });
    fetchWorkers();
  };

  const handleOpenQr = async (w: Worker) => {
    const siteId = adminSiteId;
    if (!siteId) { alert("현장(siteId) 정보를 확인할 수 없습니다. 프로필의 현장 설정을 확인하세요."); return; }
    setQrModal({ worker: w, siteId, token: null, loading: true, error: "" });
    try {
      const res = await fetch(`/api/nfc/workers/${w.id}/qr-token?siteId=${siteId}&ttlMinutes=30`);
      const data = await res.json() as QrTokenData & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setQrModal((prev) => prev ? { ...prev, token: data, loading: false } : null);
    } catch (err) {
      setQrModal((prev) => prev ? { ...prev, loading: false, error: String(err) } : null);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-3xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-bold">NFC 근로자 관리</h1>
            </div>
            <button
              onClick={() => router.push("/admin/workers/enroll")}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              근로자 등록
            </button>
          </div>

          {/* 검색 */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 코드, 전화번호 검색..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
              검색
            </button>
            <button type="button" onClick={fetchWorkers} className="bg-gray-700 hover:bg-gray-600 p-2.5 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </form>

          {/* 총계 */}
          <p className="text-gray-500 text-sm mb-3">
            {loading ? "로딩 중..." : `${workers.length}명`}
          </p>

          {/* 목록 */}
          <div className="space-y-2">
            {workers.map((w) => (
              <div key={w.id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{w.full_name}</span>
                    <span className="text-xs text-gray-500 font-mono">{w.worker_code}</span>
                    {!w.consent_signed_at && (
                      <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">동의서 미서명</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {w.nationality} · {TRADE_MAP[w.trade] ?? w.trade} · {w.preferred_lang.toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => router.push(`/admin/workers/enroll?worker_id=${w.id}`)}
                    className="bg-green-800 hover:bg-green-700 text-green-100 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    스티커 발급
                  </button>
                  <button
                    onClick={() => handleOpenQr(w)}
                    className="bg-purple-800 hover:bg-purple-700 text-purple-100 text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    title="TBM QR 토큰 발급"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR
                  </button>
                  <button
                    onClick={() => handleDeactivate(w.id, w.full_name)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                    title="비활성화"
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
                <p>등록된 근로자가 없습니다.</p>
              </div>
            )}
          </div>

          <button onClick={() => router.back()} className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← 뒤로
          </button>
        </div>
      </div>

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-white">{qrModal.worker.full_name}</p>
                <p className="text-xs text-gray-500 font-mono">{qrModal.worker.worker_code}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-4">TBM QR 출석 토큰 (30분 유효)</p>
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
                    alt="QR Token"
                    width={240}
                    height={240}
                    unoptimized
                  />
                </div>
                <p className="text-xs font-mono text-blue-400 break-all text-center">{qrModal.token.qrUrl}</p>
                <p className="text-xs text-gray-500">{qrModal.token.expiresInMinutes}분 후 만료</p>
                <button
                  onClick={() => handleOpenQr(qrModal.worker)}
                  className="w-full bg-purple-700 hover:bg-purple-600 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                >
                  새 QR 발급
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </RoleGuard>
  );
}

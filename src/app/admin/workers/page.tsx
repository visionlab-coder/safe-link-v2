"use client";
import { useEffect, useState, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { Users, Plus, Search, ChevronRight, RefreshCw, UserX } from "lucide-react";
import { TRADES } from "@/utils/nfc/constants";

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

export default function AdminWorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 근로자를 비활성화하시겠습니까? 스티커도 모두 폐기됩니다.`)) return;
    await fetch(`/api/nfc/workers/${id}`, { method: "DELETE" });
    fetchWorkers();
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
    </RoleGuard>
  );
}

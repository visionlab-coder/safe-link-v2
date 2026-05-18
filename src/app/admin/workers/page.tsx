"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, QrCode, RefreshCw, Search, UserX, Users, X } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";
import { createClient } from "@/utils/supabase/client";

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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(search.trim());
  };

  const handleExport = async (format: ExportFormat) => {
    await exportData(format, {
      title: "NFC 근로자 관리대장",
      subtitle: `현장 ${adminSiteId || "-"} / ${new Date().toLocaleString("ko-KR")}`,
      filename: `nfc_workers_${adminSiteId || "site"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "전체 근로자", value: workers.length },
        { label: "활성", value: workers.filter((worker) => worker.is_active).length },
        { label: "동의 서명", value: workers.filter((worker) => worker.consent_signed_at).length },
      ],
      columns: [
        { key: "worker_code", label: "근로자 코드" },
        { key: "full_name", label: "이름" },
        { key: "nationality", label: "국적" },
        { key: "trade", label: "공종" },
        { key: "preferred_lang", label: "언어" },
        { key: "is_active", label: "상태", value: (row) => row.is_active ? "활성" : "비활성" },
        { key: "consent_signed_at", label: "동의 서명일" },
        { key: "created_at", label: "등록일" },
      ],
      rows: workers,
      raw: { siteId: adminSiteId, workers },
    });
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 근로자를 비활성화하시겠습니까? 활성 NFC/QR 링크가 모두 폐기됩니다.`)) return;
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
      if (!res.ok || !data.url) throw new Error(data.detail ?? data.error ?? "QR URL 발급에 실패했습니다.");
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold">NFC 근로자 관리</h1>
                {adminSiteId && <p className="text-xs text-gray-500 font-mono">{adminSiteId}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu disabled={workers.length === 0} onExport={handleExport} />
            <button
              onClick={() => router.push("/admin/workers/enroll")}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              카드 발급
            </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름 또는 근로자 코드 검색"
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

          <p className="text-gray-500 text-sm mb-3">
            {loading ? "불러오는 중..." : `근로자 ${workers.length}명`}
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
                    title="NFC 사용이 어려울 때 쓰는 근로자 SAFE-LINK QR"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR
                  </button>
                  <button
                    onClick={() => handleDeactivate(worker.id, worker.full_name)}
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
            뒤로 가기
          </button>
        </div>
      </div>

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setQrModal(null)}>
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
              근로자 SAFE-LINK QR
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
                    alt="근로자 SAFE-LINK QR"
                    width={240}
                    height={240}
                    unoptimized
                  />
                </div>
                <p className="text-xs font-mono text-blue-400 break-all text-center">{qrModal.token.qrUrl}</p>
                <p className="text-xs text-gray-500 text-center">
                  NFC 인식이 어려울 때 근로자가 이 QR을 스캔할 수 있습니다.
                </p>
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

"use client";
/**
 * TBM NFC 실시간 참석 확인 보드
 * 관리자(Android Chrome)가 이 화면을 열고 "스캔 시작" 클릭 후
 * 근로자가 자신의 NFC 스티커를 가져다 대면 자동으로 참석 확인.
 *
 * 탭 1회 = TBM 참석 확인 (출퇴근 아님).
 */
import { useEffect, useState, useRef, useCallback } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useParams, useRouter } from "next/navigation";
import { Nfc, Square, RefreshCw, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { NfcScanner, detectNfcSupport, NfcError } from "@/utils/nfc/web-nfc";
import { NFC_BASE_URL } from "@/utils/nfc/constants";

interface AttendanceRecord {
  id: string;
  worker_id: string;
  tapped_at: string;
  lang_used: string | null;
}

interface AttendanceWithWorker extends AttendanceRecord {
  worker_code?: string;
  full_name?: string;
  nationality?: string;
  trade?: string;
}

interface Session {
  id: string;
  site_id: string;
  title: string | null;
  status: "open" | "running" | "closed";
  started_at: string;
}

type ScanState = "idle" | "scanning" | "success" | "duplicate" | "error";

export default function TbmLiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<AttendanceWithWorker[]>([]);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [lastWorker, setLastWorker] = useState<{ name: string; code: string; nationality: string } | null>(null);
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(true);

  const scannerRef = useRef<NfcScanner | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nfcSupport = detectNfcSupport();

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/nfc/tbm-session/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data.session);
      setAttendance(data.attendance ?? []);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const startScan = async () => {
    if (!nfcSupport.supported) {
      setScanError("이 기기는 NFC를 지원하지 않습니다. Android Chrome이 필요합니다.");
      return;
    }

    abortRef.current = new AbortController();
    const scanner = new NfcScanner();
    scannerRef.current = scanner;
    setScanState("scanning");
    setScanError("");

    try {
      while (!abortRef.current.signal.aborted) {
        const result = await scanner.scanOnce({
          signal: abortRef.current.signal,
          expectedBaseUrl: NFC_BASE_URL,
          timeoutMs: 0,
        });

        // 탭 API 호출
        const res = await fetch(`/api/nfc/tbm-session/${sessionId}/tap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.rawPayload }),
        });

        const data = await res.json();

        if (res.ok) {
          if (data.action === "attended") {
            setLastWorker({ name: data.worker.full_name, code: data.worker.worker_code, nationality: data.worker.nationality });
            setScanState("success");
            await fetchSession();
          } else {
            setLastWorker({ name: data.worker.full_name, code: data.worker.worker_code, nationality: data.worker.nationality });
            setScanState("duplicate");
          }
          // 2.5초 후 scanning 상태로 복귀
          setTimeout(() => setScanState("scanning"), 2500);
        } else {
          setScanError(data.error || "처리 실패");
          setScanState("error");
          setTimeout(() => { setScanState("scanning"); setScanError(""); }, 3000);
        }

        scanner.reset();
      }
    } catch (err) {
      if (err instanceof NfcError && err.code === "aborted") {
        setScanState("idle");
      } else {
        setScanError(err instanceof Error ? err.message : "스캔 오류");
        setScanState("error");
      }
    }
  };

  const stopScan = () => {
    abortRef.current?.abort();
    setScanState("idle");
  };

  const handleCloseSession = async () => {
    if (!confirm("세션을 종료하시겠습니까?")) return;
    await fetch(`/api/nfc/tbm-session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    await fetchSession();
    stopScan();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const isActive = session?.status !== "closed";

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white">
        {/* 헤더 */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-bold text-white">{session?.title || "TBM NFC 참석"}</h1>
              <p className="text-xs text-gray-500">{session?.site_id} · {attendance.length}명 참석</p>
            </div>
            {isActive && (
              <button onClick={handleCloseSession} className="bg-red-800 hover:bg-red-700 text-red-100 text-xs px-3 py-1.5 rounded-lg transition-colors">
                세션 종료
              </button>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* 스캔 영역 */}
          {isActive && (
            <div className={`rounded-2xl p-6 text-center transition-all ${
              scanState === "scanning" ? "bg-green-950 border-2 border-green-600" :
              scanState === "success"  ? "bg-green-800 border-2 border-green-400" :
              scanState === "duplicate" ? "bg-yellow-900 border-2 border-yellow-600" :
              scanState === "error"    ? "bg-red-900 border-2 border-red-600" :
              "bg-gray-800 border border-gray-700"
            }`}>
              <Nfc className={`w-12 h-12 mx-auto mb-3 ${
                scanState === "scanning" ? "text-green-400 animate-pulse" :
                scanState === "success"  ? "text-green-300" :
                scanState === "duplicate" ? "text-yellow-400" :
                scanState === "error"    ? "text-red-400" :
                "text-gray-600"
              }`} />

              {scanState === "idle" && (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    {nfcSupport.supported ? "스캔 시작 후 근로자가 스티커를 가까이 대면 자동 확인됩니다." : "이 기기는 NFC를 지원하지 않습니다."}
                  </p>
                  {nfcSupport.supported && (
                    <button onClick={startScan} className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-xl font-medium text-white transition-colors">
                      스캔 시작
                    </button>
                  )}
                </>
              )}

              {scanState === "scanning" && (
                <>
                  <p className="text-green-300 font-medium mb-1">스캔 대기 중</p>
                  <p className="text-gray-400 text-sm mb-4">근로자가 스티커를 가까이 대면 자동으로 참석 확인됩니다.</p>
                  <button onClick={stopScan} className="flex items-center gap-2 mx-auto bg-gray-700 hover:bg-gray-600 px-6 py-2.5 rounded-xl text-sm transition-colors">
                    <Square className="w-4 h-4" /> 중지
                  </button>
                </>
              )}

              {scanState === "success" && lastWorker && (
                <>
                  <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-2" />
                  <p className="text-green-300 font-bold text-lg">{lastWorker.name}</p>
                  <p className="text-green-500 text-sm">{lastWorker.code} · {lastWorker.nationality} · 참석 확인</p>
                </>
              )}

              {scanState === "duplicate" && lastWorker && (
                <>
                  <p className="text-yellow-300 font-bold">{lastWorker.name}</p>
                  <p className="text-yellow-500 text-sm">이미 참석 확인됨</p>
                </>
              )}

              {scanState === "error" && (
                <>
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm">{scanError || "오류가 발생했습니다."}</p>
                </>
              )}
            </div>
          )}

          {/* 종료된 세션 안내 */}
          {!isActive && (
            <div className="bg-gray-800 rounded-2xl p-6 text-center border border-gray-700">
              <CheckCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">종료된 세션입니다. 총 {attendance.length}명 참석.</p>
            </div>
          )}

          {/* 참석자 목록 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <h2 className="font-medium">참석자 ({attendance.length}명)</h2>
              </div>
              <button onClick={fetchSession} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {attendance.length === 0 ? (
              <p className="text-center text-gray-600 py-8 text-sm">아직 참석자가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {[...attendance].reverse().map((a, idx) => (
                  <div key={a.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-700">
                    <span className="text-gray-600 text-sm w-6 shrink-0">{attendance.length - idx}</span>
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm">
                        {(a as AttendanceWithWorker).full_name || `Worker ${a.worker_id.slice(0, 6)}`}
                      </span>
                      {(a as AttendanceWithWorker).worker_code && (
                        <span className="text-gray-500 text-xs ml-2 font-mono">{(a as AttendanceWithWorker).worker_code}</span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs shrink-0">
                      {new Date(a.tapped_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => router.push("/admin/tbm/live")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← 세션 목록
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}

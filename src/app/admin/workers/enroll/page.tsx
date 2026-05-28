"use client";

import { Suspense, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Eraser, Nfc, ScanLine, UserPlus } from "lucide-react";
import { detectNfcSupport, eraseNfcTag, NfcError, readNfcUrl, writeNfcUrl } from "@/utils/nfc/web-nfc";
import Image from "next/image";

type Step = "form" | "ready" | "writing" | "reading" | "erasing" | "done" | "erased" | "error";

const DEFAULT_WORKER_PROFILE = {
  nationality: "KR",
  trade: "general",
  preferred_lang: "ko",
};

function WorkerEnrollInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingWorkerId = searchParams.get("worker_id");
  const nfcSupport = detectNfcSupport();

  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [nameInitials, setNameInitials] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [siteId, setSiteId] = useState("");
  const [error, setError] = useState("");
  const [stickerUrl, setStickerUrl] = useState("");
  const [stickerId, setStickerId] = useState("");
  const [issuedWorkerId, setIssuedWorkerId] = useState("");
  const [workerCode, setWorkerCode] = useState("");
  const [readPayload, setReadPayload] = useState("");

  useEffect(() => {
    // P6 박제: createBrowserClient 의존 제거. /api/auth/me 단일화.
    const loadAdminSite = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { site_id?: string | null } | null };
        const currentSiteId = data.profile?.site_id;
        if (currentSiteId) setSiteId(currentSiteId);
      } catch { /* unauthenticated → RoleGuard 가 처리 */ }
    };
    loadAdminSite();
  }, []);

  const resetForm = () => {
    setStep("form");
    setFullName("");
    setNameInitials("");
    setPhoneLast4("");
    setError("");
    setStickerUrl("");
    setStickerId("");
    setIssuedWorkerId("");
    setWorkerCode("");
    setReadPayload("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    let workerId = existingWorkerId;

    if (!workerId) {
      // 🟢 V2 NFC 간편 등록: 영문 이니셜 + 전화번호 뒷 4자리.
      // full_name 은 옵션. 입력 없으면 이니셜 그대로 사용 (서버에서 처리).
      const cleanInitials = nameInitials.trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
      const cleanLast4 = phoneLast4.trim().replace(/\D/g, "").slice(-4);
      if (!cleanInitials || cleanLast4.length !== 4) {
        setError("영문 이니셜과 휴대폰 번호 뒤 4자리를 입력하세요.");
        return;
      }
      const name = fullName.trim() || cleanInitials;

      const res = await fetch("/api/nfc/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          name_initials: cleanInitials,
          phone_last4: cleanLast4,
          assigned_site_id: siteId || undefined,
          consent_signed_at: new Date().toISOString(),
          ...DEFAULT_WORKER_PROFILE,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${data.error || "근로자 등록에 실패했습니다."}${data.detail ? `: ${data.detail}` : ""}`);
        return;
      }
      workerId = data.worker.id;
      setWorkerCode(data.worker.worker_code);
    }

    const issueRes = await fetch("/api/nfc/sticker/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId, revoke_previous: true }),
    });
    const issueData = await issueRes.json();
    if (!issueRes.ok) {
      setError(issueData.detail || issueData.error || "NFC URL 발급에 실패했습니다.");
      return;
    }

    setStickerUrl(issueData.url);
    setStickerId(issueData.sticker_id || "");
    setIssuedWorkerId(workerId || "");
    if (!workerCode) setWorkerCode(issueData.worker.worker_code);

    setStep(nfcSupport.supported ? "ready" : "done");
  };

  const handleWriteNfc = async () => {
    if (!stickerUrl) {
      setError("아직 NFC URL이 발급되지 않았습니다.");
      setStep("form");
      return;
    }
    setError("");
    setStep("writing");
    try {
      await writeNfcUrl(stickerUrl);
      setStep("done");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "NFC 쓰기에 실패했습니다.");
      }
      setStep("error");
    }
  };

  const handleEraseNfc = async () => {
    if (!nfcSupport.supported) {
      setError("NFC 지우기는 HTTPS 환경의 Android Chrome에서 사용할 수 있습니다.");
      setStep("error");
      return;
    }
    if (!confirm("이 NFC 카드를 지워 재사용 가능하게 하시겠습니까? 태그에 저장된 SAFE-LINK URL이 삭제됩니다.")) return;
    setError("");
    setStep("erasing");
    try {
      await eraseNfcTag();
      const eventRes = await fetch("/api/nfc/sticker/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "erased",
          worker_id: issuedWorkerId || existingWorkerId || undefined,
          sticker_id: stickerId || undefined,
          reason: "card_reuse",
          metadata: { source: "admin_workers_enroll" },
        }),
      });
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.detail || eventData.error || "NFC 지우기 기록 저장에 실패했습니다.");
      setStep("erased");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "NFC 지우기에 실패했습니다.");
      }
      setStep("error");
    }
  };

  const handleReadNfc = async () => {
    if (!nfcSupport.supported) {
      setError("NFC 읽기는 HTTPS 환경의 Android Chrome에서 사용할 수 있습니다.");
      setStep("error");
      return;
    }
    setError("");
    setReadPayload("");
    setStep("reading");
    try {
      const result = await readNfcUrl();
      setReadPayload(result.rawPayload);
      setStep("form");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "NFC 읽기에 실패했습니다.");
      }
      setStep("error");
    }
  };

  if (step === "ready") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Nfc className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">URL 준비 완료</h2>
          <p className="text-gray-400 text-sm mb-4">
            지금은 NFC 카드를 가까이 대지 마세요. 먼저 쓰기 버튼을 누른 뒤, 휴대폰이 요청할 때 카드를 태그하세요.
          </p>
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg mb-4">{stickerUrl}</p>
          <button
            type="button"
            onClick={handleWriteNfc}
            className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Nfc className="w-4 h-4" />
            NFC 카드에 쓰기
          </button>
        </div>
      </div>
    );
  }

  if (step === "writing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Nfc className="w-16 h-16 text-green-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 카드를 태그하세요</h2>
          <p className="text-gray-400 text-sm">근로자 카드를 이 Android 휴대폰 가까이에 대면 SAFE-LINK 접속 URL이 기록됩니다.</p>
        </div>
      </div>
    );
  }

  if (step === "erasing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Eraser className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 카드를 태그하세요</h2>
          <p className="text-gray-400 text-sm">재사용할 카드를 이 Android 휴대폰 가까이에 대면 저장된 SAFE-LINK URL이 삭제됩니다.</p>
        </div>
      </div>
    );
  }

  if (step === "reading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <ScanLine className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 카드를 태그하세요</h2>
          <p className="text-gray-400 text-sm">카드를 이 Android 휴대폰 가까이에 대면 저장된 SAFE-LINK URL을 읽습니다.</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">카드 준비 완료</h2>
          <p className="text-gray-400 text-sm">
            근로자 코드: <span className="text-white font-mono">{workerCode}</span>
          </p>
          <p className="text-gray-500 text-xs mt-3">
            실물 카드에는 근로자 이름을 표시하세요. 태그에는 서명된 SAFE-LINK URL만 저장됩니다.
          </p>
          {stickerUrl && (
            <div className="bg-white p-3 rounded-xl mt-4">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(stickerUrl)}`}
                alt="근로자 SAFE-LINK QR"
                width={220}
                height={220}
                unoptimized
                className="mx-auto"
              />
            </div>
          )}
          <p className="text-gray-400 text-xs mt-3">
            NFC 인식이 어려울 때 근로자가 이 QR을 스캔할 수 있습니다.
          </p>
          {!nfcSupport.supported && (
            <div className="bg-gray-900 rounded-lg p-3 mt-4">
              <p className="text-yellow-300 text-xs mb-1">이 기기에서는 Web NFC 쓰기를 사용할 수 없습니다. QR/NFC 인코딩용 대체 URL을 사용하세요.</p>
              <p className="text-gray-400 text-xs break-all">{stickerUrl}</p>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              근로자 목록
            </button>
            {!existingWorkerId && (
              <button onClick={resetForm} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
                다음 카드
              </button>
            )}
          </div>
          {nfcSupport.supported && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={handleReadNfc}
                className="bg-blue-800 hover:bg-blue-700 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                카드 읽기
              </button>
              <button
                onClick={handleEraseNfc}
                className="bg-yellow-700 hover:bg-yellow-600 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Eraser className="w-4 h-4" />
                카드 지우기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "erased") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">카드 지우기 완료</h2>
          <p className="text-gray-400 text-sm">이 NFC 카드는 이제 다른 근로자에게 재배정할 수 있습니다.</p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              근로자 목록
            </button>
            <button onClick={resetForm} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
              다시 발급
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 작업 실패</h2>
          {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4 text-left">
            <p className="text-yellow-200 text-xs font-semibold mb-1">현장 확인</p>
            <p className="text-yellow-100 text-xs">
              이 화면에서 태그하라고 안내하기 전까지 카드를 가까이 대지 마세요. 계속 실패하면 NFC Tools로 카드를 NDEF 형식으로 초기화하거나 아래 대체 URL을 기록하세요.
            </p>
          </div>
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg">{stickerUrl}</p>
          <button onClick={() => setStep(stickerUrl ? "ready" : "form")} className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">{existingWorkerId ? "근로자 NFC 카드 재발급" : "근로자 NFC 카드 발급"}</h1>
        </div>

        <div className="relative mb-6 h-40 w-full overflow-hidden rounded-2xl border border-gray-800">
          <Image src="/images/safelink-pages/nfc-card-naming.png" alt="Worker NFC card naming" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!existingWorkerId && (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-300">
                  카드 라벨과 향후 ERP 매칭을 위해 필요한 최소 정보만 입력합니다. 근로자는 카드 태그 후 국가와 언어를 직접 선택합니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">이름 이니셜 *</label>
                  <input
                    required
                    value={nameInitials}
                    onChange={(event) => setNameInitials(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 uppercase"
                    placeholder="KDH"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">휴대폰 뒤 4자리 *</label>
                  <input
                    required
                    value={phoneLast4}
                    onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(-4))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="1234"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">근로자 이름 *</label>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="카드에 표시할 이름"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">현장 ID</label>
                <input
                  value={siteId}
                  onChange={(event) => setSiteId(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder="관리자 현장 ID"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          {readPayload && (
            <div className="bg-blue-950/50 border border-blue-800 rounded-lg px-4 py-3 text-blue-200 text-xs">
              <p className="font-semibold mb-1">읽기 결과</p>
              <p className="break-all font-mono">{readPayload}</p>
            </div>
          )}

          {!nfcSupport.supported && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-yellow-300 text-sm">
              이 기기에서는 Web NFC 쓰기를 사용할 수 없습니다. HTTPS 환경의 Android Chrome이 필요합니다. 대신 QR/NFC 대체용 짧은 URL은 발급됩니다.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors">
              뒤로 가기
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
              {nfcSupport.supported ? <><Nfc className="w-4 h-4" /> NFC URL 발급</> : "짧은 URL 발급"}
            </button>
          </div>
          {nfcSupport.supported && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleReadNfc}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                NFC 카드 읽기
              </button>
              <button
                type="button"
                onClick={handleEraseNfc}
                className="bg-yellow-800 hover:bg-yellow-700 border border-yellow-700 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Eraser className="w-4 h-4" />
                NFC 카드 지우기
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function WorkerEnrollPage() {
  return (
    <RoleGuard allowedRole="admin">
      <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">불러오는 중...</p></div>}>
        <WorkerEnrollInner />
      </Suspense>
    </RoleGuard>
  );
}

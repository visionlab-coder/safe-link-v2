"use client";
import { useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus, Nfc, CheckCircle, AlertCircle } from "lucide-react";
import { TRADES } from "@/utils/nfc/constants";
import { writeNfcUrl, detectNfcSupport } from "@/utils/nfc/web-nfc";

type Step = "form" | "writing" | "done" | "error";

function WorkerEnrollInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingWorkerId = searchParams.get("worker_id");

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    full_name: "",
    nationality: "VN",
    phone: "",
    trade: "rebar",
    preferred_lang: "vi",
    assigned_site_id: "",
    consent_signed: false,
  });
  const [error, setError] = useState("");
  const [stickerUrl, setStickerUrl] = useState("");
  const [workerCode, setWorkerCode] = useState("");

  const nfcSupport = detectNfcSupport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent_signed) {
      setError("개인정보 수집·이용 동의가 필요합니다.");
      return;
    }
    setError("");

    let workerId = existingWorkerId;

    // 신규 근로자 등록
    if (!workerId) {
      const res = await fetch("/api/nfc/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          nationality: form.nationality,
          phone: form.phone || undefined,
          trade: form.trade,
          preferred_lang: form.preferred_lang,
          assigned_site_id: form.assigned_site_id || undefined,
          consent_signed_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "등록 실패");
        return;
      }
      const data = await res.json();
      workerId = data.worker.id;
      setWorkerCode(data.worker.worker_code);
    }

    // 스티커 발급
    const issueRes = await fetch("/api/nfc/sticker/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId, revoke_previous: true }),
    });
    if (!issueRes.ok) {
      const data = await issueRes.json();
      setError(data.error || "스티커 발급 실패");
      return;
    }
    const issueData = await issueRes.json();
    setStickerUrl(issueData.url);
    if (!workerCode) setWorkerCode(issueData.worker.worker_code);

    // NFC 쓰기 (지원 기기만)
    if (nfcSupport.supported) {
      setStep("writing");
      try {
        const abort = new AbortController();
        await writeNfcUrl(issueData.url, { signal: abort.signal });
        setStep("done");
      } catch {
        setStep("error");
      }
    } else {
      setStep("done");
    }
  };

  if (step === "writing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <Nfc className="w-16 h-16 text-green-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 태그에 가까이 대세요</h2>
          <p className="text-gray-400 text-sm">스티커에 URL을 기록 중입니다...</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">완료</h2>
          <p className="text-gray-400 text-sm mb-2">근로자 코드: <span className="text-white font-mono">{workerCode}</span></p>
          {!nfcSupport.supported && (
            <div className="bg-gray-700 rounded-lg p-3 mt-3 mb-3">
              <p className="text-yellow-400 text-xs mb-1">이 기기는 NFC를 지원하지 않습니다.</p>
              <p className="text-gray-400 text-xs break-all">{stickerUrl}</p>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              목록으로
            </button>
            <button onClick={() => { setStep("form"); setForm({ full_name: "", nationality: "VN", phone: "", trade: "rebar", preferred_lang: "vi", assigned_site_id: "", consent_signed: false }); }} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
              다음 근로자
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">NFC 쓰기 실패</h2>
          <p className="text-gray-400 text-sm mb-4">태그를 다시 가까이 대거나, 아래 URL을 QR로 출력하세요.</p>
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg">{stickerUrl}</p>
          <button onClick={() => router.push("/admin/workers")} className="mt-4 w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
            목록으로
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
            <h1 className="text-xl font-bold">{existingWorkerId ? "스티커 재발급" : "근로자 등록 + 스티커 발급"}</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!existingWorkerId && (
              <>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">이름 *</label>
                  <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="홍길동" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">국적 *</label>
                    <input required value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                      placeholder="VN" maxLength={2} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">언어 *</label>
                    <input required value={form.preferred_lang} onChange={(e) => setForm({ ...form, preferred_lang: e.target.value.toLowerCase() })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                      placeholder="vi" maxLength={5} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">공종 *</label>
                  <select required value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500">
                    {TRADES.map((t) => (
                      <option key={t.code} value={t.code}>{t.name_ko} ({t.name_en})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">전화번호</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="+821012345678" />
                </div>
              </>
            )}

            {/* PIPA 동의 */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.consent_signed} onChange={(e) => setForm({ ...form, consent_signed: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-blue-500" />
                <span className="text-sm text-gray-300">
                  <span className="text-white font-medium">[필수] 개인정보 수집·이용 동의</span><br />
                  <span className="text-gray-500 text-xs">
                    SAFE-LINK는 TBM 참석 확인 목적으로 성명·국적·공종을 수집합니다.
                    보관 기간: 근로 종료 후 3년. 개인정보보호법 제15조 제1항 제4호.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {!nfcSupport.supported && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-yellow-300 text-sm">
                이 기기는 NFC를 지원하지 않습니다. 스티커 URL은 등록 후 표시됩니다.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors">
                취소
              </button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {nfcSupport.supported ? <><Nfc className="w-4 h-4" /> 등록 + NFC 쓰기</> : "등록 + URL 발급"}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}

export default function WorkerEnrollPage() {
  return (
    <RoleGuard allowedRole="admin">
      <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>}>
        <WorkerEnrollInner />
      </Suspense>
    </RoleGuard>
  );
}

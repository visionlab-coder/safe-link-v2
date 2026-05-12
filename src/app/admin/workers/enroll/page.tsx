"use client";

import { Suspense, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Nfc, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { detectNfcSupport, writeNfcUrl } from "@/utils/nfc/web-nfc";
import Image from "next/image";

type Step = "form" | "writing" | "done" | "error";

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
  const [workerCode, setWorkerCode] = useState("");

  useEffect(() => {
    const loadAdminSite = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("site_id")
        .eq("id", session.user.id)
        .maybeSingle();
      const currentSiteId = (profile as { site_id?: string | null } | null)?.site_id;
      if (currentSiteId) setSiteId(currentSiteId);
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
    setWorkerCode("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    let workerId = existingWorkerId;

    if (!workerId) {
      const name = fullName.trim();
      if (!name) {
        setError("Worker name is required for card labeling and ERP matching.");
        return;
      }
      const cleanInitials = nameInitials.trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
      const cleanLast4 = phoneLast4.trim().replace(/\D/g, "").slice(-4);
      if (!cleanInitials || cleanLast4.length !== 4) {
        setError("Enter name initials and the last 4 digits of the phone number.");
        return;
      }

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
        setError(data.error || "Worker registration failed.");
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
      setError(issueData.detail || issueData.error || "NFC URL issue failed.");
      return;
    }

    setStickerUrl(issueData.url);
    if (!workerCode) setWorkerCode(issueData.worker.worker_code);

    if (!nfcSupport.supported) {
      setStep("done");
      return;
    }

    setStep("writing");
    try {
      await writeNfcUrl(issueData.url);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFC write failed.");
      setStep("error");
    }
  };

  if (step === "writing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Nfc className="w-16 h-16 text-green-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">Touch the NFC card</h2>
          <p className="text-gray-400 text-sm">Hold the worker card near this Android phone to write the SAFE-LINK access URL.</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Card ready</h2>
          <p className="text-gray-400 text-sm">
            Worker code: <span className="text-white font-mono">{workerCode}</span>
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Label the physical card with the worker name. The tag stores only a signed SAFE-LINK URL.
          </p>
          {stickerUrl && (
            <div className="bg-white p-3 rounded-xl mt-4">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(stickerUrl)}`}
                alt="Worker SAFE-LINK QR"
                width={220}
                height={220}
                unoptimized
                className="mx-auto"
              />
            </div>
          )}
          <p className="text-gray-400 text-xs mt-3">
            Workers can scan this QR if NFC reading is inconvenient.
          </p>
          {!nfcSupport.supported && (
            <div className="bg-gray-900 rounded-lg p-3 mt-4">
              <p className="text-yellow-300 text-xs mb-1">This device cannot write Web NFC. Use this fallback URL for QR/NFC encoding.</p>
              <p className="text-gray-400 text-xs break-all">{stickerUrl}</p>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              Worker list
            </button>
            {!existingWorkerId && (
              <button onClick={resetForm} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
                Next card
              </button>
            )}
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
          <h2 className="text-white text-xl font-bold mb-2">NFC write failed</h2>
          {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg">{stickerUrl}</p>
          <button onClick={() => setStep("form")} className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
            Try again
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
          <h1 className="text-xl font-bold">{existingWorkerId ? "Reissue worker NFC card" : "Issue worker NFC card"}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!existingWorkerId && (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-300">
                  Enter only the worker name for card labeling and future ERP matching. The worker selects country/language after tapping the card.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Name initials *</label>
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
                  <label className="text-sm text-gray-400 mb-1 block">Phone last 4 *</label>
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
                <label className="text-sm text-gray-400 mb-1 block">Worker name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Name printed on card"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Site ID</label>
                <input
                  value={siteId}
                  onChange={(event) => setSiteId(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder="Admin site ID"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {!nfcSupport.supported && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-yellow-300 text-sm">
              Web NFC writing is not available on this device. Android Chrome over HTTPS is required. The system will still issue a short URL for QR/NFC fallback.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors">
              Back
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
              {nfcSupport.supported ? <><Nfc className="w-4 h-4" /> Issue + write</> : "Issue short URL"}
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
      <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
        <WorkerEnrollInner />
      </Suspense>
    </RoleGuard>
  );
}

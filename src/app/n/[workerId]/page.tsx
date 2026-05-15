"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Globe2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type CountryOption = {
  code: string;
  lang: string;
  label: string;
};

type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

const NFC_ERROR_MESSAGES: Record<string, string> = {
  outside_worksite: "현장 반경 밖에서는 출근 처리가 안됩니다. 현장 안에서 다시 태그해 주세요.",
  site_challenge_expired: "오늘 확인코드가 만료되었습니다. 관리자에게 재발급을 요청하세요.",
  site_challenge_invalid: "현장 확인코드가 일치하지 않습니다. 6자리를 다시 확인해 주세요.",
  sticker_revoked_or_missing: "이 NFC 카드는 사용 중지되었습니다. 관리자에게 재발급을 요청하세요.",
  signature_invalid: "NFC 카드 인증에 실패했습니다. 관리자에게 확인을 요청하세요.",
  worker_site_required: "근로자 현장 배정이 누락되었습니다. 관리자에게 등록을 요청하세요.",
  worker_not_found: "등록되지 않은 NFC 카드입니다. 관리자에게 확인을 요청하세요.",
  site_access_disabled: "현재 이 현장은 NFC 입장이 비활성화되어 있습니다. 관리자에게 문의하세요.",
  daily_safety_log_upload_failed: "안전일지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  location_required: "위치 권한을 켠 뒤 다시 태그해 주세요.",
  url_malformed_or_spoofed: "잘못된 NFC 링크입니다. 관리자에게 카드 확인을 요청하세요.",
  nationality_invalid: "국가 선택이 올바르지 않습니다. 다시 선택해 주세요.",
  checkin_failed: "출근 처리에 실패했습니다. 다시 태그해 주세요.",
  checkout_failed: "퇴근 처리에 실패했습니다. 다시 시도해 주세요.",
};

function nfcErrorMessage(raw: string): string {
  return NFC_ERROR_MESSAGES[raw] ?? raw;
}

const COUNTRIES: CountryOption[] = [
  { code: "KR", lang: "ko", label: "Korea" },
  { code: "VN", lang: "vi", label: "Vietnam" },
  { code: "CN", lang: "zh", label: "China" },
  { code: "TH", lang: "th", label: "Thailand" },
  { code: "ID", lang: "id", label: "Indonesia" },
  { code: "PH", lang: "ph", label: "Philippines" },
  { code: "UZ", lang: "uz", label: "Uzbekistan" },
  { code: "RU", lang: "ru", label: "Russia" },
  { code: "MN", lang: "mn", label: "Mongolia" },
  { code: "NP", lang: "ne", label: "Nepal" },
  { code: "MM", lang: "my", label: "Myanmar" },
  { code: "KH", lang: "km", label: "Cambodia" },
  { code: "JP", lang: "jp", label: "Japan" },
  { code: "BD", lang: "bn", label: "Bangladesh" },
  { code: "KZ", lang: "kk", label: "Kazakhstan" },
  { code: "IN", lang: "hi", label: "India" },
  { code: "SA", lang: "ar", label: "Saudi Arabia" },
];

function NfcWorkerEntryInner() {
  const { workerId } = useParams<{ workerId: string }>();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [phase, setPhase] = useState<"checking" | "select" | "saving" | "active_options" | "checked_out">("checking");
  const [selected, setSelected] = useState<CountryOption>(COUNTRIES[0]);
  const [activePreference, setActivePreference] = useState<{ nationality: string; preferred_lang: string } | null>(null);
  const [siteChallengeCode, setSiteChallengeCode] = useState("");
  const [error, setError] = useState("");

  const isValidShape =
    Boolean(workerId) &&
    searchParams.has("v") &&
    searchParams.has("t") &&
    searchParams.has("s");

  const buildSignedUrl = () => {
    const qs = searchParams.toString();
    return `${window.location.origin}/n/${encodeURIComponent(workerId)}${qs ? `?${qs}` : ""}`;
  };

  const getDeviceLocation = async (): Promise<DeviceLocation> => {
    if (!navigator.geolocation) {
      throw new Error("Location is required to use SAFE-LINK at the worksite.");
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        () => reject(new Error("위치 권한을 허용한 뒤 현장에서 다시 태그해 주세요.")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  };

  const applyPreference = async (nationality: string, preferred_lang: string, intent: "open" | "checkout" = "open") => {
    const location = await getDeviceLocation();
    const res = await fetch("/api/nfc/worker-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: buildSignedUrl(),
        nationality,
        preferred_lang,
        location,
        intent,
        site_challenge_code: siteChallengeCode,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(nfcErrorMessage(data.error || data.detail || "NFC access failed."));

    if (data.access?.action === "checked_out" || data.access?.active === false) {
      await supabase.auth.signOut();
      window.sessionStorage.removeItem("safe-link-session-active");
      setPhase("checked_out");
      return;
    }

    // Session is now established server-side via Set-Cookie headers —
    // no token_hash exchange needed on the client (patch C-4/C-6).
    // We call getSession to pick up the cookie the server just wrote.
    if (data.session_established) {
      await supabase.auth.getSession();
    }

    if (data.access?.action === "checkout_required") {
      setActivePreference({ nationality, preferred_lang });
      setPhase("active_options");
      return;
    }

    window.localStorage.setItem("safe-link-worker-lang", preferred_lang);
    window.localStorage.setItem("safe-link-worker-country", nationality);
    window.sessionStorage.setItem("safe-link-session-active", "true");
    window.location.replace(`/worker?lang=${encodeURIComponent(preferred_lang)}&nfc=1`);
  };

  const continueToSafeLink = async () => {
    const preferredLang = activePreference?.preferred_lang ?? selected.lang;
    window.localStorage.setItem("safe-link-worker-lang", preferredLang);
    window.sessionStorage.setItem("safe-link-session-active", "true");
    window.location.replace(`/worker?lang=${encodeURIComponent(preferredLang)}&nfc=1`);
  };

  const checkout = async () => {
    if (!window.confirm("퇴근 처리 후 오늘은 SAFE-LINK 모든 기능이 중지됩니다. 계속하시겠습니까?")) {
      return;
    }
    const nationality = activePreference?.nationality ?? selected.code;
    const preferredLang = activePreference?.preferred_lang ?? selected.lang;
    setPhase("saving");
    setError("");
    try {
      await applyPreference(nationality, preferredLang, "checkout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setPhase("active_options");
    }
  };

  useEffect(() => {
    if (!isValidShape) {
      setPhase("select");
      return;
    }

    const check = async () => {
      try {
        const res = await fetch(`/api/nfc/worker-info?url=${encodeURIComponent(buildSignedUrl())}`);
        if (!res.ok) {
          setPhase("select");
          return;
        }
        const data = await res.json();
        if (data.site_challenge_code) {
          setSiteChallengeCode(data.site_challenge_code);
        }
        if (data.has_confirmed) {
          await applyPreference(data.nationality, data.preferred_lang);
        } else {
          setPhase("select");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "NFC access failed.");
        setPhase("select");
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreference = async () => {
    if (!isValidShape) {
      setError("This NFC link is missing required security parameters.");
      return;
    }
    setPhase("saving");
    setError("");
    try {
      await applyPreference(selected.code, selected.lang);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFC access failed.");
      setPhase("select");
    }
  };

  if (phase === "checking" || (phase === "saving" && !error)) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <p className="text-gray-400 text-sm">
            {phase === "checking" ? "Verifying NFC..." : "Logging in..."}
          </p>
        </div>
      </main>
    );
  }

  if (phase === "checked_out") {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-5 flex items-center justify-center">
        <section className="w-full max-w-md text-center bg-gray-900 border border-gray-800 rounded-xl p-6">
          <ShieldCheck className="w-12 h-12 mx-auto text-green-400 mb-4" />
          <h1 className="text-xl font-bold mb-2">Checked out</h1>
          <p className="text-sm text-gray-400">
            SAFE-LINK access is inactive for today. Tap the NFC card again tomorrow morning at the worksite to activate it.
          </p>
        </section>
      </main>
    );
  }

  if (phase === "active_options") {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-5 flex items-center justify-center">
        <section className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6">
          <ShieldCheck className="w-12 h-12 text-blue-400 mb-4" />
          <h1 className="text-xl font-bold mb-2">Already checked in</h1>
          <p className="text-sm text-gray-400 mb-5">
            You are active for today. Choose SAFE-LINK access or finish work and upload today&apos;s safety log.
          </p>
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Today&apos;s site code</label>
            <input
              value={siteChallengeCode}
              onChange={(event) => setSiteChallengeCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-[0.35em] font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={continueToSafeLink}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors"
            >
              Open SAFE-LINK
            </button>
            <button
              type="button"
              onClick={checkout}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-colors"
            >
              Check out and upload safety log
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-5 flex items-center justify-center">
      <section className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">SAFE-LINK</h1>
            <p className="text-sm text-gray-400">Worker NFC access</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <Globe2 className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">
              Select your country. Location access is required so SAFE-LINK only works at the assigned worksite.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {COUNTRIES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => setSelected(country)}
              className={`flex flex-col items-center justify-center gap-1 h-20 rounded-xl border transition-all active:scale-95 ${
                selected.code === country.code
                  ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40"
                  : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              <span className="text-sm font-semibold">{country.label}</span>
              <span className="text-xs text-gray-400">{country.code}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="text-xs text-gray-400 mb-1 block">Today&apos;s site code</label>
          <input
            value={siteChallengeCode}
            onChange={(event) => setSiteChallengeCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.35em] font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="button"
          disabled={phase === "saving" || !isValidShape}
          onClick={savePreference}
          className="w-full bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-green-400 text-gray-950 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {phase === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Continue to SAFE-LINK"
          )}
        </button>

        {!isValidShape && (
          <p className="text-center text-red-400 text-xs mt-3">
            This NFC link is missing required security parameters.
          </p>
        )}
      </section>
    </main>
  );
}

export default function NfcWorkerEntryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </main>
    }>
      <NfcWorkerEntryInner />
    </Suspense>
  );
}

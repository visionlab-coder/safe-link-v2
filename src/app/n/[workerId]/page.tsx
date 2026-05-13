"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Globe2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type CountryOption = {
  code: string;
  lang: string;
  label: string;
  flag: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "KR", lang: "ko", label: "한국",        flag: "🇰🇷" },
  { code: "VN", lang: "vi", label: "Vietnam",     flag: "🇻🇳" },
  { code: "CN", lang: "zh", label: "中国",         flag: "🇨🇳" },
  { code: "TH", lang: "th", label: "ไทย",         flag: "🇹🇭" },
  { code: "ID", lang: "id", label: "Indonesia",   flag: "🇮🇩" },
  { code: "PH", lang: "ph", label: "Philippines", flag: "🇵🇭" },
  { code: "UZ", lang: "uz", label: "Oʻzbekiston", flag: "🇺🇿" },
  { code: "RU", lang: "ru", label: "Россия",      flag: "🇷🇺" },
  { code: "MN", lang: "mn", label: "Монгол",      flag: "🇲🇳" },
  { code: "NP", lang: "ne", label: "नेपाल",       flag: "🇳🇵" },
  { code: "MM", lang: "my", label: "မြန်မာ",      flag: "🇲🇲" },
  { code: "KH", lang: "km", label: "កម្ពុជា",     flag: "🇰🇭" },
  { code: "JP", lang: "jp", label: "日本",         flag: "🇯🇵" },
  { code: "BD", lang: "bn", label: "বাংলাদেশ",    flag: "🇧🇩" },
  { code: "KZ", lang: "kk", label: "Қазақстан",   flag: "🇰🇿" },
  { code: "IN", lang: "hi", label: "भारत",         flag: "🇮🇳" },
  { code: "SA", lang: "ar", label: "العربية",      flag: "🇸🇦" },
];

function NfcWorkerEntryInner() {
  const router = useRouter();
  const { workerId } = useParams<{ workerId: string }>();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [phase, setPhase] = useState<"checking" | "select" | "saving">("checking");
  const [selected, setSelected] = useState<CountryOption>(COUNTRIES[0]);
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

  /** preference POST → verifyOtp → /worker 이동 */
  const applyPreference = async (nationality: string, preferred_lang: string) => {
    const res = await fetch("/api/nfc/worker-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: buildSignedUrl(), nationality, preferred_lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || "Preference update failed.");

    if (data.token_hash) {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (otpErr) throw new Error(otpErr.message);
    }

    window.localStorage.setItem("safe-link-worker-lang", preferred_lang);
    window.localStorage.setItem("safe-link-worker-country", nationality);
    router.replace(`/worker?lang=${encodeURIComponent(preferred_lang)}&nfc=1`);
  };

  // 마운트 시: 기존 국가 선택 여부 확인
  useEffect(() => {
    if (!isValidShape) {
      setPhase("select");
      return;
    }

    const check = async () => {
      try {
        const res = await fetch(
          `/api/nfc/worker-info?url=${encodeURIComponent(buildSignedUrl())}`
        );
        if (!res.ok) {
          setPhase("select");
          return;
        }
        const d = await res.json();
        if (d.has_confirmed) {
          // 재진입 — 저장된 국가로 자동 로그인
          await applyPreference(d.nationality, d.preferred_lang);
        } else {
          // 최초 진입 — 국가 선택 UI 표시
          setPhase("select");
        }
      } catch {
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
      setError(err instanceof Error ? err.message : "Preference update failed.");
      setPhase("select");
    }
  };

  // 로딩 / 자동 로그인 중
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
              Select your country. No name or phone number is required on this phone.
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
              <span className="text-3xl leading-none">{country.flag}</span>
              <span className="text-xs font-semibold">{country.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

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

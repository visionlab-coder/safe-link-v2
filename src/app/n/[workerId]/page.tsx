"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Globe2, ShieldCheck } from "lucide-react";

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
];

function NfcWorkerEntryInner() {
  const router = useRouter();
  const { workerId } = useParams<{ workerId: string }>();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<CountryOption>(COUNTRIES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedName, setSavedName] = useState("");

  const isValidShape =
    Boolean(workerId) &&
    searchParams.has("v") &&
    searchParams.has("t") &&
    searchParams.has("s");

  const savePreference = async () => {
    if (!isValidShape) {
      setError("This NFC link is missing required security parameters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const qs = searchParams.toString();
      const signedUrl = `${window.location.origin}/n/${encodeURIComponent(workerId)}${qs ? `?${qs}` : ""}`;
      const res = await fetch("/api/nfc/worker-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: signedUrl,
          nationality: selected.code,
          preferred_lang: selected.lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Preference update failed.");
      window.localStorage.setItem("safe-link-worker-lang", selected.lang);
      window.localStorage.setItem("safe-link-worker-country", selected.code);
      setSavedName(data.worker?.full_name || "");
      router.push(`/worker?lang=${encodeURIComponent(selected.lang)}&nfc=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preference update failed.");
    } finally {
      setSaving(false);
    }
  };

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

        {savedName && (
          <div className="flex items-center gap-2 text-green-300 text-sm mb-4">
            <CheckCircle className="w-4 h-4" />
            {savedName}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={saving || !isValidShape}
          onClick={savePreference}
          className="w-full bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 hover:bg-green-400 text-gray-950 font-bold py-4 rounded-xl transition-colors"
        >
          {saving ? "Saving..." : "Continue to SAFE-LINK"}
        </button>
      </section>
    </main>
  );
}

export default function NfcWorkerEntryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <NfcWorkerEntryInner />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, UserCheck } from "lucide-react";

type Country = { code: string; label: string; nativeLabel: string; lang: string };

type EntryResult = {
  ok?: boolean;
  error?: string;
  session_established?: boolean;
  site?: { id: string; name?: string | null; code?: string | null };
  access?: { action: "checked_in" | "already_checked_in" | "checked_out"; active: boolean };
};

const COUNTRIES: Country[] = [
  { code: "KR", label: "대한민국", nativeLabel: "한국어", lang: "ko" },
  { code: "VN", label: "베트남", nativeLabel: "Tiếng Việt", lang: "vi" },
  { code: "CN", label: "중국", nativeLabel: "中文", lang: "zh" },
  { code: "TH", label: "태국", nativeLabel: "ไทย", lang: "th" },
  { code: "ID", label: "인도네시아", nativeLabel: "Bahasa Indonesia", lang: "id" },
  { code: "PH", label: "필리핀", nativeLabel: "Filipino", lang: "ph" },
  { code: "UZ", label: "우즈베키스탄", nativeLabel: "O'zbekcha", lang: "uz" },
  { code: "RU", label: "러시아", nativeLabel: "Русский", lang: "ru" },
  { code: "JP", label: "일본", nativeLabel: "日本語", lang: "jp" },
  { code: "MN", label: "몽골", nativeLabel: "Монгол", lang: "mn" },
  { code: "MM", label: "미얀마", nativeLabel: "မြန်မာ", lang: "my" },
  { code: "KH", label: "캄보디아", nativeLabel: "ខ្មែរ", lang: "km" },
  { code: "NP", label: "네팔", nativeLabel: "नेपाली", lang: "ne" },
  { code: "BD", label: "방글라데시", nativeLabel: "বাংলা", lang: "bn" },
];

const LANG_TO_COUNTRY: Record<string, string> = Object.fromEntries(COUNTRIES.map((country) => [country.lang, country.code]));

const ERROR_MESSAGES: Record<string, string> = {
  site_not_found: "현장 정보를 찾지 못했습니다. 관리자 QR의 현장코드를 확인해 주세요.",
  site_access_disabled: "현재 이 현장의 근로자 SAFE-LINK 기능이 꺼져 있습니다.",
  initials_required: "이름 이니셜을 입력해 주세요.",
  phone_last4_required: "휴대전화 뒷자리 4자리를 입력해 주세요.",
  worker_not_found: "입력한 정보와 일치하는 근로자를 찾지 못했습니다.",
  worker_match_ambiguous: "같은 정보의 근로자가 2명 이상입니다. 관리자에게 확인을 요청하세요.",
  checkin_failed: "입장 기록 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  preference_update_failed: "언어 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  session_failed: "근로자 세션 생성에 실패했습니다. 관리자에게 확인을 요청하세요.",
  NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
};

function message(code: string) {
  return ERROR_MESSAGES[code] ?? code;
}

function SiteQrEntryInner() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") ?? "";
  const initialLang = searchParams.get("lang") ?? "ko";
  const [selectedCountry, setSelectedCountry] = useState(LANG_TO_COUNTRY[initialLang] ?? "KR");
  const [siteName, setSiteName] = useState("");
  const [initials, setInitials] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "blocked" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  const country = useMemo(
    () => COUNTRIES.find((item) => item.code === selectedCountry) ?? COUNTRIES[0],
    [selectedCountry]
  );

  useEffect(() => {
    if (!siteId) {
      setErrMsg("site_not_found");
      setStatus("error");
      return;
    }

    let cancelled = false;
    fetch("/api/qr/site-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, mode: "info" }),
    })
      .then((res) => res.json())
      .then((data: EntryResult) => {
        if (cancelled) return;
        if (!data.ok) {
          setErrMsg(data.error ?? "site_not_found");
          setStatus("error");
          return;
        }
        setSiteName(data.site?.name ?? data.site?.code ?? "SAFE-LINK 현장");
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setErrMsg("NETWORK_ERROR");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  async function submitEntry() {
    setStatus("submitting");
    setErrMsg("");

    try {
      const res = await fetch("/api/qr/site-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          mode: "enter",
          name_initials: initials,
          phone_last4: phoneLast4,
          nationality: country.code,
          preferred_lang: country.lang,
        }),
      });
      const data: EntryResult = await res.json();

      if (!data.ok) {
        setErrMsg(data.error ?? "worker_not_found");
        setStatus("error");
        return;
      }

      localStorage.setItem("safe-link-lang", country.lang);
      localStorage.setItem("safe-link-country", country.code);
      sessionStorage.setItem("safe-link-worker-active", data.access?.active ? "1" : "0");

      if (data.access?.action === "checked_out") {
        setStatus("blocked");
        return;
      }

      if (!data.session_established) {
        setErrMsg("session_failed");
        setStatus("error");
        return;
      }

      // RoleGuard rememberMe=false 체크 우회 — QR 입장 세션은 항상 활성으로 표시
      sessionStorage.setItem("safe-link-session-active", "true");
      window.location.replace(`/worker?lang=${encodeURIComponent(country.lang)}&qr=1`);
    } catch {
      setErrMsg("NETWORK_ERROR");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <p className="text-sm text-gray-300">현장 정보를 확인하고 있습니다.</p>
      </main>
    );
  }

  if (status === "blocked") {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-5 px-6">
        <CheckCircle className="h-16 w-16 text-gray-400" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">오늘 퇴근 처리가 완료되었습니다.</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            다음 근무일 TBM 태그 또는 QR 입장 전까지 SAFE-LINK 기능은 사용할 수 없습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <header className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15">
              <UserCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-gray-400">SAFE-LINK 근로자 QR</p>
              <h1 className="text-2xl font-black">간편 입장</h1>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs font-bold text-gray-500">자동 적용 현장</p>
            <p className="mt-1 text-base font-bold">{siteName || "SAFE-LINK 현장"}</p>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-2">
          {COUNTRIES.map((item) => {
            const active = item.code === selectedCountry;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setSelectedCountry(item.code)}
                className={`min-h-12 rounded-lg border px-3 text-left ${
                  active ? "border-blue-400 bg-blue-500/15" : "border-gray-800 bg-gray-900"
                }`}
              >
                <span className="block text-xs font-bold">{item.label}</span>
                <span className="block text-[11px] text-gray-400">{item.nativeLabel}</span>
              </button>
            );
          })}
        </section>

        <section className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400">본인 이름의 이니셜</span>
            <input
              value={initials}
              onChange={(event) => setInitials(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())}
              placeholder="예: HGD"
              maxLength={4}
              className="h-14 rounded-lg border border-gray-800 bg-gray-900 px-4 font-mono text-lg font-black outline-none focus:border-blue-400"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400">휴대전화 뒷자리 4자리</span>
            <input
              value={phoneLast4}
              onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              inputMode="numeric"
              className="h-14 rounded-lg border border-gray-800 bg-gray-900 px-4 font-mono text-lg font-black outline-none focus:border-blue-400"
            />
          </label>
        </section>

        {status === "error" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <p>{message(errMsg)}</p>
          </div>
        )}

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={submitEntry}
            disabled={status === "submitting" || !initials || phoneLast4.length !== 4}
            className="flex h-14 w-full items-center justify-center rounded-lg bg-blue-500 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                입장 처리 중
              </>
            ) : (
              "근로자 화면으로 이동"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SiteQrEntryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <SiteQrEntryInner />
    </Suspense>
  );
}

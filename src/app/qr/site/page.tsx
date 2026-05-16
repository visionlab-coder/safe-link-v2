"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, UserCheck } from "lucide-react";
import {
  findQrLanguageByCode,
  getQrEntryText,
  getQrFlagUrl,
  QR_LANGUAGE_OPTIONS,
  type QrLanguageCode,
} from "@/utils/qr/language-options";

type EntryResult = {
  ok?: boolean;
  error?: string;
  session_established?: boolean;
  site?: { id: string; name?: string | null; code?: string | null };
  access?: { action: "checked_in" | "already_checked_in" | "checked_out"; active: boolean };
};

const ERROR_MESSAGES: Record<QrLanguageCode, Record<string, string>> = {
  ko: {
    site_not_found: "현장을 찾을 수 없습니다. 관리자에게 현장 QR을 다시 요청하세요.",
    site_access_disabled: "이 현장은 현재 SAFE-LINK 근로자 입장이 중지되어 있습니다.",
    initials_required: "이름 이니셜을 입력하세요.",
    phone_last4_required: "휴대전화 뒤 4자리를 입력하세요.",
    worker_not_found: "입력한 정보와 일치하는 근로자를 찾을 수 없습니다.",
    worker_match_ambiguous: "같은 정보의 근로자가 2명 이상입니다. 관리자에게 확인하세요.",
    checkin_failed: "입장 처리 중 오류가 발생했습니다. 다시 시도하세요.",
    preference_update_failed: "언어 저장 중 오류가 발생했습니다. 다시 시도하세요.",
    session_failed: "근로자 세션을 만들지 못했습니다. 관리자에게 확인하세요.",
    NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도하세요.",
  },
  vi: {
    worker_not_found: "Không tìm thấy công nhân khớp với thông tin đã nhập.",
    NETWORK_ERROR: "Vui lòng kiểm tra mạng và thử lại.",
  },
  zh: {
    worker_not_found: "找不到与输入信息匹配的工人。",
    NETWORK_ERROR: "请检查网络后重试。",
  },
  th: {
    worker_not_found: "ไม่พบคนงานที่ตรงกับข้อมูลที่กรอก",
    NETWORK_ERROR: "โปรดตรวจสอบเครือข่ายแล้วลองอีกครั้ง",
  },
  uz: {},
  ph: {},
  km: {},
  id: {},
  mn: {},
  my: {},
  ne: {},
  bn: {},
  kk: {},
  ru: {
    worker_not_found: "Работник с такими данными не найден.",
    NETWORK_ERROR: "Проверьте сеть и попробуйте снова.",
  },
  en: {
    site_not_found: "Worksite not found. Ask the manager for a new site QR.",
    site_access_disabled: "Worker entry is currently disabled for this worksite.",
    initials_required: "Enter your name initials.",
    phone_last4_required: "Enter the last 4 digits of your phone.",
    worker_not_found: "No worker matches the entered information.",
    worker_match_ambiguous: "More than one worker matches this information. Ask the manager to check.",
    checkin_failed: "Entry processing failed. Please try again.",
    preference_update_failed: "Language could not be saved. Please try again.",
    session_failed: "Worker session could not be created. Ask the manager to check.",
    NETWORK_ERROR: "Check the network connection and try again.",
  },
  jp: {
    worker_not_found: "入力情報に一致する作業員が見つかりません。",
    NETWORK_ERROR: "ネットワークを確認してからもう一度お試しください。",
  },
  fr: {},
  es: {},
  ar: {},
  hi: {},
};

function errorMessage(lang: QrLanguageCode, code: string) {
  return ERROR_MESSAGES[lang]?.[code] ?? ERROR_MESSAGES.en[code] ?? ERROR_MESSAGES.ko[code] ?? code;
}

function SiteQrEntryInner() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") ?? "";
  const initialLang = findQrLanguageByCode(searchParams.get("lang") ?? "ko").lang;
  const [selectedLang, setSelectedLang] = useState<QrLanguageCode>(initialLang);
  const [siteName, setSiteName] = useState("");
  const [initials, setInitials] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "blocked" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  const language = useMemo(() => findQrLanguageByCode(selectedLang), [selectedLang]);
  const text = useMemo(() => getQrEntryText(selectedLang), [selectedLang]);

  useEffect(() => {
    localStorage.setItem("safe-link-lang", language.lang);
    localStorage.setItem("safe-link-country", language.country);
  }, [language.country, language.lang]);

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
        setSiteName(data.site?.name ?? data.site?.code ?? text.siteFallback);
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
  }, [siteId, text.siteFallback]);

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
          nationality: language.country,
          preferred_lang: language.lang,
        }),
      });
      const data: EntryResult = await res.json();

      if (!data.ok) {
        setErrMsg(data.error ?? "worker_not_found");
        setStatus("error");
        return;
      }

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

      sessionStorage.setItem("safe-link-session-active", "true");
      window.location.replace(`/worker?lang=${encodeURIComponent(language.lang)}&qr=1`);
    } catch {
      setErrMsg("NETWORK_ERROR");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <p className="text-sm text-gray-300">{text.siteLoading}</p>
      </main>
    );
  }

  if (status === "blocked") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gray-950 px-6">
        <CheckCircle className="h-16 w-16 text-gray-400" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{text.blockedTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">{text.blockedBody}</p>
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
              <p className="text-sm text-gray-400">{text.siteQrLabel}</p>
              <h1 className="text-2xl font-black">{text.quickEntryTitle}</h1>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs font-bold text-gray-500">{text.siteLabel}</p>
            <p className="mt-1 text-base font-bold">{siteName || text.siteFallback}</p>
          </div>
        </header>

        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-gray-400">{text.chooseLanguageTitle}</p>
            <p className="text-xs font-bold text-blue-200">
              {text.selectedLanguage}: {language.nativeName}
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {QR_LANGUAGE_OPTIONS.map((item) => {
              const active = item.lang === selectedLang;
              return (
                <button
                  key={item.lang}
                  type="button"
                  onClick={() => setSelectedLang(item.lang)}
                  aria-label={item.nativeName}
                  title={item.nativeName}
                  className={`flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-gray-900 p-1 transition ${
                    active ? "border-blue-400 ring-2 ring-blue-400/40" : "border-gray-800"
                  }`}
                >
                  <Image
                    src={getQrFlagUrl(item)}
                    alt={item.nativeName}
                    width={80}
                    height={60}
                    unoptimized
                    className="h-full w-full rounded-md object-cover"
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400">{text.initialsLabel}</span>
            <input
              value={initials}
              onChange={(event) => setInitials(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())}
              placeholder={text.initialsPlaceholder}
              maxLength={4}
              className="h-14 rounded-lg border border-gray-800 bg-gray-900 px-4 font-mono text-lg font-black outline-none focus:border-blue-400"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400">{text.phoneLast4Label}</span>
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
            <p>{errorMessage(language.lang, errMsg)}</p>
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
                {text.entering}
              </>
            ) : (
              text.enterWorker
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

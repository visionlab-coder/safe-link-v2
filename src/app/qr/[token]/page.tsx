"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle, Globe2, Loader2 } from "lucide-react";
import {
  findQrLanguageByCode,
  findQrLanguageByCountry,
  getQrEntryText,
  getQrFlagUrl,
  QR_LANGUAGE_OPTIONS,
  type QrLanguageCode,
} from "@/utils/qr/language-options";

type InfoResult = {
  ok?: boolean;
  error?: string;
  worker?: {
    id: string;
    full_name: string;
    worker_code: string;
    nationality?: string | null;
    preferred_lang?: string | null;
  };
  site?: {
    id: string;
    name?: string | null;
    code?: string | null;
  };
};

type EnterResult = InfoResult & {
  session_established?: boolean;
  access?: {
    action: "checked_in" | "already_checked_in" | "checked_out";
    active: boolean;
  };
};

const ERROR_MESSAGES: Record<QrLanguageCode, Record<string, string>> = {
  ko: {
    INVALID_OR_EXPIRED_TOKEN: "QR 코드가 만료되었거나 올바르지 않습니다. 관리자에게 새 QR을 요청하세요.",
    site_not_found: "현장을 찾을 수 없습니다. 관리자에게 확인하세요.",
    worker_not_found: "근로자 정보를 찾을 수 없습니다.",
    worker_site_mismatch: "이 QR의 현장과 근로자의 현재 현장이 일치하지 않습니다.",
    site_access_disabled: "이 현장은 현재 SAFE-LINK 근로자 입장이 중지되어 있습니다.",
    nationality_invalid: "국가를 다시 선택하세요.",
    checkin_failed: "입장 처리 중 오류가 발생했습니다. 다시 시도하세요.",
    preference_update_failed: "언어 저장 중 오류가 발생했습니다. 다시 시도하세요.",
    session_failed: "근로자 세션을 만들지 못했습니다. 관리자에게 확인하세요.",
    NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도하세요.",
  },
  vi: {
    worker_not_found: "Không tìm thấy thông tin công nhân.",
    NETWORK_ERROR: "Vui lòng kiểm tra mạng và thử lại.",
  },
  zh: {
    worker_not_found: "找不到工人信息。",
    NETWORK_ERROR: "请检查网络后重试。",
  },
  th: {
    worker_not_found: "ไม่พบข้อมูลคนงาน",
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
    worker_not_found: "Информация о работнике не найдена.",
    NETWORK_ERROR: "Проверьте сеть и попробуйте снова.",
  },
  en: {
    INVALID_OR_EXPIRED_TOKEN: "The QR code is expired or invalid. Ask the manager for a new QR.",
    site_not_found: "Worksite not found. Ask the manager to check.",
    worker_not_found: "Worker information was not found.",
    worker_site_mismatch: "This QR worksite does not match the worker's current worksite.",
    site_access_disabled: "Worker entry is currently disabled for this worksite.",
    nationality_invalid: "Choose your country again.",
    checkin_failed: "Entry processing failed. Please try again.",
    preference_update_failed: "Language could not be saved. Please try again.",
    session_failed: "Worker session could not be created. Ask the manager to check.",
    NETWORK_ERROR: "Check the network connection and try again.",
  },
  jp: {
    worker_not_found: "作業員情報が見つかりません。",
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

export default function QrLandingPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<"loading" | "select" | "entering" | "blocked" | "error">("loading");
  const [info, setInfo] = useState<InfoResult | null>(null);
  const [selectedLang, setSelectedLang] = useState<QrLanguageCode>("ko");
  const [errMsg, setErrMsg] = useState("");

  const language = useMemo(() => findQrLanguageByCode(selectedLang), [selectedLang]);
  const text = useMemo(() => getQrEntryText(selectedLang), [selectedLang]);

  useEffect(() => {
    localStorage.setItem("safe-link-lang", language.lang);
    localStorage.setItem("safe-link-country", language.country);
  }, [language.country, language.lang]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetch("/api/qr/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, mode: "info" }),
    })
      .then((res) => res.json())
      .then((data: InfoResult) => {
        if (cancelled) return;
        if (!data.ok) {
          setErrMsg(data.error ?? "INVALID_OR_EXPIRED_TOKEN");
          setPhase("error");
          return;
        }

        const savedLang = findQrLanguageByCode(data.worker?.preferred_lang);
        const savedCountry = findQrLanguageByCountry(data.worker?.nationality);
        setSelectedLang(savedCountry?.lang ?? savedLang.lang);
        setInfo(data);
        setPhase("select");
      })
      .catch(() => {
        if (cancelled) return;
        setErrMsg("NETWORK_ERROR");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function enterWorkerDashboard() {
    if (!token) return;
    setPhase("entering");
    setErrMsg("");

    try {
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          mode: "enter",
          nationality: language.country,
          preferred_lang: language.lang,
        }),
      });
      const data: EnterResult = await res.json();

      if (!data.ok) {
        setErrMsg(data.error ?? "worker_not_found");
        setPhase("error");
        return;
      }

      sessionStorage.setItem("safe-link-worker-active", data.access?.active ? "1" : "0");

      if (data.access?.action === "checked_out") {
        setInfo(data);
        setPhase("blocked");
        return;
      }

      if (!data.session_established) {
        setErrMsg("session_failed");
        setPhase("error");
        return;
      }

      sessionStorage.setItem("safe-link-session-active", "true");
      window.location.replace(`/worker?lang=${encodeURIComponent(language.lang)}&qr=1`);
    } catch {
      setErrMsg("NETWORK_ERROR");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <p className="text-sm text-gray-300">{text.qrLoading}</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6">
        <AlertCircle className="h-16 w-16 text-red-400" />
        <h1 className="text-center text-xl font-bold text-white">{text.errorTitle}</h1>
        <p className="text-center text-sm leading-6 text-red-300">{errorMessage(language.lang, errMsg)}</p>
      </main>
    );
  }

  if (phase === "blocked") {
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
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/15">
              <Globe2 className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{text.workerQrLabel}</p>
              <h1 className="text-2xl font-black">{text.chooseLanguageTitle}</h1>
            </div>
          </div>
          {info?.worker && (
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/70 px-4 py-3">
              <p className="text-base font-bold">{info.worker.full_name || text.workerFallbackName}</p>
              <p className="mt-1 text-xs text-gray-500">{info.worker.worker_code}</p>
              {info.site?.name && <p className="mt-2 text-sm text-gray-300">{info.site.name}</p>}
            </div>
          )}
        </header>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-gray-400">{text.selectedLanguage}</p>
            <p className="text-xs font-bold text-blue-200">{language.nativeName}</p>
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

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={enterWorkerDashboard}
            disabled={phase === "entering"}
            className="flex h-14 w-full items-center justify-center rounded-lg bg-blue-500 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {phase === "entering" ? (
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

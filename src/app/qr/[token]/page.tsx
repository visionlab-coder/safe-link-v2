"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle, Globe2, Loader2 } from "lucide-react";

type Country = {
  code: string;
  label: string;
  nativeLabel: string;
  lang: string;
};

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

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_OR_EXPIRED_TOKEN: "QR 유효 시간이 만료되었습니다. 관리자에게 새 QR 발급을 요청하세요.",
  site_not_found: "현장 정보를 찾지 못했습니다. 관리자에게 현장코드 연결 상태를 확인해 달라고 요청하세요.",
  worker_not_found: "등록된 근로자 정보를 찾지 못했습니다.",
  worker_site_mismatch: "이 QR은 현재 근로자의 등록 현장과 일치하지 않습니다.",
  site_access_disabled: "현재 이 현장의 근로자 SAFE-LINK 기능이 꺼져 있습니다.",
  nationality_invalid: "국가를 다시 선택해 주세요.",
  checkin_failed: "입장 기록 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  preference_update_failed: "언어 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  session_failed: "근로자 세션 생성에 실패했습니다. 관리자에게 QR 재발급을 요청하세요.",
  NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
};

function errorMessage(code: string) {
  return ERROR_MESSAGES[code] ?? code;
}

export default function QrLandingPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<"loading" | "select" | "entering" | "blocked" | "error">("loading");
  const [info, setInfo] = useState<InfoResult | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("KR");
  const [errMsg, setErrMsg] = useState("");

  const country = useMemo(
    () => COUNTRIES.find((item) => item.code === selectedCountry) ?? COUNTRIES[0],
    [selectedCountry]
  );

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
          setErrMsg(data.error ?? "QR 확인에 실패했습니다.");
          setPhase("error");
          return;
        }

        const savedCountry = String(data.worker?.nationality ?? "").toUpperCase();
        if (COUNTRIES.some((item) => item.code === savedCountry)) {
          setSelectedCountry(savedCountry);
        }
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
          nationality: country.code,
          preferred_lang: country.lang,
        }),
      });
      const data: EnterResult = await res.json();

      if (!data.ok) {
        setErrMsg(data.error ?? "QR 입장 처리에 실패했습니다.");
        setPhase("error");
        return;
      }

      localStorage.setItem("safe-link-lang", country.lang);
      localStorage.setItem("safe-link-country", country.code);
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

      window.location.replace(`/worker?lang=${encodeURIComponent(country.lang)}&qr=1`);
    } catch {
      setErrMsg("NETWORK_ERROR");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-gray-300 text-sm">QR 정보를 확인하고 있습니다.</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6">
        <AlertCircle className="w-16 h-16 text-red-400" />
        <h1 className="text-white text-xl font-bold text-center">QR 입장 실패</h1>
        <p className="text-red-300 text-sm text-center leading-6">{errorMessage(errMsg)}</p>
      </main>
    );
  }

  if (phase === "blocked") {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-5 px-6">
        <CheckCircle className="w-16 h-16 text-gray-400" />
        <div className="text-center">
          <h1 className="text-white text-xl font-bold">오늘 퇴근 처리가 완료되었습니다.</h1>
          <p className="text-gray-400 text-sm mt-2 leading-6">
            다음 근무일 TBM 태그 또는 QR 입장 전까지 SAFE-LINK 기능은 사용할 수 없습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-5 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/15">
              <Globe2 className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-gray-400">SAFE-LINK 근로자 QR</p>
              <h1 className="text-2xl font-black">국가를 선택하세요</h1>
            </div>
          </div>
          {info?.worker && (
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/70 px-4 py-3">
              <p className="text-base font-bold">{info.worker.full_name}</p>
              <p className="mt-1 text-xs text-gray-500">{info.worker.worker_code}</p>
              {info.site?.name && <p className="mt-2 text-sm text-gray-300">{info.site.name}</p>}
            </div>
          )}
        </header>

        <section className="grid grid-cols-1 gap-2">
          {COUNTRIES.map((item) => {
            const active = item.code === selectedCountry;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setSelectedCountry(item.code)}
                className={`flex min-h-14 items-center justify-between rounded-lg border px-4 text-left transition ${
                  active
                    ? "border-blue-400 bg-blue-500/15 text-white"
                    : "border-gray-800 bg-gray-900 text-gray-200"
                }`}
              >
                <span>
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="block text-xs text-gray-400">{item.nativeLabel}</span>
                </span>
                <span className={`text-xs font-bold ${active ? "text-blue-200" : "text-gray-600"}`}>
                  {item.lang.toUpperCase()}
                </span>
              </button>
            );
          })}
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

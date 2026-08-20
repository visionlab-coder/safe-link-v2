"use client";
/**
 * 공개 스티커 랜딩 페이지 /nfc/w/[workerId]
 * PIPA 준수: PII 노출 없음. noindex. 스티커 유효성 안내만.
 * 근로자가 실수로 자기 스티커를 탭했을 때 보이는 화면.
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Head from "next/head";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const STICKER_UI: Record<string, Record<string, string>> = {
  ko: { checking:"확인 중...", valid:"유효한 스티커입니다", validDesc:"이 스티커는 TBM 참석 확인용입니다.", tap:"관리자 화면에 가까이 대주세요.", invalid:"유효하지 않은 스티커", contact:"관리자에게 문의하세요." },
  en: { checking:"Checking...", valid:"This sticker is valid", validDesc:"This sticker is used to confirm TBM attendance.", tap:"Hold it near the administrator screen.", invalid:"This sticker is invalid", contact:"Please contact an administrator." },
  zh: { checking:"正在确认...", valid:"这是有效的标签", validDesc:"此标签用于确认 TBM 出席。", tap:"请靠近管理员屏幕。", invalid:"无效的标签", contact:"请联系管理员。" },
  vi: { checking:"Đang kiểm tra...", valid:"Thẻ này hợp lệ", validDesc:"Thẻ này dùng để xác nhận tham gia TBM.", tap:"Hãy đưa thẻ gần màn hình quản trị viên.", invalid:"Thẻ không hợp lệ", contact:"Hãy liên hệ quản trị viên." },
  ru: { checking:"Проверка...", valid:"Метка действительна", validDesc:"Эта метка используется для подтверждения участия в TBM.", tap:"Поднесите её к экрану администратора.", invalid:"Недействительная метка", contact:"Обратитесь к администратору." },
};

export default function WorkerStickerLanding() {
  const { workerId } = useParams<{ workerId: string }>();
  const searchParams = useSearchParams();
  const displayLanguage = useDisplayLanguage();
  const lang = searchParams.get("lang") || displayLanguage;
  const t = STICKER_UI[lang] || STICKER_UI.en;
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");

  useEffect(() => {
    const v = searchParams.get("v");
    const t = searchParams.get("t");
    const sig = searchParams.get("sig");
    if (workerId && v && t && sig) {
      setStatus("valid");
    } else {
      setStatus("invalid");
    }
  }, [workerId, searchParams]);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>SQ Link NFC</title>
      </Head>
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="text-5xl mb-4">
            {status === "checking" && "⏳"}
            {status === "valid" && "✅"}
            {status === "invalid" && "❌"}
          </div>
          {status === "checking" && (
            <p className="text-gray-300 text-lg">{t.checking}</p>
          )}
          {status === "valid" && (
            <>
              <h1 className="text-white text-xl font-bold mb-2">{t.valid}</h1>
              <p className="text-gray-400 text-sm">
                {t.validDesc}<br />
                {t.tap}
              </p>
              <p className="text-gray-500 text-xs mt-4">SQ Link · 서원토건</p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="text-red-400 text-xl font-bold mb-2">{t.invalid}</h1>
              <p className="text-gray-400 text-sm">{t.contact}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

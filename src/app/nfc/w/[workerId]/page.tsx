"use client";
/**
 * 공개 스티커 랜딩 페이지 /nfc/w/[workerId]
 * PIPA 준수: PII 노출 없음. noindex. 스티커 유효성 안내만.
 * 근로자가 실수로 자기 스티커를 탭했을 때 보이는 화면.
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Head from "next/head";

export default function WorkerStickerLanding() {
  const { workerId } = useParams<{ workerId: string }>();
  const searchParams = useSearchParams();
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
        <title>SAFE-LINK NFC</title>
      </Head>
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="text-5xl mb-4">
            {status === "checking" && "⏳"}
            {status === "valid" && "✅"}
            {status === "invalid" && "❌"}
          </div>
          {status === "checking" && (
            <p className="text-gray-300 text-lg">확인 중...</p>
          )}
          {status === "valid" && (
            <>
              <h1 className="text-white text-xl font-bold mb-2">유효한 스티커입니다</h1>
              <p className="text-gray-400 text-sm">
                이 스티커는 TBM 참석 확인용입니다.<br />
                관리자 화면에 가까이 대주세요.
              </p>
              <p className="text-gray-500 text-xs mt-4">SAFE-LINK · 서원토건</p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="text-red-400 text-xl font-bold mb-2">유효하지 않은 스티커</h1>
              <p className="text-gray-400 text-sm">관리자에게 문의하세요.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

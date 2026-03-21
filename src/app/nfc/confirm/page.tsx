"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getDeviceId, getDeviceLang } from "@/utils/nfc/device-id";

const statusText: Record<string, { confirming: string; done: string; alreadyDone: string; error: string; noDevice: string }> = {
  ko: { confirming: "청취 확인 중...", done: "청취 확인 완료!", alreadyDone: "이미 확인되었습니다", error: "확인에 실패했습니다", noDevice: "먼저 출석 체크를 해주세요" },
  en: { confirming: "Confirming...", done: "Confirmed!", alreadyDone: "Already confirmed", error: "Confirmation failed", noDevice: "Please check in first" },
  vi: { confirming: "Đang xác nhận...", done: "Xác nhận thành công!", alreadyDone: "Đã xác nhận rồi", error: "Xác nhận thất bại", noDevice: "Vui lòng điểm danh trước" },
  zh: { confirming: "确认中...", done: "确认完成!", alreadyDone: "已经确认过了", error: "确认失败", noDevice: "请先签到" },
  th: { confirming: "กำลังยืนยัน...", done: "ยืนยันเรียบร้อย!", alreadyDone: "ยืนยันแล้ว", error: "ยืนยันไม่สำเร็จ", noDevice: "กรุณาเช็คอินก่อน" },
  uz: { confirming: "Tasdiqlanmoqda...", done: "Tasdiqlandi!", alreadyDone: "Allaqachon tasdiqlangan", error: "Tasdiqlash amalga oshmadi", noDevice: "Iltimos, avval ro'yxatdan o'ting" },
};

function NfcConfirmContent() {
  const searchParams = useSearchParams();
  const tagCode = searchParams.get("tag") || "";

  const [status, setStatus] = useState<"loading" | "confirming" | "done" | "already" | "error" | "no-device">("loading");

  const lang = getDeviceLang() || "en";
  const t = statusText[lang] || statusText["en"];

  useEffect(() => {
    const doConfirm = async () => {
      const deviceId = getDeviceId();
      if (!deviceId) {
        setStatus("no-device");
        return;
      }

      setStatus("confirming");

      try {
        // First get today's TBM to find the notice ID
        const tbmRes = await fetch(`/api/nfc/today-tbm?device_id=${deviceId}`);
        const tbmData = await tbmRes.json();

        if (!tbmData.notices || tbmData.notices.length === 0) {
          setStatus("done");
          return;
        }

        // Confirm all unconfirmed TBMs
        const unconfirmed = tbmData.notices.filter((n: { confirmed: boolean }) => !n.confirmed);

        if (unconfirmed.length === 0) {
          setStatus("already");
          return;
        }

        await Promise.all(
          unconfirmed.map((n: { id: string }) =>
            fetch("/api/nfc/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ device_id: deviceId, tbm_notice_id: n.id, tag_code: tagCode }),
            })
          )
        );

        setStatus("done");
      } catch {
        setStatus("error");
      }
    };

    doConfirm();
  }, [tagCode]);

  const icon = status === "done" || status === "already"
    ? { color: "text-green-500", bg: "bg-green-500/10", path: "M5 13l4 4L19 7" }
    : status === "error" || status === "no-device"
    ? { color: "text-red-500", bg: "bg-red-500/10", path: "M6 18L18 6M6 6l12 12" }
    : { color: "text-blue-500", bg: "bg-blue-500/10", path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" };

  const message = status === "confirming" ? t.confirming
    : status === "done" ? t.done
    : status === "already" ? t.alreadyDone
    : status === "error" ? t.error
    : status === "no-device" ? t.noDevice
    : "";

  return (
    <main className="min-h-screen bg-mesh flex flex-col items-center justify-center p-4 gap-8">
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-green-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-6">
        {/* Brand */}
        <h1 className="text-5xl font-black tracking-tighter italic">
          <span className="text-white">SAFE</span>
          <span className="text-blue-500">-LINK</span>
        </h1>

        {/* Status Icon */}
        <div className={`w-28 h-28 rounded-3xl flex items-center justify-center ${icon.bg} ${status === "confirming" ? "animate-pulse" : ""}`}>
          {status === "confirming" || status === "loading" ? (
            <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className={`w-16 h-16 ${icon.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={icon.path} />
            </svg>
          )}
        </div>

        {/* Message */}
        <p className={`text-2xl font-black tracking-tight ${
          status === "done" || status === "already" ? "text-green-400" :
          status === "error" || status === "no-device" ? "text-red-400" :
          "text-blue-400"
        }`}>
          {message}
        </p>

        {(status === "done" || status === "already") && (
          <p className="text-slate-600 text-sm font-bold">
            This page will close automatically
          </p>
        )}
      </div>

      <p className="absolute bottom-6 text-[10px] text-slate-700 font-bold tracking-widest uppercase">
        SAFE-LINK v2.5 NFC Confirm
      </p>
    </main>
  );
}

export default function NfcConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-mesh flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <NfcConfirmContent />
    </Suspense>
  );
}

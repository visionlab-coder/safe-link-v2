"use client";
// 청구항 23: QR 코드 스캔 랜딩 페이지
// 앱 설치 없이 QR 스캔 → 즉시 TBM 참석 처리 (PWA)

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

type ActionResult = {
  ok: boolean;
  action: "checked_in" | "certified" | "already_certified" | "no_active_session";
  worker?: { id: string; full_name: string; worker_code: string; nationality?: string };
  session?: { id: string; title: string | null };
};

const MESSAGES: Record<string, Record<string, string>> = {
  checked_in: {
    ko: "참석 대기 등록 완료", en: "Check-in registered", vi: "Đã đăng ký tham dự",
    zh: "签到等待登记完成", th: "ลงทะเบียนรอเข้าร่วม", id: "Pendaftaran kehadiran selesai",
  },
  certified: {
    ko: "TBM 이수 인증 완료", en: "TBM completion certified", vi: "Đã xác nhận hoàn thành TBM",
    zh: "TBM完成认证", th: "รับรองการผ่าน TBM", id: "Sertifikasi selesai TBM",
  },
  already_certified: {
    ko: "이미 이수 인증 완료됨", en: "Already certified", vi: "Đã được chứng nhận", zh: "已完成认证",
    th: "ได้รับการรับรองแล้ว", id: "Sudah disertifikasi",
  },
  no_active_session: {
    ko: "현재 진행 중인 TBM 세션이 없습니다", en: "No active TBM session",
    vi: "Không có phiên TBM đang diễn ra", zh: "目前没有正在进行的TBM",
    th: "ไม่มีเซสชัน TBM ที่กำลังดำเนินการ", id: "Tidak ada sesi TBM aktif",
  },
};

function getMessage(action: string, lang = "en"): string {
  return MESSAGES[action]?.[lang] ?? MESSAGES[action]?.["en"] ?? action;
}

export default function QrLandingPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    fetch("/api/qr/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data: ActionResult & { error?: string }) => {
        if (data.ok) {
          setResult(data);
          setStatus("success");
        } else {
          setErrMsg(data.error ?? "VERIFICATION_FAILED");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrMsg("NETWORK_ERROR");
        setStatus("error");
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-gray-400 text-sm">확인 중...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6">
        <AlertCircle className="w-16 h-16 text-red-400" />
        <h1 className="text-white text-xl font-bold text-center">QR 코드 오류</h1>
        <p className="text-red-400 text-sm text-center">
          {errMsg === "INVALID_OR_EXPIRED_TOKEN"
            ? "QR 코드가 만료되었거나 유효하지 않습니다. 관리자에게 새 QR 코드를 요청하세요."
            : errMsg}
        </p>
      </div>
    );
  }

  if (!result) return null;

  const isPositive = result.action !== "no_active_session";
  const actionColor = {
    checked_in: "text-blue-400",
    certified: "text-green-400",
    already_certified: "text-yellow-400",
    no_active_session: "text-gray-400",
  }[result.action] ?? "text-white";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-6">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isPositive ? "bg-green-500/20" : "bg-gray-800"}`}>
        <CheckCircle className={`w-14 h-14 ${actionColor}`} />
      </div>

      {result.worker && (
        <div className="text-center">
          <p className="text-white text-2xl font-black">{result.worker.full_name}</p>
          <p className="text-gray-500 text-sm font-mono mt-1">{result.worker.worker_code}</p>
        </div>
      )}

      <div className="text-center">
        <p className={`text-lg font-bold ${actionColor}`}>
          {getMessage(result.action, "ko")}
        </p>
        {result.session?.title && (
          <p className="text-gray-500 text-sm mt-1">{result.session.title}</p>
        )}
      </div>

      {result.action === "checked_in" && (
        <p className="text-blue-500 text-xs text-center">
          TBM 종료 후 QR을 다시 스캔하면 이수 인증됩니다.
        </p>
      )}

      <p className="text-gray-700 text-xs text-center mt-4">
        SAFE-LINK — QR 백업 출석 시스템
      </p>
    </div>
  );
}

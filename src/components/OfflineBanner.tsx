"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { getT as getAuthT } from "@/app/auth/translations";

const OFFLINE_MESSAGE: Record<string, string> = {
  ko: "인터넷 연결이 없습니다. 입력 내용은 유지되며, 연결 후 다시 시도해 주세요.",
  en: "No internet connection. Your input is kept; please try again after reconnecting.",
  zh: "没有网络连接。输入内容会被保留，请在恢复连接后重试。",
  vi: "Không có kết nối internet. Nội dung đã nhập sẽ được giữ lại; hãy thử lại sau khi kết nối lại.",
  ru: "Нет подключения к интернету. Введённые данные сохранены; повторите попытку после восстановления соединения.",
};

export default function OfflineBanner() {
  const language = useDisplayLanguage();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="safe-area-banner fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 py-3 text-center text-sm font-black text-slate-950 shadow-lg"
    >
      <WifiOff className="h-5 w-5 shrink-0" />
      {OFFLINE_MESSAGE[language] ?? getAuthT(language).adminDesc}
    </div>
  );
}

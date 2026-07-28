"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
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
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 px-4 py-3 text-center text-sm font-black text-slate-950 shadow-lg"
    >
      <WifiOff className="h-5 w-5 shrink-0" />
      인터넷 연결이 없습니다. 입력 내용은 유지되며, 연결 후 다시 시도해 주세요.
    </div>
  );
}

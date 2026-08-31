"use client";

import { useEffect, useRef } from "react";
import { playNotificationSound } from "@/utils/notifications";
import { ensureLocalNotifyPermission, notifyNative } from "@/utils/native/local-notify";

type TbmNotice = {
  id?: string | number;
  title?: string | null;
  content_ko?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};

/**
 * PostgreSQL에 새로 저장된 TBM 공지를 근로자 앱에서 감지한다.
 * 첫 조회의 기존 공지는 조용히 기준값으로만 저장하고, 이후 새 ID가 생겼을 때만 알린다.
 */
export default function WorkerTbmNotificationListener() {
  const latestTbmIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const alertWorker = (notice: TbmNotice) => {
      playNotificationSound();
      navigator.vibrate?.([300, 100, 300, 100, 300]);
      void notifyNative(
        notice.title?.trim() || "새 TBM 안전 안내",
        notice.content_ko?.trim() || "관리자가 새 안전 브리핑을 전파했습니다. 확인 후 서명해 주세요.",
      );
      window.dispatchEvent(new CustomEvent("sq-link:tbm-received", { detail: notice }));
    };

    const refresh = async () => {
      try {
        const response = await fetch("/api/tbm/today?limit=1", {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok || cancelled) return;
        const payload = await response.json() as { tbms?: TbmNotice[] };
        const latest = payload.tbms?.[0];
        if (!latest) return;

        const timestamp = latest.published_at ?? latest.created_at ?? "";
        const id = latest.id == null ? `${timestamp}:${latest.content_ko ?? ""}` : String(latest.id);
        const previousId = latestTbmIdRef.current;
        latestTbmIdRef.current = id;

        if (previousId && previousId !== id) alertWorker(latest);
      } catch {
        // 다음 주기에 재시도한다. 알림 실패가 근로자 화면을 막으면 안 된다.
      }
    };

    void ensureLocalNotifyPermission();
    void refresh();
    const interval = window.setInterval(refresh, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

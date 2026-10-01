"use client";

import { useEffect, useRef, useState } from "react";
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
  const [allowed, setAllowed] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled) return;
        setAllowed(Boolean(data?.user && data?.profile?.role && data.profile.role !== "TEMP_WORKER" && !data?.v3?.roles?.includes("TEMP_WORKER")));
        setSiteId(data?.profile?.site_id ? String(data.profile.site_id) : null);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!allowed) return;
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
  }, [allowed]);

  // 최종 TBM 전파 전에도, 방송 시작 신호를 즉시 근로자에게 알린다.
  // SSE는 앱이 실행 중일 때 실시간으로 수신한다. 앱이 완전히 종료된 상태의 원격 푸시는
  // 별도 FCM/APNs 연동이 필요하므로 여기서 흉내 내지 않는다.
  useEffect(() => {
    if (!siteId) return;
    const announced = new Set<string>();
    const events = new EventSource("/api/live/events?" + new URLSearchParams({ type: "translations", siteId }));
    events.addEventListener("broadcast-start", event => {
      try {
        const broadcast = JSON.parse((event as MessageEvent<string>).data) as { session_id?: string };
        const sessionId = broadcast.session_id;
        if (!sessionId?.startsWith("tbm_") || announced.has(sessionId)) return;
        announced.add(sessionId);
        playNotificationSound();
        navigator.vibrate?.([300, 120, 300]);
        void notifyNative(
          "TBM 실시간 방송 시작",
          "관리자가 실시간 안전교육을 시작했습니다. 통역 내용을 확인해 주세요.",
        );
        // 근로자 홈은 이 이벤트를 받아 기존 TBM 전파 알림 카드와 동일한 UI를 표시한다.
        window.dispatchEvent(new CustomEvent("sq-link:tbm-live-start", { detail: { sessionId } }));
      } catch {
        // 다음 방송 시작 신호를 기다린다.
      }
    });
    events.addEventListener("broadcast-stop", event => {
      try {
        const broadcast = JSON.parse((event as MessageEvent<string>).data) as { session_id?: string };
        const sessionId = broadcast.session_id;
        if (!sessionId?.startsWith("tbm_")) return;
        window.dispatchEvent(new CustomEvent("sq-link:tbm-live-stop", { detail: { sessionId } }));
      } catch {
        // 다음 방송 시작 신호를 기다린다.
      }
    });
    return () => events.close();
  }, [siteId]);

  return null;
}

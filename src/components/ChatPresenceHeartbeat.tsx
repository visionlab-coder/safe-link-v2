"use client";

import { useEffect } from "react";

/**
 * 로그인된 사용자가 앱을 실제로 열어 둔 동안 채팅 온라인 상태를 갱신한다.
 * 기존에는 /chat 페이지 안에서만 heartbeat를 보내 근로자가 홈 화면에 있으면
 * 관리자에게 오프라인으로 보이는 문제가 있었다.
 */
export default function ChatPresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const heartbeat = async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!me.ok || cancelled) return;
        await fetch("/api/chat/presence", {
          method: "POST",
          cache: "no-store",
          credentials: "include",
        });
      } catch {
        // 온라인 표시는 보조 정보이므로 네트워크 오류가 화면 기능을 막지 않는다.
      }
    };

    void heartbeat();
    const interval = window.setInterval(heartbeat, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void heartbeat();
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

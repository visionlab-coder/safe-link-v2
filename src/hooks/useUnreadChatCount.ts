"use client";

import { useCallback, useEffect, useState } from "react";

type UnreadCountResponse = { count?: number };

export function useUnreadChatCount(userId: string | null | undefined): number {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!userId) {
            setCount(0);
            return;
        }

        try {
            const response = await fetch("/api/chat/unread-count", { cache: "no-store", credentials: "include" });
            if (!response.ok) return;
            const payload = (await response.json()) as UnreadCountResponse;
            setCount(Math.max(0, Number(payload.count) || 0));
        } catch {
            // 연결이 잠시 끊겨도 기존 배지를 유지하고 다음 이벤트/폴링에서 재시도한다.
        }
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setCount(0);
            return;
        }

        void refresh();
        const events = new EventSource("/api/chat/user-events");
        events.addEventListener("message", () => void refresh());
        events.onerror = () => {};

        const interval = window.setInterval(() => void refresh(), 10_000);
        const handleVisibility = () => {
            if (document.visibilityState === "visible") void refresh();
        };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            events.close();
            window.clearInterval(interval);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [refresh, userId]);

    return count;
}

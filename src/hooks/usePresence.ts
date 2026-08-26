"use client";

import { useEffect, useMemo, useState } from "react";

type PresencePayload = { online_user_ids?: string[] };

/** Chat 화면이 열려 있는 사용자만 45초 유효시간으로 온라인 처리한다. */
export function usePresence(userId: string | null, peerIds: string[] = []) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());
    const peerKey = useMemo(() => Array.from(new Set(peerIds)).sort().join(","), [peerIds]);

    useEffect(() => {
        if (!userId) {
            setOnlineUsers(new Set());
            return;
        }

        let cancelled = false;
        const refresh = async () => {
            try {
                await fetch("/api/chat/presence", { method: "POST", credentials: "include", cache: "no-store" });
                if (!peerKey) {
                    if (!cancelled) setOnlineUsers(new Set());
                    return;
                }
                const response = await fetch(`/api/chat/presence?user_ids=${encodeURIComponent(peerKey)}`, {
                    credentials: "include",
                    cache: "no-store",
                });
                if (!response.ok || cancelled) return;
                const payload = await response.json() as PresencePayload;
                if (!cancelled) setOnlineUsers(new Set(payload.online_user_ids ?? []));
            } catch {
                // Presence is cosmetic; chat itself must continue during a transient failure.
            }
        };

        void refresh();
        const interval = window.setInterval(refresh, 20_000);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void refresh();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [userId, peerKey]);

    return onlineUsers;
}

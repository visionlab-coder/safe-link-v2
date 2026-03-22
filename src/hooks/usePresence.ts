"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHANNEL_NAME = "online-users";

export function usePresence(userId: string | null) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!userId) return;

        const supabase = createClient();
        const channel = supabase.channel(CHANNEL_NAME, {
            config: { presence: { key: userId } },
        });

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState();
                const ids = new Set<string>(Object.keys(state));
                setOnlineUsers(ids);
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ user_id: userId, online_at: new Date().toISOString() });
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [userId]);

    return onlineUsers;
}

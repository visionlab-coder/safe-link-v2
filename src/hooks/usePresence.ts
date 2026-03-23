"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHANNEL_NAME = "online-users";

export function usePresence(userId: string | null) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const channelRef = useRef<RealtimeChannel | null>(null);

    const updateFromState = useCallback((channel: RealtimeChannel) => {
        const state = channel.presenceState();
        setOnlineUsers(new Set<string>(Object.keys(state)));
    }, []);

    useEffect(() => {
        if (!userId) return;

        const supabase = createClient();
        const channel = supabase.channel(CHANNEL_NAME, {
            config: { presence: { key: userId } },
        });

        channel
            .on("presence", { event: "sync" }, () => {
                updateFromState(channel);
            })
            .on("presence", { event: "join" }, ({ key }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                });
            })
            .on("presence", { event: "leave" }, ({ key }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
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
    }, [userId, updateFromState]);

    return onlineUsers;
}

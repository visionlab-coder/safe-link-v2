"use client";

import { useMemo } from "react";

export function usePresence(_userId: string | null) {
    return useMemo(() => new Set<string>(), []);
}

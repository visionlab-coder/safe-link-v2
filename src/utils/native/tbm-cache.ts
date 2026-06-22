/**
 * TBM 오프라인 캐시 — MC-009 (#3, 안전 버전)
 *
 * 글로벌 서비스워커(전 fetch 가로채기, 라이브 PoC 위험) 대신, 마지막으로 본 TBM
 * 내용만 localStorage 에 저장한다. 오프라인일 때만 폴백 표시(온라인-무TBM 시 stale
 * 표시 금지 — 안전상 중요). 모든 접근은 try/catch 로 감싸 본 흐름을 절대 막지 않는다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const KEY_PREFIX = "sl_tbm_cache_";

export function saveTbmCache(userId: string, tbm: any): void {
    if (typeof window === "undefined" || !userId || !tbm) return;
    try {
        const payload = { savedAt: Date.now(), tbm };
        window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(payload));
    } catch {
        /* 용량 초과/비활성 등 무시 — 캐시는 보조 기능 */
    }
}

export function loadTbmCache(userId: string): any | null {
    if (typeof window === "undefined" || !userId) return null;
    try {
        const raw = window.localStorage.getItem(KEY_PREFIX + userId);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; tbm?: any };
        return parsed?.tbm ?? null;
    } catch {
        return null;
    }
}

/** 오프라인 여부(브라우저 신호). SSR/미지원 시 false(=온라인 가정). */
export function isOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

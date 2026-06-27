import { Preferences } from "@capacitor/preferences";

// 📱 M-005 — 모바일 세션 토큰 저장소.
// ⚠️ 보안 주의: @capacitor/preferences 는 네이티브에서 평문(SharedPreferences/UserDefaults).
//    상용 하드닝 단계에서 암호화 백엔드(capacitor-secure-storage 등)로 교체 권장.
//    이 모듈이 저장 추상화라 백엔드 교체 시 호출부 변경 불필요.

const KEY = "safelink.session.v1";

export type StoredSession = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    stored_at: number;
};

export async function saveSession(s: Omit<StoredSession, "stored_at">): Promise<void> {
    await Preferences.set({ key: KEY, value: JSON.stringify({ ...s, stored_at: Date.now() }) });
}

export async function loadSession(): Promise<StoredSession | null> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    try {
        return JSON.parse(value) as StoredSession;
    } catch {
        return null;
    }
}

export async function getAccessToken(): Promise<string | null> {
    return (await loadSession())?.access_token ?? null;
}

export async function clearSession(): Promise<void> {
    await Preferences.remove({ key: KEY });
}

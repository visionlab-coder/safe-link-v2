/**
 * 네이티브(Capacitor) 로컬 알림 헬퍼 — MC-007 (A: TBM 인앱 알림)
 *
 * 핵심: feature-detected. 일반 브라우저에는 window.Capacitor 가 없으므로 전부 no-op →
 * 기존 웹앱/PoC 사용자 동작에 일절 영향 없음. 모바일 앱(Capacitor WebView)에서만 활성화.
 *
 * @capacitor/local-notifications 플러그인은 모바일 네이티브에 설치/등록되며,
 * 웹 코드는 npm import 없이 window.Capacitor.Plugins.LocalNotifications 로 호출한다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type CapWindow = Window & {
    Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { LocalNotifications?: any };
    };
};

function getLocalNotifications(): any | null {
    if (typeof window === "undefined") return null;
    const cap = (window as CapWindow).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.LocalNotifications ?? null;
}

/** Capacitor 네이티브 앱 안에서 실행 중인지 */
export function isNativeApp(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as CapWindow).Capacitor?.isNativePlatform?.());
}

/** 로컬 알림 권한 요청(네이티브에서만). 권한 허용 여부 반환. */
export async function ensureLocalNotifyPermission(): Promise<boolean> {
    const ln = getLocalNotifications();
    if (!ln) return false;
    try {
        const res = await ln.requestPermissions?.();
        return res?.display === "granted";
    } catch {
        return false;
    }
}

// 알림 id 충돌 방지용 카운터 (32-bit 정수 범위 내)
let idCounter = Math.floor(Date.now() % 1_000_000);
function nextId(): number {
    idCounter = (idCounter + 1) % 2_000_000_000;
    return idCounter || 1;
}

/**
 * 즉시 로컬 알림 표시(네이티브에서만, 그 외 no-op).
 * 실패는 조용히 무시 — 알림은 보조 기능이라 본 흐름을 막지 않는다.
 */
export async function notifyNative(title: string, body: string): Promise<void> {
    const ln = getLocalNotifications();
    if (!ln) return;
    try {
        await ln.schedule({
            notifications: [
                {
                    id: nextId(),
                    title,
                    body,
                    smallIcon: "ic_launcher",
                },
            ],
        });
    } catch {
        /* no-op: 알림 실패가 앱 동작을 막지 않도록 */
    }
}

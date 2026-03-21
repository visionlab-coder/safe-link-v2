const DEVICE_ID_KEY = 'safe-link-device-id';
const DEVICE_LANG_KEY = 'safe-link-device-lang';

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

export function createDeviceId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getOrCreateDeviceId(): string {
  const existing = getDeviceId();
  if (existing) return existing;
  return createDeviceId();
}

export function getDeviceLang(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_LANG_KEY);
}

export function setDeviceLang(lang: string): void {
  localStorage.setItem(DEVICE_LANG_KEY, lang);
}

import { QR_LANGUAGE_OPTIONS } from '@/utils/qr/language-options';

// SQ Link's 20 languages. Keep existing Free Talk `ja` links compatible;
// use the translation-provider code `tl` for Filipino (SQ Link calls it `ph`).
export function normalizeFreeTalkLanguage(value: string): string {
  const code = value.trim().toLowerCase().split(/[-_]/)[0];
  return code === 'jp' ? 'ja' : code === 'ph' || code === 'fil' ? 'tl' : code;
}

const SPEECH_LOCALES: Record<string, string> = {
  ko: 'ko-KR', vi: 'vi-VN', zh: 'zh-CN', th: 'th-TH', uz: 'uz-UZ',
  tl: 'fil-PH', km: 'km-KH', id: 'id-ID', mn: 'mn-MN', my: 'my-MM',
  ne: 'ne-NP', bn: 'bn-IN', kk: 'kk-KZ', ru: 'ru-RU', en: 'en-US',
  ja: 'ja-JP', fr: 'fr-FR', es: 'es-ES', ar: 'ar-SA', hi: 'hi-IN',
};

export const FREE_TALK_LANGUAGES: Record<string, { label: string; flag: string; stt: string }> =
  Object.fromEntries(QR_LANGUAGE_OPTIONS.map(option => {
    const code = normalizeFreeTalkLanguage(option.lang);
    const flag = [...option.country].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
    return [code, { label: option.nativeName, flag, stt: SPEECH_LOCALES[code] }];
  }));

export function isFreeTalkLanguage(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(FREE_TALK_LANGUAGES, normalizeFreeTalkLanguage(value));
}

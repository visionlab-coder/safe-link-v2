export const NFC_TAG_TYPES = {
  CHECK_IN: 'check_in',
  CONFIRM: 'confirm',
} as const;

export type NfcTagType = typeof NFC_TAG_TYPES[keyof typeof NFC_TAG_TYPES];

export const NFC_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://safe-link-v2.vercel.app';

export function generateNfcUrl(tagCode: string, type: NfcTagType): string {
  const path = type === NFC_TAG_TYPES.CONFIRM ? '/nfc/confirm' : '/nfc/check-in';
  return `${NFC_BASE_URL}${path}?tag=${encodeURIComponent(tagCode)}`;
}

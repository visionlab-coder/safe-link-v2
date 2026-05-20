import { createHmac } from 'crypto';

const BIRTHDAY_RE = /^\d{8}$/;
const PHONE4_RE = /^\d{4}$/;
const TOKEN_RE = /^[0-9a-f]{24}$/;

function getSalt(): string {
  const salt = process.env.SAFE_LINK_HASH_SALT;
  if (!salt || salt.length < 32) throw new Error('SAFE_LINK_HASH_SALT must be ≥32 chars');
  return salt;
}

/**
 * HMAC-SHA256(key=SALT, message=birthday+phone_last4) → 앞 24자리 hex 토큰 (96-bit)
 * 결정론적: 같은 입력은 항상 같은 토큰 반환
 */
export function generateWorkerToken(birthday: string, phoneLast4: string): string {
  if (!BIRTHDAY_RE.test(birthday)) throw new Error('birthday must be YYYYMMDD (8 digits)');
  if (!PHONE4_RE.test(phoneLast4)) throw new Error('phoneLast4 must be 4 digits');

  return createHmac('sha256', getSalt())
    .update(`${birthday}${phoneLast4}`)
    .digest('hex')
    .slice(0, 24);
}

/** NFC 카드에서 읽은 토큰 형식 검증 */
export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

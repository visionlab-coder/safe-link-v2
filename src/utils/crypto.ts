import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV (GCM 표준)
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const raw = process.env.SAFE_LINK_AES_KEY;
  if (!raw) throw new Error('SAFE_LINK_AES_KEY not configured');
  const key = Buffer.from(raw, 'base64');
  if (key.byteLength !== 32) throw new Error('SAFE_LINK_AES_KEY must be 32-byte base64');
  return key;
}

/**
 * AES-256-GCM 암호화 (개인정보보호법 제29조 안전조치 의무)
 * 출력: base64(iv[12] + ciphertext + authTag[16]) — DB TEXT 컬럼에 저장
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * AES-256-GCM 복호화
 * 입력: encrypt()가 반환한 base64 문자열
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, 'base64');

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.byteLength - TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.byteLength - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

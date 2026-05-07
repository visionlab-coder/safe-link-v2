/**
 * SAFE-LINK — NFC 상수 & URL 빌더
 *
 * Worker Sticker URL 체계 (특허 모델):
 *   {BASE}/nfc/w/{workerId}?v={sigVersion}&t={issuedEpoch}&sig={hmac}
 *
 * 탭 1회 = TBM 참석 확인 (출퇴근 아님 — 홍채인식이 담당)
 */

export const NFC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://safe-link-v2.vercel.app";

export interface StickerUrlParams {
  workerId: string;
  sigVersion: number;
  issuedEpoch: number;
  sig: string;
  baseUrl?: string;
}

export function generateWorkerStickerUrl(params: StickerUrlParams): string {
  const base = params.baseUrl || NFC_BASE_URL;
  const q = new URLSearchParams({
    v: String(params.sigVersion),
    t: String(params.issuedEpoch),
    sig: params.sig,
  });
  return `${base}/nfc/w/${encodeURIComponent(params.workerId)}?${q.toString()}`;
}

export const WORKER_STICKER_PATH_PREFIX = "/nfc/w/";

export const TRADES = [
  { code: "rebar",     name_ko: "철근공",      name_en: "Rebar Worker" },
  { code: "formwork",  name_ko: "형틀공",      name_en: "Formwork Carpenter" },
  { code: "concrete",  name_ko: "콘크리트공",  name_en: "Concrete Worker" },
  { code: "scaffold",  name_ko: "비계공",      name_en: "Scaffolder" },
  { code: "welder",    name_ko: "용접공",      name_en: "Welder" },
  { code: "signalman", name_ko: "신호수",      name_en: "Signalman" },
  { code: "equipment", name_ko: "중장비 기사", name_en: "Heavy Equipment Operator" },
  { code: "general",   name_ko: "보통인부",    name_en: "General Labor" },
  { code: "foreman",   name_ko: "반장",        name_en: "Foreman" },
  { code: "safety",    name_ko: "안전관리자",  name_en: "Safety Manager" },
] as const;

export type TradeCode = typeof TRADES[number]["code"];

export const NFC_BASE_URL =
  process.env.NEXT_PUBLIC_NFC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://safe-link-v2.vercel.app";

export interface StickerUrlParams {
  workerId: string;
  sigVersion: number;
  issuedEpoch: number;
  sig: string;
  baseUrl?: string;
}

export function generateWorkerStickerUrl(params: StickerUrlParams): string {
  const base = (params.baseUrl || NFC_BASE_URL).replace(/\/$/, "");
  const q = new URLSearchParams({
    v: String(params.sigVersion),
    t: String(params.issuedEpoch),
    s: params.sig,
  });
  return `${base}/n/${encodeURIComponent(params.workerId)}?${q.toString()}`;
}

export const WORKER_STICKER_PATH_PREFIX = "/n/";

export const TRADES = [
  { code: "rebar", name_ko: "Rebar", name_en: "Rebar Worker" },
  { code: "formwork", name_ko: "Formwork", name_en: "Formwork Carpenter" },
  { code: "concrete", name_ko: "Concrete", name_en: "Concrete Worker" },
  { code: "scaffold", name_ko: "Scaffold", name_en: "Scaffolder" },
  { code: "welder", name_ko: "Welder", name_en: "Welder" },
  { code: "signalman", name_ko: "Signalman", name_en: "Signalman" },
  { code: "equipment", name_ko: "Equipment", name_en: "Heavy Equipment Operator" },
  { code: "general", name_ko: "General", name_en: "General Labor" },
  { code: "foreman", name_ko: "Foreman", name_en: "Foreman" },
  { code: "safety", name_ko: "Safety", name_en: "Safety Manager" },
] as const;

export type TradeCode = typeof TRADES[number]["code"];

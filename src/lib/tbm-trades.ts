/** Stored on each TBM, never on a worker's role or membership. */
export const TBM_TRADES = ["철근", "거푸집", "콘크리트", "갱폼", "알폼", "비계", "양중", "할석미장", "해체", "정리", "시스템", "직영", "용역", "로프공", "거푸집-형틀", "타설(콘비_콘크리트 비계)"] as const;

export function normalizeTbmTrades(value: unknown): string[] {
  return Array.isArray(value) ? TBM_TRADES.filter(trade => value.includes(trade)) : [];
}

export function toggleTbmTrade(selected: string[], trade: string): string[] {
  return normalizeTbmTrades(selected.includes(trade) ? selected.filter(item => item !== trade) : [...selected, trade]);
}

export function toggleAllTbmTrades(selected: string[]): string[] {
  return normalizeTbmTrades(selected).length === TBM_TRADES.length ? [] : [...TBM_TRADES];
}

export function tbmTradeHeading(lang: string) {
  return ({ ko: "TBM 공종", en: "TBM trades", zh: "TBM 工种", vi: "Công việc TBM", jp: "TBM 工種", ja: "TBM 工種" } as Record<string, string>)[lang] || "TBM trades";
}

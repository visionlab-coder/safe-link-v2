"use client";

import { TBM_TRADES, normalizeTbmTrades, toggleAllTbmTrades, toggleTbmTrade } from "@/lib/tbm-trades";
import { tbmLanguage, tbmTradeLabel, tbmTradeSelectorUI } from "@/lib/tbm-trade-labels";

/** Display-only labels; submissions always retain the canonical server catalog. */
export default function TbmTradeOptions({ selected, onChange, lang, commonChannel = false }: {
  selected: string[];
  onChange: (trades: string[]) => void;
  lang: string;
  commonChannel?: boolean;
}) {
  const count = normalizeTbmTrades(selected).length;
  const all = commonChannel ? count === 0 : count === TBM_TRADES.length;
  const options = [{ value: null, label: tbmTradeSelectorUI(lang).all }, ...TBM_TRADES.map(value => ({ value, label: tbmTradeLabel(value, lang) }))];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" dir={tbmLanguage(lang) === "ar" ? "rtl" : undefined}>
    {options.map(({ value, label }) => {
      const checked = value === null ? all : selected.includes(value);
      return <label key={value ?? "all"} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold has-disabled:cursor-not-allowed ${checked ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
        <input type="checkbox" name={value === null ? "tbm-trades-all" : "tbm-trades"} value={value ?? "all"}
          checked={checked} ref={input => { if (input && value === null) input.indeterminate = !commonChannel && count > 0 && !all; }}
          onChange={() => onChange(value === null ? commonChannel ? [] : toggleAllTbmTrades(selected) : toggleTbmTrade(selected, value))}
          className="h-4 w-4 shrink-0 accent-blue-600" />
        <span className="min-w-0 break-words">{label}</span>
      </label>;
    })}
  </div>;
}

import { normalizeTbmTrades, tbmTradeHeading } from "@/lib/tbm-trades";
import { displaySetupTrade } from "@/lib/profile-setup-ui";

export default function TbmTradeBadges({ trades, lang }: { trades: unknown; lang: string }) {
  const values = normalizeTbmTrades(trades);
  if (!values.length) return null;
  return <div data-testid="tbm-trade-badges" className="flex flex-wrap items-center gap-2 text-sm">
    <span className="font-bold text-slate-600">{tbmTradeHeading(lang)}</span>
    {values.map(trade => <span key={trade} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-bold text-blue-800">{displaySetupTrade(trade, lang)}</span>)}
  </div>;
}

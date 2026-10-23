import { normalizeTbmTrades, tbmTradeHeading } from "@/lib/tbm-trades";
import { tbmTradeLabel } from "@/lib/tbm-trade-labels";
import { dailyTradeUI } from "@/lib/worker-daily-trades";
import { koreanHelpText } from "@/lib/korean-help";

export default function TbmTradeBadges({ trades, lang, koreanHelp = false }: { trades: unknown; lang: string; koreanHelp?: boolean }) {
  const values = normalizeTbmTrades(trades);
  if (!values.length) return <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{koreanHelpText(dailyTradeUI(lang).common, dailyTradeUI("ko").common, lang, koreanHelp)}</span>;
  return <div data-testid="tbm-trade-badges" className="flex flex-wrap items-center gap-2 text-sm">
    <span className="font-bold text-slate-600">{koreanHelpText(tbmTradeHeading(lang), tbmTradeHeading("ko"), lang, koreanHelp)}</span>
    {values.map(trade => <span key={trade} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-bold text-blue-800">{koreanHelpText(tbmTradeLabel(trade, lang), tbmTradeLabel(trade, "ko"), lang, koreanHelp)}</span>)}
  </div>;
}

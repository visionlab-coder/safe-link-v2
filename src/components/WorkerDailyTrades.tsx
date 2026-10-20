"use client";
import { useEffect, useRef, useState } from "react";
import { TBM_TRADES, toggleTbmTrade } from "@/lib/tbm-trades";
import { tbmTradeLabel } from "@/lib/tbm-trade-labels";
import { dailyTradeUI, isCurrentDailyTrades, loadDailyTrades, type DailyTrades } from "@/lib/worker-daily-trades";
import WorkerTbmNotices from "./WorkerTbmNotices";

export default function WorkerDailyTrades(props: { siteId: string; temporary: boolean; lang: string; message: string }) {
  const { siteId, temporary, lang } = props;
  const [selection, setSelection] = useState<DailyTrades | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [other, setOther] = useState(false);
  const current = useRef<DailyTrades | null>(null);
  const generation = useRef(0);
  const ui = dailyTradeUI(lang);
  useEffect(() => {
    if (temporary) return;
    const abort = new AbortController();
    const refresh = async () => {
      const version = generation.current;
      if (current.current && !isCurrentDailyTrades(current.current)) {
        current.current = null; setSelection(null); setDraft([]); setEditing(true); setOther(false);
      }
      try {
        const value = await loadDailyTrades(siteId, abort.signal);
        if (abort.signal.aborted || version !== generation.current) return;
        const previous = current.current;
        if (!previous || previous.date !== value.date || JSON.stringify(previous.trades) !== JSON.stringify(value.trades)) {
          setDraft(value.trades); setEditing(!value.selected); setOther(false);
        }
        current.current = value; setSelection(value);
        setError(false);
      } catch { if (!abort.signal.aborted) setError(true); }
    };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", visible);
    return () => { abort.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [siteId, temporary, reload]);
  async function save() {
    if (!selection || !draft.length || busy) return;
    generation.current++;
    setBusy(true); setError(false);
    try {
      const res = await fetch(`/api/tbm/daily-trades?${new URLSearchParams({ siteId })}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selection.date, trades: draft }),
      });
      if (!res.ok) throw new Error("save_failed");
      const saved = await res.json();
      current.current = saved;
      setSelection(saved); setDraft(saved.trades); setEditing(false); setOther(false);
      window.dispatchEvent(new Event("sq-link:daily-trades-changed"));
    } catch { setError(true); setReload(value => value + 1); }
    finally { generation.current++; setBusy(false); }
  }
  if (temporary) return <WorkerTbmNotices {...props} />;
  const ready = selection?.selected && !error;
  return <div id="today-tbm" className="flex flex-col gap-4" dir={lang === "ar" ? "rtl" : undefined}>
    <section data-testid="daily-trades" className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">{ui.title}</h2>
      <p className="my-2 text-sm text-slate-600">{ui.description}</p>
      {error && <p role="alert" className="my-3 text-red-700">{ui.error} <button type="button" onClick={() => setReload(v => v + 1)} className="underline">{ui.retry}</button></p>}
      {!selection && !error && <p role="status" className="text-slate-500">…</p>}
      {selection && (editing || !selection.selected) ? <fieldset disabled={busy} className="mt-4">
        <legend className="sr-only">{ui.title}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TBM_TRADES.map(trade => <label key={trade} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold ${draft.includes(trade) ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"}`}>
            <input type="checkbox" className="shrink-0" checked={draft.includes(trade)} onChange={() => setDraft(value => toggleTbmTrade(value, trade))} />
            <span className="min-w-0 break-words">{tbmTradeLabel(trade, lang)}</span>
          </label>)}
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" disabled={!draft.length || busy} onClick={save} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-40">{busy ? "…" : ui.save}</button>
          {selection.selected && <button type="button" onClick={() => { setDraft(selection.trades); setEditing(false); }} className="rounded-xl border border-slate-300 px-4 py-3 text-slate-700">{ui.cancel}</button>}
        </div>
      </fieldset> : selection && <div className="mt-3 flex flex-wrap items-center gap-2">
        {selection.trades.map(trade => <span key={trade} className="rounded-xl bg-blue-50 px-3 py-2 font-bold text-blue-900">{tbmTradeLabel(trade, lang)}</span>)}
        <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-blue-300 px-3 py-2 font-bold text-blue-700">{ui.change}</button>
      </div>}
    </section>
    {ready && <>
      <WorkerTbmNotices {...props} key={`${selection.date}:${selection.trades.join(",")}`} selection={selection} />
      <button type="button" aria-expanded={other} onClick={() => setOther(v => !v)} className="self-start rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600">{ui.other}</button>
      {other && <WorkerTbmNotices {...props} key={`other:${selection.date}:${selection.trades.join(",")}`} selection={selection} otherTrades />}
    </>}
  </div>;
}

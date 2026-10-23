"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadPendingTbms, tbmNotificationColumns, todayTbmNotices, type TbmHomeNotice } from "@/lib/tbm-notifications";
import { normalizeTbmTrades } from "@/lib/tbm-trades";
import { tbmLanguage, tbmTradeLabel } from "@/lib/tbm-trade-labels";
import { koreanHelpText } from "@/lib/korean-help";
import styles from "./WorkerTbmNotices.module.css";
import { liveTbmSessions } from "@/lib/tbm-live-sessions";
import { dailyTradeUI, matchesDailyTrades, type DailyTrades } from "@/lib/worker-daily-trades";

export default function WorkerTbmNotices({ siteId, temporary, lang, message, selection, otherTrades = false, liveOnly = false }: {
  siteId: string; temporary: boolean; lang: string; message: string;
  selection?: DailyTrades; otherTrades?: boolean;
  liveOnly?: boolean;
}) {
  const [notices, setNotices] = useState<TbmHomeNotice[]>([]);
  const [live, setLive] = useState<TbmHomeNotice[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    let busy = false;
    let queued = false;
    const refresh = async () => {
      if (abort.signal.aborted) return;
      if (busy) { queued = true; return; }
      busy = true;
      setNotices(current => todayTbmNotices(current));
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]);
      await Promise.allSettled([
        temporary || liveOnly ? Promise.resolve() : loadPendingTbms(siteId, signal, otherTrades).then(rows => {
          if (!abort.signal.aborted) setNotices(todayTbmNotices(rows));
        }),
        fetch(`/api/live/sessions?${new URLSearchParams({ siteId })}`, {
          cache: "no-store", credentials: "include", signal,
        }).then(async response => {
          if (!response.ok) return;
          const data = await response.json();
          if (abort.signal.aborted) return;
          setLive(liveTbmSessions(data).filter(session => (!selection || matchesDailyTrades(session.trade_types, selection)) !== otherTrades)
            .map(session => ({ id: session.session_id, trade_types: session.trade_types, created_at: session.started_at })));
        }),
      ]);
      busy = false;
      if (queued) { queued = false; void refresh(); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const events = ["sq-link:tbm-received", "sq-link:tbm-live-start", "sq-link:tbm-live-stop"];
    events.forEach(event => window.addEventListener(event, refresh));
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 15000);
    void refresh();
    return () => {
      abort.abort();
      window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, refresh));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [siteId, temporary, selection, otherTrades, liveOnly]);

  const cards = [...live.map(notice => ({ notice, isLive: true })), ...notices.map(notice => ({ notice, isLive: false }))];
  if (!cards.length) return null;
  const language = tbmLanguage(lang);
  const locale = language === "jp" ? "ja" : language === "ph" ? "fil" : language;
  return <section data-testid="tbm-notices" className={styles.grid} dir={language === "ar" ? "rtl" : undefined}
    style={{ gridTemplateColumns: `repeat(${tbmNotificationColumns(cards.length)}, minmax(0, 1fr))` }}>
    {cards.map(({ notice, isLive }) => {
      const trades = normalizeTbmTrades(notice.trade_types);
      const timestamp = notice.published_at ?? notice.created_at;
      const date = timestamp ? new Date(timestamp) : null;
      return <Link key={notice.id} data-testid="tbm-notice" data-tbm-id={notice.id}
        href={`${isLive && temporary ? "/worker/live" : `/worker/tbm/${isLive ? "today" : encodeURIComponent(notice.id)}`}?lang=${encodeURIComponent(lang)}${isLive ? `&broadcastSession=${encodeURIComponent(notice.id)}` : ""}${otherTrades && isLive ? "&allTrades=1" : ""}`}
        className={`tbm-new-notice ${styles.card} ${cards.length === 1 ? styles.single : styles.compact}`}>
        <div className={styles.icon} aria-hidden="true">
          <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className={styles.body}>
          <p className={styles.trades} data-testid="tbm-notice-trades">
            {trades.length ? trades.map(trade => <span key={trade}>{koreanHelpText(tbmTradeLabel(trade, lang), tbmTradeLabel(trade, "ko"), lang)}</span>) : <span>{koreanHelpText(dailyTradeUI(lang).common, dailyTradeUI("ko").common, lang)}</span>}
            {isLive && <span className={styles.live}>{koreanHelpText("LIVE", "방송 중", lang)}</span>}
          </p>
          <h2>{message}</h2>
          {date && !Number.isNaN(date.getTime()) && <time dateTime={date.toISOString()}>
            {date.toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </time>}
        </div>
        <span className={styles.arrow} aria-hidden="true">›</span>
      </Link>;
    })}
  </section>;
}

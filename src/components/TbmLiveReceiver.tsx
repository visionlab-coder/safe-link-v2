"use client";
import { useEffect, useRef, useState } from "react";
import { stripForSpeech } from "@/utils/tts";
import { appendTbmTranscript, cleanTbmTranscriptFragment } from "@/utils/tbm-transcript";
import TbmQuestionLink from "@/components/TbmQuestionLink";
import { tbmAdminId } from "@/lib/tbm-chat";
import { matchedTbmSummary, type TbmLiveSummary } from "@/lib/tbm-live-completion";

/** Live events only: never fetch or replay historical utterances. */
export default function TbmLiveReceiver({ siteId, lang, busyLabel, listenLabel, onActiveChange, onSession, onSummary, allowQuestions = false }: {
  siteId: string | null;
  lang: string;
  busyLabel: string;
  listenLabel: string;
  onActiveChange?: (active: boolean) => void;
  onSession?: (sessionId: string) => void;
  onSummary?: (summary: TbmLiveSummary) => void;
  allowQuestions?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [lines, setLines] = useState<Array<{ id: string; source: string; translated?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const callbacks = useRef({ onSession, onSummary });
  callbacks.current = { onSession, onSummary };
  const observation = useRef<{ siteId: string; sessionId: string } | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (!siteId) return;
    let disposed = false, session: string | null = null, generation = 0;
    // Keep the pending handoff when the display language changes, never across sites.
    let observedSession: string | null = observation.current?.siteId === siteId ? observation.current.sessionId : null;
    let completedSession: string | null = null;
    let checkingSummary = false;
    let audioQueue = Promise.resolve();
    let speakingTimer: ReturnType<typeof setTimeout> | null = null;
    let sentenceCommitTimer: ReturnType<typeof setTimeout> | null = null;
    const seen = new Set<string>();
    const committedLineIds = new Set<string>();
    const spokenLineIds = new Set<string>();
    const latestTextByLine = new Map<string, string>();
    const latestRevisionByLine = new Map<string, number>();
    const displayedRevisionByLine = new Map<string, number>();
    let activeLineId: string | null = null;
    let activeSource = "";
    let activeRevision = 0;
    const abort = new AbortController();
    const reset = (id: string | null, startedBy?: unknown) => {
      setBroadcasterId(id ? tbmAdminId(startedBy) : null);
      if (session === id) return;
      session = id; generation++; seen.clear(); setLines([]); setActive(Boolean(id)); setSpeaking(false);
      if (id) {
        observedSession = id;
        observation.current = { siteId, sessionId: id };
        completedSession = null;
        callbacks.current.onSession?.(id);
      }
      activeLineId = null; activeSource = ""; activeRevision = 0;
      committedLineIds.clear(); spokenLineIds.clear(); latestTextByLine.clear(); latestRevisionByLine.clear();
      displayedRevisionByLine.clear();
      if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
      if (sentenceCommitTimer) { clearTimeout(sentenceCommitTimer); sentenceCommitTimer = null; }
      audioRef.current?.pause(); audioRef.current = null;
      setAudioBlocked(false); setFailed(false);
    };
    const sound = async (text: string, token: number) => {
      if (disposed || token !== generation) return;
      const clean = stripForSpeech(text);
      if (!clean) return;
      const audio = new Audio("/api/tts?" + new URLSearchParams({ text: clean.slice(0, 1000), lang, gender: "female" }));
      audio.playbackRate = 1.2;
      audioRef.current = audio;
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { audio.pause(); resolve(); }, 60000);
        const finish = () => { clearTimeout(timer); resolve(); };
        audio.onended = finish;
        audio.onerror = () => { if (!disposed) setFailed(true); finish(); };
        audio.play().catch(() => {
          if (!disposed) setAudioBlocked(true);
          // Keep this clip until a user gesture resumes it, without overlapping later clips.
        });
      });
    };
    const speakCommittedLine = (id: string, token: number) => {
      const text = latestTextByLine.get(id);
      if (!text || spokenLineIds.has(id)) return;
      spokenLineIds.add(id);
      audioQueue = audioQueue.then(() => sound(text, token)).catch(() => {});
    };
    const finalizeCurrentSentence = () => {
      if (!activeLineId) return;
      const id = activeLineId;
      committedLineIds.add(id);
      activeLineId = null;
      activeSource = "";
      activeRevision = 0;
      sentenceCommitTimer = null;
      speakCommittedLine(id, generation);
    };
    // Cloud STT가 짧은 조각마다 붙이는 마침표는 문장 끝으로 보지 않는다.
    // 잠깐의 무음 뒤 한 번에 확정해, 화면과 TTS 모두 문장 단위로 처리한다.
    const normalizeFragment = cleanTbmTranscriptFragment;
    const appendFragment = appendTbmTranscript;
    const events = new EventSource("/api/live/events?" + new URLSearchParams({ type: "translations", siteId }));
    const checkSummary = async () => {
      const expected = observedSession;
      if (!expected || completedSession === expected || checkingSummary) return;
      checkingSummary = true;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 10000);
      try {
        const response = await fetch("/api/live/summary?" + new URLSearchParams({ sessionId: expected, siteId }), {
          cache: "no-store", signal: timeout.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const summary = matchedTbmSummary(data.summary, expected);
        if (disposed || expected !== observedSession || !summary) return;
        completedSession = expected;
        // End the live audio queue, not replay the final notice as another recording.
        generation++;
        audioRef.current?.pause();
        if (sentenceCommitTimer) { clearTimeout(sentenceCommitTimer); sentenceCommitTimer = null; }
        if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
        activeLineId = null;
        session = null;
        setActive(false); setSpeaking(false);
        callbacks.current.onSummary?.(summary);
      } catch { /* polling recovers SSE loss, backgrounding and delayed publication */ }
      finally { clearTimeout(timer); checkingSummary = false; }
    };
    events.addEventListener("tbm-summary", () => { void checkSummary(); });
    const summaryPoll = setInterval(() => { void checkSummary(); }, 3000);
    let lifecycleVersion = 0;
    events.addEventListener("broadcast-start", event => {
      lifecycleVersion++;
      try {
        const data = JSON.parse((event as MessageEvent).data);
        const id = data.session_id as string;
        reset(id?.startsWith("tbm_") ? id : null, data.started_by);
      } catch { /* ignore malformed events */ }
    });
    events.addEventListener("broadcast-stop", event => {
      lifecycleVersion++;
      try {
        if (JSON.parse((event as MessageEvent).data).session_id === session) {
          finalizeCurrentSentence();
          session = null; setActive(false); setSpeaking(false); setBroadcasterId(null); // drain already received final speech
        }
      } catch { /* ignore malformed events */ }
    });
    events.addEventListener("broadcast-speaking", event => {
      try {
        if (JSON.parse((event as MessageEvent).data).session_id !== session) return;
        setSpeaking(true); setBusy(true);
        if (speakingTimer) clearTimeout(speakingTimer);
        speakingTimer = setTimeout(() => { setSpeaking(false); setBusy(false); }, 8_000);
      } catch { /* ignore malformed events */ }
    });
    events.addEventListener("translation", event => {
      try {
        const row = JSON.parse((event as MessageEvent).data) as { id: string; session_id: string; text_ko: string };
        if (!session || row.session_id !== session || seen.has(row.id)) return;
        seen.add(row.id);
        const token = generation;
        const fragment = normalizeFragment(row.text_ko);
        if (!fragment) return;
        setBusy(true); setSpeaking(false);
        if (speakingTimer) { clearTimeout(speakingTimer); speakingTimer = null; }
        if (!activeLineId) activeLineId = `sentence_${row.id}`;
        const lineId = activeLineId;
        activeSource = appendFragment(activeSource, fragment);
        const source = activeSource;
        const revision = ++activeRevision;
        latestRevisionByLine.set(lineId, revision);
        latestTextByLine.delete(lineId);
        // 새 STT 조각은 같은 말풍선에 이어 붙이고, 누적된 문장 전체를 다시 번역한다.
        setLines(previous => {
          const existing = previous.find(line => line.id === lineId);
          if (existing) return previous.map(line => line.id === lineId ? { ...line, source, translated: lang === "ko" ? source : line.translated } : line);
          return [...previous.slice(-7), { id: lineId, source, translated: lang === "ko" ? source : undefined }];
        });
        if (sentenceCommitTimer) clearTimeout(sentenceCommitTimer);
        // 네트워크·번역 처리 간격이 1초를 넘을 수 있으므로, 짧은 STT 조각을
        // 문장으로 너무 빨리 끊지 않는다. 실제 방송 종료 시에는 즉시 확정한다.
        sentenceCommitTimer = setTimeout(finalizeCurrentSentence, 3_500);
        const translated = lang === "ko" ? Promise.resolve(source) : fetch("/api/translate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
          body: JSON.stringify({ text: source, sl: "ko", tl: lang, fast: true, pronunciation: false, useGlossary: true }),
        }).then(async response => {
          if (!response.ok) throw new Error("translation_failed");
          const data = await response.json();
          if (!data.translated) throw new Error("translation_empty");
          return String(data.translated);
        });
        void translated.then(text => {
          // 말하는 동안 새 조각이 계속 도착해도 완료된 번역은 즉시 표시한다.
          // 이전에는 최신 요청과 다른 결과를 모두 버려, 발화가 끝나야 번역이 보였다.
          if (disposed || token !== generation || revision <= (displayedRevisionByLine.get(lineId) ?? 0)) return;
          displayedRevisionByLine.set(lineId, revision);
          setLines(previous => previous.map(line => line.id === lineId ? { ...line, translated: text } : line));
          if (latestRevisionByLine.get(lineId) === revision) {
            setBusy(false);
            latestTextByLine.set(lineId, text);
            if (committedLineIds.has(lineId)) speakCommittedLine(lineId, token);
          }
        }).catch(() => {
          if (disposed || token !== generation || latestRevisionByLine.get(lineId) !== revision) return;
          setBusy(false); setFailed(true);
        });
      } catch { /* ignore malformed events */ }
    });
    events.onopen = () => {
      const version = lifecycleVersion;
      void fetch("/api/live/sessions?" + new URLSearchParams({ siteId }), { cache: "no-store", signal: abort.signal })
        .then(response => response.ok ? response.json() : null).then(data => {
          if (disposed || lifecycleVersion !== version || !data) return;
          const id = data.active ? data.session?.session_id : null;
          reset(id?.startsWith("tbm_") ? id : null, data.session?.started_by);
        }).catch(() => {});
    };
    return () => { disposed = true; generation++; clearInterval(summaryPoll); if (speakingTimer) clearTimeout(speakingTimer); if (sentenceCommitTimer) clearTimeout(sentenceCommitTimer); abort.abort(); events.close(); audioRef.current?.pause(); audioRef.current = null; };
  }, [siteId, lang]);
  if (!active) return null;

  return <div className="space-y-4" aria-label="TBM live translation">
    <div className="flex items-center justify-between gap-3">
      <p role="status" className="text-sm font-bold text-red-300">{speaking || busy ? busyLabel : ""}</p>
      <button type="button" className="shrink-0 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-black text-blue-200" aria-label={listenLabel} onClick={() => {
        void audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
      }}>🔊 {audioBlocked ? "▶" : listenLabel}</button>
    </div>
    {failed && <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">{lang === "ko" ? "일부 통역 또는 음성을 처리하지 못했습니다. 최종 TBM 내용을 확인해 주세요." : "⚠"}</p>}
    <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1" aria-live="polite">
      {lines.length === 0 && <div className="h-20 flex items-center gap-4 bg-white/5 rounded-3xl px-6 animate-pulse-soft"><div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /><span className="text-slate-400 font-bold">{busyLabel}</span></div>}
      {lines.slice(-8).map(line => <div key={line.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        {lang !== "ko" && <p className="mb-2 text-sm font-semibold text-slate-400">{line.source}</p>}
        <p className="text-2xl md:text-4xl font-black text-white leading-[1.2]">{line.translated ?? busyLabel}</p>
      </div>)}
      <div ref={transcriptEndRef} />
    </div>
    {allowQuestions && <TbmQuestionLink adminId={broadcasterId} tbmId="today" lang={lang} />}
  </div>;
}

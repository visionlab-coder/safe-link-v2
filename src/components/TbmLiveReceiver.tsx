"use client";
import { useEffect, useRef, useState } from "react";
import { stripForSpeech } from "@/utils/tts";
import { appendTbmTranscript, cleanTbmTranscriptFragment } from "@/utils/tbm-transcript";
import TbmQuestionLink from "@/components/TbmQuestionLink";
import { tbmAdminId } from "@/lib/tbm-chat";
import { matchedTbmSummary, type TbmLiveSummary } from "@/lib/tbm-live-completion";
import { joinTbmLive } from "@/utils/tbm-participation";
import { tbmLiveStateUI } from "@/lib/tbm-summary-ui";
import TbmFullTranscript from "@/components/TbmFullTranscript";

/** Live events only: never fetch or replay historical utterances. */
export default function TbmLiveReceiver({ siteId, lang, busyLabel, listenLabel, translatedLabel, originalLabel, pending = false, onActiveChange, onSession, onSummary, allowQuestions = false }: {
  siteId: string | null;
  lang: string;
  busyLabel: string;
  listenLabel: string;
  translatedLabel: string;
  originalLabel: string;
  pending?: boolean;
  onActiveChange?: (active: boolean) => void;
  onSession?: (sessionId: string) => void;
  onSummary?: (summary: TbmLiveSummary) => void;
  allowQuestions?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [lines, setLines] = useState<Array<{ id: string; source: string; translated?: string }>>([]);
  const [editedDraft, setEditedDraft] = useState<string | null>(null);
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
    let registeredSession: string | null = null;
    let registering = false;
    let draftRevision = 0;
    let checkingDraft = false;
    const register = async (id: string) => {
      if (registering || registeredSession === id) return;
      registering = true;
      try { if (await joinTbmLive(id, siteId)) registeredSession = id; }
      finally { registering = false; }
    };
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
        draftRevision = 0;
        setEditedDraft(null);
        observedSession = id;
        observation.current = { siteId, sessionId: id };
        completedSession = null;
        callbacks.current.onSession?.(id);
        void register(id);
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
    const acceptDraft = (draft: { sessionId?: string; content?: unknown; revision?: number }) => {
      if (disposed || !observedSession || draft.sessionId !== observedSession || completedSession === observedSession
          || typeof draft.content !== "string" || !draft.revision || draft.revision <= draftRevision) return;
      draftRevision = draft.revision;
      // Corrections replace the displayed document; never replay the entire corrected TBM.
      setEditedDraft(draft.content);
      generation++;
      audioRef.current?.pause();
      if (sentenceCommitTimer) { clearTimeout(sentenceCommitTimer); sentenceCommitTimer = null; }
      activeLineId = null; activeSource = ""; activeRevision = 0;
      setBusy(false); setSpeaking(false);
    };
    const checkDraft = async () => {
      const expected = observedSession;
      if (!expected || completedSession === expected || checkingDraft) return;
      checkingDraft = true;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 10000);
      try {
        const response = await fetch("/api/live/tbm-draft?" + new URLSearchParams({sessionId: expected, siteId}), {cache: "no-store", signal: timeout.signal});
        if (response.ok && observedSession === expected) {
          const data = await response.json();
          if (data.draft) acceptDraft(data.draft);
        }
      } catch { /* next poll recovers a missed edit */ }
      finally { clearTimeout(timer); checkingDraft = false; }
    };
    events.addEventListener("tbm-draft", event => {
      try { acceptDraft(JSON.parse((event as MessageEvent).data)); } catch { /* malformed */ }
    });
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
    const summaryPoll = setInterval(() => {
      if (session) void register(session);
      void checkDraft();
      void checkSummary();
    }, 3000);
    let lifecycleVersion = 0;
    events.addEventListener("broadcast-start", event => {
      lifecycleVersion++;
      try {
        const data = JSON.parse((event as MessageEvent).data);
        const id = data.session_id as string;
        reset(id?.startsWith("tbm_") ? id : null, data.started_by);
        void checkDraft();
      } catch { /* ignore malformed events */ }
    });
    events.addEventListener("broadcast-stop", event => {
      lifecycleVersion++;
      try {
        if (JSON.parse((event as MessageEvent).data).session_id === session) {
          finalizeCurrentSentence();
          session = null; setActive(false); setSpeaking(false); // retain this TBM's speaker and transcript until publication
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
          return [...previous, { id: lineId, source, translated: lang === "ko" ? source : undefined }];
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
          void checkDraft();
          if (!id && !observedSession) {
            // A reload between recording-stop and manual publication keeps the same pending session.
            void fetch("/api/live/tbm-participation?" + new URLSearchParams({ siteId }), { cache: "no-store", signal: abort.signal })
              .then(response => response.ok ? response.json() : null).then(participation => {
                if (disposed || lifecycleVersion !== version || observedSession || !participation?.attended || !participation.sessionId) return;
                observedSession = participation.sessionId;
                observation.current = { siteId, sessionId: participation.sessionId };
                callbacks.current.onSession?.(participation.sessionId);
                void checkDraft();
                void checkSummary();
              }).catch(() => {});
          }
        }).catch(() => {});
    };
    return () => { disposed = true; generation++; clearInterval(summaryPoll); if (speakingTimer) clearTimeout(speakingTimer); if (sentenceCommitTimer) clearTimeout(sentenceCommitTimer); abort.abort(); events.close(); audioRef.current?.pause(); audioRef.current = null; };
  }, [siteId, lang]);
  if (!active && !pending) return null;
  const status = tbmLiveStateUI(lang);

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="TBM live translation">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-extrabold text-slate-900">{translatedLabel}</h2>
        <span data-testid="tbm-live-state" role="status" className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{active ? status.live : status.pending}</span>
      </div>
      <button type="button" className="min-h-11 shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900" aria-label={listenLabel} onClick={() => {
        void audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
      }}>🔊 {audioBlocked ? "▶" : listenLabel}</button>
    </div>
    {failed && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{lang === "ko" ? "일부 통역 또는 음성을 처리하지 못했습니다. 최종 TBM 내용을 확인해 주세요." : "⚠"}</p>}
    {editedDraft !== null ? <div aria-live="polite" data-testid="tbm-live-edited-draft"><TbmFullTranscript text={editedDraft} lang={lang} enabled translatedLabel={translatedLabel} originalLabel={originalLabel} loadingLabel={busyLabel} /></div> : <div className="space-y-3" aria-live="polite">
      {lines.length === 0 && <div className="flex min-h-32 items-center justify-center gap-3 rounded-2xl bg-slate-50 p-5">{active && <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />}<span className="font-semibold text-slate-700">{active ? busyLabel : status.pending}</span></div>}
      {lines.map((line, index, visible) => <div key={line.id} className={`rounded-2xl p-4 ${index === visible.length - 1 ? "border border-blue-200 bg-blue-50" : "bg-slate-50"}`}>
        <p dir="auto" className="whitespace-pre-wrap break-words text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">{line.translated ?? busyLabel}</p>
      </div>)}
      {active && (speaking || busy) && lines.length > 0 && <p role="status" className="text-sm font-semibold text-slate-600">{busyLabel}</p>}
      <div ref={transcriptEndRef} />
    </div>}
    {editedDraft === null && lines.length > 0 && lang !== "ko" && <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">{originalLabel}</h3>
      <p lang="ko" className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{lines.map(line => line.source).join("\n")}</p>
    </div>}
    {allowQuestions && broadcasterId && <div className="mt-4 border-t border-slate-200 pt-4"><TbmQuestionLink adminId={broadcasterId} tbmId="today" lang={lang} /></div>}
  </section>;
}

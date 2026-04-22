'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { playPremiumAudio, VoiceGender } from '@/utils/tts';
import { useCloudSTT } from '@/hooks/useCloudSTT';

const supabase = createClient();

const LANGS: Record<string, { label: string; flag: string; stt: string }> = {
  ko: { label: '한국어', flag: '🇰🇷', stt: 'ko-KR' },
  ja: { label: '日本語', flag: '🇯🇵', stt: 'ja-JP' },
  en: { label: 'English', flag: '🇺🇸', stt: 'en-US' },
  zh: { label: '中文',    flag: '🇨🇳', stt: 'zh-CN' },
  vi: { label: 'Việt',   flag: '🇻🇳', stt: 'vi-VN' },
};

interface Message {
  id: number;
  original: string;
  translated: string;
  pronunciation: string;
  reverse_translated: string;
  mine: boolean;
  lang: string;          // sender's lang
  targetLang: string;    // receiver's lang
  time: string;
}

type ChatMode = 'conversation' | 'simultaneous';
type Phase = 'home' | 'waiting' | 'join' | 'chat' | 'solo-setup';

const RED   = '#c0392b';
const BLUE  = 'rgba(52,152,219,0.18)';
const PAGE  = {
  minHeight: '100vh', background: '#07070e', color: '#ede8e3',
  fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif",
  display: 'flex', justifyContent: 'center',
} as const;

/* ─── 재생 버튼 ─── */
function PlayBtn({ text, lang, onPlay }: { text: string; lang: string; onPlay: (t: string, l: string) => void }) {
  return (
    <button
      onClick={() => onPlay(text, lang)}
      title="다시 듣기"
      style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, color: 'rgba(255,255,255,0.45)', fontSize: 12,
        padding: '2px 6px', cursor: 'pointer', lineHeight: 1,
      }}
    >▶</button>
  );
}

/* ─── 메시지 버블 컴포넌트 ─── */
function MsgBubble({ msg, isKorean, learningMode, onPlay }: {
  msg: Message; isKorean: boolean; learningMode: boolean;
  onPlay: (text: string, lang: string) => void;
}) {
  const hasPron = isKorean && learningMode && msg.pronunciation;
  const hasRev  = isKorean && learningMode && msg.reverse_translated;

  if (msg.mine) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ maxWidth: '82%', borderRadius: '20px 20px 4px 20px', background: `linear-gradient(135deg,${RED},#7b241c)`, padding: '12px 16px', fontSize: 15, lineHeight: 1.65 }}>
          {msg.original}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{msg.translated}</span>
            <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} />
          </div>
          {(hasPron || hasRev) && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {hasPron && (
                <div style={{ fontSize: 11, color: 'rgba(100,180,255,0.8)', marginBottom: 2 }}>
                  <span style={{ opacity: 0.6 }}>발음 </span>{msg.pronunciation}
                </div>
              )}
              {hasRev && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                  <span style={{ opacity: 0.6 }}>역번역 </span>{msg.reverse_translated}
                </div>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#2e2e3e' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
      </div>
    );
  }

  /* 상대방 메시지 */
  if (isKorean) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ maxWidth: '82%', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ flex: 1 }}>{msg.original}</span>
            <PlayBtn text={msg.original} lang={msg.lang} onPlay={onPlay} />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: '#ede8e3', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{msg.translated}</span>
            <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} />
          </div>
          {(hasPron || hasRev) && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {hasPron && (
                <div style={{ fontSize: 11, color: 'rgba(100,180,255,0.75)', marginBottom: 3 }}>
                  <span style={{ opacity: 0.6 }}>발음 </span>{msg.pronunciation}
                </div>
              )}
              {hasRev && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                  <span style={{ opacity: 0.6 }}>역번역 </span>{msg.reverse_translated}
                </div>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#2e2e3e' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
      </div>
    );
  }

  /* 외국인 */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div style={{ maxWidth: '82%', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: '#ede8e3', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1 }}>{msg.translated}</span>
          <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{msg.original}</div>
      </div>
      <span style={{ fontSize: 10, color: '#2e2e3e' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
    </div>
  );
}

/* ─── 토글 스위치 컴포넌트 ─── */
function Toggle({ on, onToggle, labelOn, labelOff, color = RED }: {
  on: boolean; onToggle: () => void;
  labelOn: string; labelOff: string; color?: string;
}) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 10, cursor: 'pointer',
      background: on
        ? `linear-gradient(135deg, ${color}33, ${color}18)`
        : 'rgba(255,255,255,0.10)',
      border: `1px solid ${on ? `${color}99` : 'rgba(255,255,255,0.22)'}`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: on
        ? `0 2px 12px ${color}33, inset 0 1px 0 rgba(255,255,255,0.12)`
        : 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.3)',
      color: on ? color : 'rgba(255,255,255,0.75)',
      fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap', transition: 'all 0.2s',
    }}>
      <span style={{
        width: 26, height: 14, borderRadius: 7,
        background: on ? color : 'rgba(255,255,255,0.25)',
        position: 'relative', display: 'inline-block',
        transition: 'background 0.2s', flexShrink: 0,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
      }}>
        <span style={{
          position: 'absolute', top: 2.5, left: on ? 14 : 2.5,
          width: 9, height: 9, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          transition: 'left 0.2s',
        }} />
      </span>
      {on ? labelOn : labelOff}
    </button>
  );
}

/* ════════ 메인 컴포넌트 ════════ */
export default function TravelTalk() {
  const [phase, setPhase]             = useState<Phase>('home');
  const [myLang, setMyLang]           = useState('ko');
  const [roomCode, setRoomCode]       = useState('');
  const [inputCode, setInputCode]     = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [messages, setMessages]       = useState<Message[]>([]);
  const [travelUrl, setTravelUrl]     = useState('');
  const [partnerOnline, setPartner]   = useState(false);
  const [inputText, setInputText]     = useState('');
  const [translating, setTranslating] = useState(false);
  const [partnerLang, setPartnerLang] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled]   = useState(true);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [mode, setMode]               = useState<ChatMode>('conversation');
  const [learningMode, setLearningMode] = useState(false);
  const [myRole, setMyRole]           = useState<'host' | 'guest'>('guest');
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);

  /* ── solo mode ── */
  const [soloMode, setSoloMode]   = useState(false);
  const [soloTurn, setSoloTurn]   = useState<'mine' | 'partner'>('mine');

  const channelRef          = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);
  const travelTokenRef      = useRef<string>('');
  const travelTokenReadyRef = useRef<Promise<void>>(Promise.resolve());
  const myLangRef        = useRef(myLang);
  const ttsEnabledRef    = useRef(ttsEnabled);
  const voiceGenderRef   = useRef(voiceGender);
  const partnerLangRef   = useRef(partnerLang);
  const translatingRef    = useRef(translating);
  const audioUnlockedRef  = useRef(false);
  const learningModeRef      = useRef(learningMode);
  const modeRef              = useRef(mode);
  const partnerSpeakingRef   = useRef(false);
  const soloModeRef          = useRef(soloMode);
  const soloTurnRef          = useRef(soloTurn);

  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { voiceGenderRef.current = voiceGender; }, [voiceGender]);
  useEffect(() => { partnerLangRef.current = partnerLang; }, [partnerLang]);
  useEffect(() => { translatingRef.current = translating; }, [translating]);
  useEffect(() => { learningModeRef.current = learningMode; }, [learningMode]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { partnerSpeakingRef.current = partnerSpeaking; }, [partnerSpeaking]);
  useEffect(() => { soloModeRef.current = soloMode; }, [soloMode]);
  useEffect(() => { soloTurnRef.current = soloTurn; }, [soloTurn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
  }, []);

  useEffect(() => {
    setTravelUrl(`${window.location.origin}/travel`);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && code.length === 4) { setPendingCode(code); setPhase('join'); }
    travelTokenReadyRef.current = fetch('/api/travel/session', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.token) travelTokenRef.current = d.token; })
      .catch(() => {});
  }, []);

  /* 브라우저 자동재생 정책 우회 */
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const sil = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
      sil.volume = 0;
      sil.play().then(() => { audioUnlockedRef.current = true; }).catch(() => {});
    } catch {}
  }, []);

  const muteSTTRef      = useRef<() => void>(() => {});
  const unmuteSTTRef    = useRef<() => void>(() => {});
  const unmuteTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUnmute = useCallback((delayMs: number) => {
    if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
    unmuteTimerRef.current = setTimeout(() => {
      unmuteTimerRef.current = null;
      unmuteSTTRef.current();
    }, delayMs);
  }, []);

  const safeMute = useCallback(() => {
    if (unmuteTimerRef.current) { clearTimeout(unmuteTimerRef.current); unmuteTimerRef.current = null; }
    muteSTTRef.current();
  }, []);

  const speakTTS = useCallback((text: string, lang: string) => {
    if (!ttsEnabledRef.current || !text) {
      scheduleUnmute(0);
      return;
    }
    safeMute();
    scheduleUnmute(60000);
    playPremiumAudio(text, lang, voiceGenderRef.current, () => {
      scheduleUnmute(soloModeRef.current ? 200 : 2000);
    });
  }, [safeMute, scheduleUnmute]);

  /* ── Supabase Realtime 채널 구독 ── */
  const subscribeChannel = useCallback((code: string, myRole: 'host' | 'guest', lang: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase.channel(`travel-${code}`, {
      config: {
        presence:  { key: myRole },
        broadcast: { self: false },
      },
    });

    const handlePresenceChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state: Record<string, any[]> = ch.presenceState();
      const partnerRole = myRole === 'host' ? 'guest' : 'host';
      if (Object.keys(state).includes(partnerRole)) {
        const pd = state[partnerRole]?.[0];
        if (pd?.lang) setPartnerLang(pd.lang);
        setPartner(true);
        setPhase('chat');
      } else {
        setPartner(false);
      }
    };

    ch.on('presence', { event: 'sync'  }, handlePresenceChange)
      .on('presence', { event: 'join'  }, handlePresenceChange)
      .on('presence', { event: 'leave' }, handlePresenceChange)
      .on('broadcast', { event: 'new-message' }, ({ payload }: { payload: Message }) => {
        setPartnerSpeaking(false);
        setMessages(prev => [...prev, { ...payload, mine: false }]);
        speakTTS(payload.translated, myLangRef.current);
      })
      .on('broadcast', { event: 'speaking-start' }, () => {
        setPartnerSpeaking(true);
        if (modeRef.current === 'conversation') {
          safeMute();
          scheduleUnmute(8000);
        }
      })
      .on('broadcast', { event: 'speaking-end' }, () => {
        setPartnerSpeaking(false);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') await ch.track({ role: myRole, lang });
      });

    channelRef.current = ch;
  }, [speakTTS, safeMute, scheduleUnmute]);

  /* ── 메시지 전송 ── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || translatingRef.current) return;
    unlockAudio();
    setTranslating(true);
    setInputText('');

    const isSoloPartner = soloModeRef.current && soloTurnRef.current === 'partner';
    const sl = isSoloPartner ? (partnerLangRef.current || 'ja') : myLangRef.current;
    const tl = isSoloPartner ? myLangRef.current : (partnerLangRef.current || (sl === 'ko' ? 'ja' : 'ko'));

    if (!soloModeRef.current) {
      channelRef.current?.send({ type: 'broadcast', event: 'speaking-start', payload: {} });
    }

    try {
      let translated = '', pronunciation = '', reverse_translated = '';

      if (!travelTokenRef.current) {
        await travelTokenReadyRef.current;
        if (!travelTokenRef.current) {
          await fetch('/api/travel/session', { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (d.token) travelTokenRef.current = d.token; })
            .catch(() => {});
        }
      }
      const authHeader = { 'x-travel-token': travelTokenRef.current };

      if (learningModeRef.current && !soloModeRef.current) {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ text, sl, tl }),
        });
        ({ translated = '', pronunciation = '', reverse_translated = '' } = await res.json());
      } else {
        const res = await fetch('/api/travel/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ text, from: sl, to: tl }),
        });
        ({ translated = '' } = await res.json());
      }

      const msg: Message = {
        id: Date.now(), original: text, translated,
        pronunciation, reverse_translated,
        mine: !isSoloPartner,
        lang: sl, targetLang: tl,
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => {
        const next = [...prev, msg];
        return next.length > 200 ? next.slice(-200) : next;
      });

      if (!soloModeRef.current && translated) {
        // 2폰 모드: 채널로 브로드캐스트
        channelRef.current?.send({
          type: 'broadcast',
          event: 'new-message',
          payload: { ...msg, mine: false },
        });
        safeMute();
        scheduleUnmute(modeRef.current === 'simultaneous' ? 1500 : 3000);
      }

      if (soloModeRef.current && translated) {
        // 1폰 모드: 번역된 텍스트를 직접 TTS로 재생 (speakTTS가 내부적으로 mute 처리)
        speakTTS(translated, tl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTranslating(false);
      if (!soloModeRef.current) {
        channelRef.current?.send({ type: 'broadcast', event: 'speaking-end', payload: {} });
      }
    }
  }, [unlockAudio, safeMute, scheduleUnmute, speakTTS]);

  const handleTranscript = useCallback((text: string) => {
    // 2폰 모드에서만 파트너 발화 중 억제
    if (!soloModeRef.current && partnerSpeakingRef.current && modeRef.current === 'conversation') return;
    sendMessage(text);
  }, [sendMessage]);

  const handleSpeechStart = useCallback(() => {
    if (!soloModeRef.current) {
      channelRef.current?.send({ type: 'broadcast', event: 'speaking-start', payload: {} });
    }
  }, []);

  /* ── solo 모드 턴 전환 ──
     muteSTT 먼저 호출 → 인플라이트 청크 폐기 (race condition 방지)
     이후 toggleSTT로 중지, setSoloTurn으로 activeSttLang 업데이트
     다음 탭에서 unmuteSTT + toggleSTT로 새 언어로 시작 */
  const handleSoloSpeak = useCallback((turn: 'mine' | 'partner', isRecording: boolean, toggleSTT: () => void) => {
    if (soloTurnRef.current !== turn) {
      // 다른 사람으로 전환: 인플라이트 청크 폐기 후 중지
      muteSTTRef.current();
      if (isRecording) toggleSTT();
      setSoloTurn(turn);
      return; // 한 번 더 탭하면 새 언어로 녹음 시작
    }
    // 같은 사람: 시작 or 중지
    if (!isRecording) {
      unmuteSTTRef.current();
      toggleSTT();
    } else {
      toggleSTT();
    }
  }, []);

  /* activeSttLang: solo 모드에서 턴에 따라 STT 언어 전환 */
  const activeSttLang = (soloMode && soloTurn === 'partner')
    ? (LANGS[partnerLang || 'ja']?.stt || 'ja-JP')
    : (LANGS[myLang]?.stt || 'ko-KR');

  const { isRecording, toggle: toggleSTT, mute: muteSTT, unmute: unmuteSTT } = useCloudSTT({
    lang: activeSttLang,
    onTranscript: handleTranscript,
    onSpeechStart: handleSpeechStart,
    live: true,
    silenceDuration: soloMode ? 500 : mode === 'simultaneous' ? 800 : 1200,
  });
  useEffect(() => { muteSTTRef.current = muteSTT; }, [muteSTT]);
  useEffect(() => { unmuteSTTRef.current = unmuteSTT; }, [unmuteSTT]);

  const createRoom = useCallback(async () => {
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {}
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setMyRole('host');
    setPhase('waiting');
    subscribeChannel(code, 'host', myLang);
  }, [myLang, subscribeChannel, unlockAudio]);

  const joinRoom = useCallback((code: string, lang: string) => {
    unlockAudio();
    setRoomCode(code);
    setMyLang(lang);
    setMyRole('guest');
    setPhase('chat');
    subscribeChannel(code, 'guest', lang);
  }, [subscribeChannel, unlockAudio]);

  /* ── solo 모드 진입: 상대 언어 선택 후 바로 채팅 시작 ── */
  const enterSoloMode = useCallback((pLang: string) => {
    unlockAudio();
    setSoloMode(true);
    setPartnerLang(pLang);
    setMyRole('host');
    setPhase('chat');
  }, [unlockAudio]);

  const isKorean = myLang === 'ko';
  const isHost   = myRole === 'host';

  /* ════ HOME ════ */
  if (phase === 'home') return (
    <div style={PAGE}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 28px', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 16 }}>SAFE-LINK</p>
          <h1 style={{ fontSize: 40, fontWeight: 200, letterSpacing: -2, margin: 0, lineHeight: 1.1 }}>Travel Talk</h1>
          <p style={{ fontSize: 12, color: '#4a4a5a', marginTop: 10, letterSpacing: 2 }}>言葉の壁を越えて · 언어의 벽을 넘어서</p>
        </div>

        <p style={{ fontSize: 10, color: '#444', letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>My Language</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 32 }}>
          {Object.entries(LANGS).map(([code, info]) => (
            <button key={code} onClick={() => setMyLang(code)} style={{
              padding: '12px 4px',
              background: myLang === code ? 'rgba(192,57,43,0.14)' : 'rgba(255,255,255,0.03)',
              border: myLang === code ? '1px solid rgba(192,57,43,0.55)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, color: myLang === code ? '#e74c3c' : '#666',
              cursor: 'pointer', fontSize: 10, transition: 'all 0.18s',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{info.flag}</div>
              {info.label}
            </button>
          ))}
        </div>

        {/* 2폰 모드 */}
        <button onClick={createRoom} style={{ width: '100%', padding: 18, background: RED, border: 'none', borderRadius: 16, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          새 대화 시작 &nbsp;·&nbsp; 新しい会話を始める
        </button>

        {/* 1폰 solo 모드 */}
        <button onClick={() => setPhase('solo-setup')} style={{
          width: '100%', padding: 15, marginBottom: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}>
          📱 폰 하나로 대화 &nbsp;·&nbsp; 1台で会話
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="· · · ·" value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && joinRoom(inputCode, myLang)}
            style={{ flex: 1, padding: '15px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#ede8e3', fontSize: 26, textAlign: 'center', letterSpacing: 12, outline: 'none' }}
          />
          <button onClick={() => joinRoom(inputCode, myLang)} disabled={inputCode.length < 4} style={{ padding: '15px 22px', background: inputCode.length === 4 ? 'rgba(192,57,43,0.75)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', fontSize: 13, cursor: inputCode.length === 4 ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>입장</button>
        </div>

        <p style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#2a2a3a', lineHeight: 2.2 }}>
          앱 설치 불필요 · アプリ不要<br />브라우저만으로 즉시 연결
        </p>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input::placeholder{color:#333}`}</style>
    </div>
  );

  /* ════ SOLO SETUP: 상대방 언어 선택 ════ */
  if (phase === 'solo-setup') return (
    <div style={{ ...PAGE, alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 40 }}>SAFE-LINK · TRAVEL TALK</p>

        <div style={{ marginBottom: 40, lineHeight: 2.6 }}>
          <p style={{ fontSize: 16, color: '#ede8e3', fontWeight: 300 }}>상대방 언어를 선택하세요</p>
          <p style={{ fontSize: 14, color: '#888' }}>相手の言語を選んでください</p>
          <p style={{ fontSize: 13, color: '#666' }}>Select partner&apos;s language</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 48 }}>
          {Object.entries(LANGS)
            .filter(([code]) => code !== myLang)
            .map(([code, info]) => (
              <button key={code} onClick={() => enterSoloMode(code)} style={{
                padding: '18px 4px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16,
                color: '#ede8e3', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 32 }}>{info.flag}</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>{info.label}</span>
              </button>
            ))}
        </div>

        <button onClick={() => setPhase('home')} style={{
          fontSize: 12, color: '#444', background: 'none', border: 'none', cursor: 'pointer',
        }}>← 돌아가기</button>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  );

  /* ════ JOIN ════ */
  if (phase === 'join') return (
    <div style={{ ...PAGE, alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 40 }}>SAFE-LINK · TRAVEL TALK</p>
        <div style={{ marginBottom: 40, lineHeight: 2.6 }}>
          <p style={{ fontSize: 16, color: '#ede8e3', fontWeight: 300 }}>언어를 선택해주세요</p>
          <p style={{ fontSize: 14, color: '#888' }}>言語を選択してください</p>
          <p style={{ fontSize: 13, color: '#666' }}>Select your language</p>
          <p style={{ fontSize: 13, color: '#555' }}>请选择语言 · Chọn ngôn ngữ</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 48 }}>
          {Object.entries(LANGS).map(([code, info]) => (
            <button key={code} onClick={() => joinRoom(pendingCode, code)} style={{
              padding: '18px 4px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16,
              color: '#ede8e3', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>{info.flag}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>{info.label}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#2a2a3a' }}>국기를 누르면 즉시 연결됩니다 · タップで即接続</p>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  );

  /* ════ WAITING ════ */
  if (phase === 'waiting') {
    const qrUrl = `${travelUrl}?code=${roomCode}`;
    return (
      <div style={{ ...PAGE, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 36, maxWidth: 380 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 16 }}>SAFE-LINK · TRAVEL TALK</p>

          <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: '#e74c3c', fontWeight: 700, marginBottom: 10 }}>📷 이 화면을 상대방에게 보여주세요</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.8 }}>
              <span style={{ color: '#ccc' }}>🇯🇵 QRコードをスキャンしてください</span>
              <span style={{ color: '#ccc' }}>🇺🇸 Please scan this QR code</span>
              <span style={{ color: '#ccc' }}>🇨🇳 请用手机扫描此二维码</span>
              <span style={{ color: '#ccc' }}>🇻🇳 Vui lòng quét mã QR này</span>
            </div>
          </div>

          {travelUrl && (
            <div style={{ display: 'inline-block', background: '#fff', borderRadius: 20, padding: 18, marginBottom: 24 }}>
              <QRCodeSVG value={qrUrl} size={200} fgColor="#07070e" bgColor="#ffffff" />
            </div>
          )}
          <p style={{ fontSize: 11, color: '#3a3a4a', marginBottom: 12 }}>또는 코드로 직접 입력 · または番号を入力</p>
          <div style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.22)', borderRadius: 20, padding: '16px 40px', marginBottom: 28, display: 'inline-block' }}>
            <span style={{ fontSize: 64, fontWeight: 100, letterSpacing: 14, color: '#e74c3c' }}>{roomCode}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#444', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, display: 'inline-block', animation: 'blink 1.4s infinite' }} />
            상대방 스캔 대기 중 · 待機中
          </div>
        </div>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}*{box-sizing:border-box;margin:0;padding:0}`}</style>
      </div>
    );
  }

  /* ════ CHAT ════ */
  const pLang = partnerLang || (myLang === 'ko' ? 'ja' : 'ko');
  const isSim = !soloMode && mode === 'simultaneous';

  return (
    <div style={PAGE}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* ── 헤더 ── */}
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,15,25,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 20, flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>

          {/* 연결 상태 + 언어 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
            {soloMode ? (
              <>
                <span style={{ fontSize: 14 }}>📱</span>
                <span style={{ fontSize: 16 }}>{LANGS[myLang]?.flag}</span>
                <span style={{ fontSize: 10, color: '#333' }}>↔</span>
                <span style={{ fontSize: 16 }}>{LANGS[pLang]?.flag}</span>
                <span style={{ fontSize: 9, color: '#c0392b', letterSpacing: 2 }}>1폰</span>
              </>
            ) : (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: partnerOnline ? '#2ecc71' : '#3a3a4a', display: 'inline-block' }} />
                <span style={{ fontSize: 16 }}>{LANGS[myLang]?.flag}</span>
                <span style={{ fontSize: 10, color: '#333' }}>↔</span>
                <span style={{ fontSize: 16 }}>{LANGS[pLang]?.flag}</span>
                <span style={{ fontSize: 9, color: '#2a2a3a', letterSpacing: 3 }}>#{roomCode}</span>
              </>
            )}
          </div>

          {/* TTS 켜기/끄기 */}
          <Toggle
            on={ttsEnabled}
            onToggle={() => setTtsEnabled(v => !v)}
            labelOn="🔊"
            labelOff="🔇"
            color="#2ecc71"
          />

          {/* 남자/여자 음성 */}
          <Toggle
            on={voiceGender === 'male'}
            onToggle={() => setVoiceGender(g => g === 'female' ? 'male' : 'female')}
            labelOn="♂ 남자"
            labelOff="♀ 여자"
            color="#5dade2"
          />

          {/* 대화 / 동시통역 모드 — 2폰 호스트만 */}
          {!soloMode && isHost && (
            <Toggle
              on={isSim}
              onToggle={() => {
                const next: ChatMode = isSim ? 'conversation' : 'simultaneous';
                setMode(next);
                if (next === 'simultaneous') {
                  if (!isRecording) toggleSTT();
                } else {
                  if (isRecording) toggleSTT();
                }
              }}
              labelOn="동시통역"
              labelOff="대화"
              color={RED}
            />
          )}

          {/* 학습 모드 — 2폰 한국인 호스트만 */}
          {!soloMode && isHost && isKorean && (
            <Toggle
              on={learningMode}
              onToggle={() => setLearningMode(v => !v)}
              labelOn="학습"
              labelOff="빠른"
              color="#f39c12"
            />
          )}
        </div>

        {/* 동시통역 배너 (2폰 모드만) */}
        {isSim && (
          <div style={{ padding: '5px 14px', background: 'rgba(192,57,43,0.07)', borderBottom: '1px solid rgba(192,57,43,0.15)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRecording ? RED : '#444', animation: isRecording ? 'blink 1s infinite' : 'none', display: 'inline-block' }} />
            <span style={{ color: isRecording ? '#e74c3c' : '#555' }}>
              {isRecording ? '동시통역 중 · 同時通訳中' : '마이크 시작 중...'}
            </span>
          </div>
        )}

        {/* 상대방 발화 중 알림 (2폰 모드만) */}
        {!soloMode && partnerSpeaking && (
          <div style={{ padding: '4px 14px', background: 'rgba(46,204,113,0.07)', borderBottom: '1px solid rgba(46,204,113,0.15)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71', animation: 'blink 0.8s infinite', display: 'inline-block' }} />
            <span style={{ color: '#2ecc71' }}>
              {LANGS[pLang]?.flag} 상대방이 말하는 중 · {pLang === 'ja' ? '相手が話しています' : pLang === 'zh' ? '对方正在说话' : pLang === 'vi' ? 'Đối phương đang nói' : 'Partner speaking...'}
            </span>
          </div>
        )}

        {/* 메시지 목록 */}
        <div style={{ flex: 1, padding: '20px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#2e2e3e' }}>
              <p style={{ fontSize: 34, marginBottom: 16 }}>💬</p>
              <p style={{ fontSize: 12, lineHeight: 2.4, color: '#2e2e3e' }}>
                {soloMode
                  ? `${LANGS[myLang]?.flag} 나 → ${LANGS[pLang]?.flag} 상대 버튼을 눌러 말하세요`
                  : isSim
                    ? '말하면 자동으로 번역됩니다 · 話すと自動翻訳'
                    : '버튼을 눌러 대화를 시작하세요 · タップして話す'
                }
              </p>
              {!soloMode && isKorean && learningMode && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: BLUE, borderRadius: 12, fontSize: 11, color: 'rgba(100,180,255,0.7)', lineHeight: 2 }}>
                  한글 발음 · 역번역 자동 표시<br />
                  <span style={{ opacity: 0.6 }}>상대방 언어를 따라 읽을 수 있습니다</span>
                </div>
              )}
            </div>
          )}

          {messages.map(msg => (
            <MsgBubble key={msg.id} msg={msg} isKorean={isKorean} learningMode={!soloMode && learningMode} onPlay={speakTTS} />
          ))}

          {translating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3a3a4a', fontSize: 12 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block', animation: `dot 1s ${i * 0.2}s infinite` }} />
              ))}
              번역 중 · 翻訳中
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        <div style={{ padding: '12px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.055)', background: 'rgba(7,7,14,0.98)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
              placeholder="직접 입력 · テキスト入力"
              style={{ flex: 1, padding: '13px 15px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, color: '#ede8e3', fontSize: 14, outline: 'none' }}
            />
            <button onClick={() => sendMessage(inputText)} style={{ padding: '13px 17px', background: inputText.trim() ? RED : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 20, cursor: 'pointer' }}>↑</button>
          </div>

          {/* ── solo 1폰 모드 버튼 ── */}
          {soloMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* 내 버튼 */}
              <button
                onClick={() => handleSoloSpeak('mine', isRecording, toggleSTT)}
                style={{
                  padding: '14px 8px',
                  background: soloTurn === 'mine' && isRecording
                    ? `linear-gradient(135deg,#7b241c,${RED})`
                    : soloTurn === 'mine'
                      ? 'rgba(192,57,43,0.14)'
                      : 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(192,57,43,${soloTurn === 'mine' ? '0.7' : '0.2'})`,
                  borderRadius: 14, color: soloTurn === 'mine' ? '#fff' : '#666',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.18s',
                }}>
                <span style={{ fontSize: 20 }}>{LANGS[myLang]?.flag}</span>
                <span style={{ fontSize: 11 }}>
                  {soloTurn === 'mine' && isRecording ? '◉ 듣는 중' : '나 · 말하기'}
                </span>
              </button>

              {/* 상대 버튼 */}
              <button
                onClick={() => handleSoloSpeak('partner', isRecording, toggleSTT)}
                style={{
                  padding: '14px 8px',
                  background: soloTurn === 'partner' && isRecording
                    ? 'linear-gradient(135deg,#1a3a5c,#2471a3)'
                    : soloTurn === 'partner'
                      ? 'rgba(36,113,163,0.18)'
                      : 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(36,113,163,${soloTurn === 'partner' ? '0.7' : '0.2'})`,
                  borderRadius: 14, color: soloTurn === 'partner' ? '#fff' : '#666',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.18s',
                }}>
                <span style={{ fontSize: 20 }}>{LANGS[pLang]?.flag}</span>
                <span style={{ fontSize: 11 }}>
                  {soloTurn === 'partner' && isRecording ? '◉ 듣는 중' : `상대 · ${LANGS[pLang]?.label}`}
                </span>
              </button>
            </div>
          ) : !isSim ? (
            /* ── 2폰 대화 모드 ── */
            <button onClick={toggleSTT} style={{
              width: '100%', padding: 16,
              background: isRecording ? `linear-gradient(135deg,#7b241c,${RED})` : 'rgba(192,57,43,0.1)',
              border: `1px solid rgba(192,57,43,${isRecording ? '0.9' : '0.35'})`,
              borderRadius: 16, color: isRecording ? '#fff' : '#e74c3c',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.18s', userSelect: 'none', WebkitUserSelect: 'none',
            }}>
              <span style={{ fontSize: 20 }}>{isRecording ? '◉' : '🎙'}</span>
              {isRecording
                ? `듣는 중 · 聞いています (${voiceGender === 'female' ? '♀' : '♂'})`
                : `${LANGS[myLang]?.flag} 탭해서 말하기 · タップして話す`}
            </button>
          ) : (
            /* ── 2폰 동시통역 모드 ── */
            <button onClick={toggleSTT} style={{
              width: '100%', padding: 11,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, color: '#444', fontSize: 11, cursor: 'pointer',
            }}>
              {isRecording ? '마이크 일시 중지 · マイク一時停止' : '마이크 재시작 · マイク再開'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        input::placeholder{color:#333}
      `}</style>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { playPremiumAudio } from '@/utils/tts';
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
  mine: boolean;
  lang: string;
  time: string;
}

type ChatMode = 'conversation' | 'simultaneous';

const RED = '#c0392b';
const PAGE = {
  minHeight: '100vh', background: '#07070e', color: '#ede8e3',
  fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif",
  display: 'flex', justifyContent: 'center',
} as const;

export default function TravelTalk() {
  const [phase, setPhase]             = useState<'home' | 'waiting' | 'join' | 'chat'>('home');
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
  const [mode, setMode]               = useState<ChatMode>('conversation');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef    = useRef<any>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const myLangRef     = useRef(myLang);
  const ttsEnabledRef = useRef(ttsEnabled);
  const partnerLangRef = useRef(partnerLang);

  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { partnerLangRef.current = partnerLang; }, [partnerLang]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    setTravelUrl(`${window.location.origin}/travel`);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && code.length === 4) {
      setPendingCode(code);
      setPhase('join');
    }
  }, []);

  const speakTTS = useCallback((text: string) => {
    if (!text || !ttsEnabledRef.current) return;
    playPremiumAudio(text, myLangRef.current, 'female');
  }, []);

  /* ── Supabase Realtime 채널 구독 ── */
  const subscribeChannel = useCallback((code: string, myRole: 'host' | 'guest', lang: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const ch = supabase.channel(`travel-${code}`, {
      config: { presence: { key: myRole } },
    });

    const handlePresenceChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state: Record<string, any[]> = ch.presenceState();
      const partnerRole = myRole === 'host' ? 'guest' : 'host';
      if (Object.keys(state).includes(partnerRole)) {
        const partnerData = state[partnerRole]?.[0];
        if (partnerData?.lang) setPartnerLang(partnerData.lang);
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
        setMessages(prev => [...prev, { ...payload, mine: false }]);
        speakTTS(payload.translated);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ role: myRole, lang });
        }
      });

    channelRef.current = ch;
  }, [speakTTS]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || translating) return;
    setTranslating(true);
    setInputText('');
    const pLang = partnerLangRef.current || (myLangRef.current === 'ko' ? 'ja' : 'ko');
    try {
      const res = await fetch('/api/travel/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: myLangRef.current, to: pLang }),
      });
      const { translated } = await res.json();

      const msg: Message = {
        id: Date.now(), original: text, translated,
        mine: true, lang: myLangRef.current,
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, msg]);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'new-message',
        payload: { ...msg, mine: false },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTranslating(false);
    }
  }, [translating]);

  const createRoom = useCallback(() => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setPhase('waiting');
    subscribeChannel(code, 'host', myLang);
  }, [myLang, subscribeChannel]);

  const joinRoom = useCallback((code: string, lang: string) => {
    setRoomCode(code);
    setMyLang(lang);
    setPhase('chat');
    subscribeChannel(code, 'guest', lang);
  }, [subscribeChannel]);

  /* ── Cloud STT 훅 ── */
  const { isRecording, toggle: toggleSTT } = useCloudSTT({
    lang: LANGS[myLang]?.stt || 'ko-KR',
    onTranscript: sendMessage,
    live: true,
    silenceDuration: mode === 'simultaneous' ? 1000 : 1500,
  });

  /* 동시통역 모드: 채팅 진입 시 자동 STT 시작 */
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (phase === 'chat' && mode === 'simultaneous' && !isRecording) {
      toggleSTT();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

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

        <button onClick={createRoom} style={{ width: '100%', padding: 18, background: RED, border: 'none', borderRadius: 16, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          새 대화 시작 &nbsp;·&nbsp; 新しい会話を始める
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="· · · ·" value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && joinRoom(inputCode, myLang)}
            style={{ flex: 1, padding: '15px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#ede8e3', fontSize: 26, textAlign: 'center', letterSpacing: 12, outline: 'none' }}
          />
          <button onClick={() => joinRoom(inputCode, myLang)} style={{ padding: '15px 22px', background: inputCode.length === 4 ? 'rgba(192,57,43,0.75)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>입장</button>
        </div>

        <p style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#2a2a3a', lineHeight: 2.2 }}>
          앱 설치 불필요 · アプリ不要<br />브라우저만으로 즉시 연결
        </p>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input::placeholder{color:#333}`}</style>
    </div>
  );

  /* ════ JOIN — QR 스캔: 언어 선택 ════ */
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

  /* ════ WAITING — QR 대기 ════ */
  if (phase === 'waiting') {
    const qrUrl = `${travelUrl}?code=${roomCode}`;
    return (
      <div style={{ ...PAGE, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 36, maxWidth: 380 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 28 }}>SAFE-LINK · TRAVEL TALK</p>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 2 }}>
            상대방 폰으로 QR을 스캔해주세요<br />
            <span style={{ fontSize: 11, color: '#3a3a4a' }}>相手のスマホでQRを読み取ってください</span>
          </p>
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
  const isSim = mode === 'simultaneous';

  return (
    <div style={PAGE}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* 헤더 */}
        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.055)', background: 'rgba(7,7,14,0.96)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
          {/* 연결 상태 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: partnerOnline ? '#2ecc71' : '#3a3a4a', display: 'inline-block', transition: 'background 0.3s' }} />
            <span style={{ fontSize: 10, color: partnerOnline ? '#2ecc71' : '#3a3a4a' }}>
              {partnerOnline ? '연결됨' : '끊김'}
            </span>
          </div>

          {/* 언어 표시 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 16 }}>{LANGS[myLang]?.flag}</span>
            <span style={{ fontSize: 10, color: '#333' }}>↔</span>
            <span style={{ fontSize: 16 }}>{LANGS[pLang]?.flag}</span>
          </div>

          {/* TTS 토글 + 모드 스위치 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* TTS 켜기/끄기 */}
            <button onClick={() => setTtsEnabled(v => !v)} title={ttsEnabled ? '음성 끄기' : '음성 켜기'} style={{
              padding: '4px 8px', borderRadius: 8,
              background: ttsEnabled ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${ttsEnabled ? 'rgba(46,204,113,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: ttsEnabled ? '#2ecc71' : '#444', fontSize: 14, cursor: 'pointer', lineHeight: 1,
            }}>
              {ttsEnabled ? '🔊' : '🔇'}
            </button>

            {/* 대화 / 동시통역 모드 */}
            <button onClick={() => {
              const next: ChatMode = isSim ? 'conversation' : 'simultaneous';
              setMode(next);
              if (next === 'conversation' && isRecording) toggleSTT();
            }} style={{
              padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: isSim ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isSim ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: isSim ? '#e74c3c' : '#555', whiteSpace: 'nowrap',
            }}>
              {isSim ? '동시통역' : '대화'}
            </button>
          </div>
        </div>

        {/* 모드 안내 배너 */}
        {isSim && (
          <div style={{ padding: '6px 16px', background: 'rgba(192,57,43,0.07)', borderBottom: '1px solid rgba(192,57,43,0.15)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRecording ? RED : '#555', animation: isRecording ? 'blink 1s infinite' : 'none', display: 'inline-block' }} />
            <span style={{ color: isRecording ? '#e74c3c' : '#555' }}>
              {isRecording ? '동시통역 중 · 同時通訳中 · Interpreting...' : '마이크 시작 중...'}
            </span>
          </div>
        )}

        {/* 메시지 목록 */}
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 70, color: '#2e2e3e' }}>
              <p style={{ fontSize: 36, marginBottom: 20 }}>💬</p>
              <p style={{ fontSize: 13, lineHeight: 2.4, color: '#2e2e3e' }}>
                {isSim
                  ? '말하면 자동으로 번역됩니다\n話すと自動翻訳されます'
                  : '아래 버튼을 눌러 대화를 시작하세요\nボタンを押して話しかけてください'
                }
              </p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.mine ? 'flex-end' : 'flex-start', gap: 5 }}>
              <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: msg.mine ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: msg.mine ? `linear-gradient(135deg, ${RED}, #7b241c)` : 'rgba(255,255,255,0.07)', fontSize: 15, lineHeight: 1.65, border: msg.mine ? 'none' : '1px solid rgba(255,255,255,0.07)' }}>
                {msg.original}
              </div>
              <div style={{ maxWidth: '80%', padding: '7px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', fontSize: 13, color: '#666', fontStyle: 'italic', border: '1px solid rgba(255,255,255,0.04)' }}>
                {msg.translated}
              </div>
              <span style={{ fontSize: 10, color: '#2e2e3e' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
            </div>
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
        <div style={{ padding: '14px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.055)', background: 'rgba(7,7,14,0.98)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
              placeholder="직접 입력 · テキスト入力"
              style={{ flex: 1, padding: '13px 16px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, color: '#ede8e3', fontSize: 14, outline: 'none' }}
            />
            <button onClick={() => sendMessage(inputText)} style={{ padding: '13px 18px', background: inputText.trim() ? RED : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 20, cursor: 'pointer' }}>↑</button>
          </div>

          {/* 대화 모드: 수동 토글 마이크 버튼 */}
          {!isSim && (
            <button onClick={toggleSTT} style={{
              width: '100%', padding: 17,
              background: isRecording ? `linear-gradient(135deg, #7b241c, ${RED})` : 'rgba(192,57,43,0.1)',
              border: `1px solid rgba(192,57,43,${isRecording ? '0.9' : '0.35'})`,
              borderRadius: 16, color: isRecording ? '#fff' : '#e74c3c',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.18s', userSelect: 'none', WebkitUserSelect: 'none',
            }}>
              <span style={{ fontSize: 22 }}>{isRecording ? '◉' : '🎙'}</span>
              {isRecording ? '듣는 중 · 聞いています (탭하면 중지)' : `${LANGS[myLang]?.flag} 탭해서 말하기 · タップして話す`}
            </button>
          )}

          {/* 동시통역 모드: 중지 버튼만 */}
          {isSim && (
            <button onClick={toggleSTT} style={{
              width: '100%', padding: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, color: '#444',
              fontSize: 12, cursor: 'pointer', transition: 'all 0.18s',
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

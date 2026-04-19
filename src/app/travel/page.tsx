'use client';

import { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { QRCodeSVG } from 'qrcode.react';

const LANGS: Record<string, { label: string; flag: string; stt: string; tts: string }> = {
  ko: { label: '한국어', flag: '🇰🇷', stt: 'ko-KR', tts: 'ko-KR' },
  ja: { label: '日本語', flag: '🇯🇵', stt: 'ja-JP', tts: 'ja-JP' },
  en: { label: 'English', flag: '🇺🇸', stt: 'en-US', tts: 'en-US' },
  zh: { label: '中文',    flag: '🇨🇳', stt: 'zh-CN', tts: 'zh-CN' },
  vi: { label: 'Việt',   flag: '🇻🇳', stt: 'vi-VN', tts: 'vi-VN' },
};

interface Message {
  id: number;
  original: string;
  translated: string;
  mine: boolean;
  lang: string;
  time: string;
}

export default function TravelTalk() {
  const [phase, setPhase]           = useState<'home' | 'waiting' | 'chat'>('home');
  const [myLang, setMyLang]         = useState('ko');
  const [roomCode, setRoomCode]     = useState('');
  const [inputCode, setInputCode]   = useState('');
  const [messages, setMessages]     = useState<Message[]>([]);
  const [travelUrl, setTravelUrl]   = useState('');
  const [listening, setListening]   = useState(false);
  const [partnerOnline, setPartner] = useState(false);
  const [inputText, setInputText]   = useState('');
  const [translating, setTranslating] = useState(false);
  const [partnerLang, setPartnerLang] = useState<string | null>(null);

  const pusherRef  = useRef<Pusher | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognRef  = useRef<any>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const myLangRef  = useRef(myLang);

  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  // QR 스캔으로 진입 시 코드 자동 입장 + travelUrl 설정
  useEffect(() => {
    const origin = window.location.origin;
    setTravelUrl(`${origin}/travel`);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && code.length === 4) {
      setInputCode(code);
      setRoomCode(code);
      setPartner(true);
      setPhase('chat');
      connectPusher(code, myLang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectPusher = (code: string, lang: string) => {
    if (pusherRef.current) pusherRef.current.disconnect();

    pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    channelRef.current = pusherRef.current.subscribe(`travel-${code}`);

    channelRef.current.bind('partner-joined', (data: { lang: string }) => {
      setPartnerLang(data.lang);
      setPartner(true);
      setPhase('chat');
    });

    channelRef.current.bind('new-message', (data: Message) => {
      setMessages(prev => [...prev, { ...data, mine: false }]);
      speakTTS(data.translated, myLangRef.current);
    });

    channelRef.current.bind('partner-left', () => setPartner(false));

    fetch('/api/travel/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: code, lang }),
    });
  };

  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setPhase('waiting');
    connectPusher(code, myLang);
  };

  const joinRoom = () => {
    if (inputCode.length !== 4) return;
    setRoomCode(inputCode);
    setPartner(true);
    setPhase('chat');
    connectPusher(inputCode, myLang);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || translating) return;
    setTranslating(true);
    setInputText('');

    const targetLang = partnerLang || (myLang === 'ko' ? 'ja' : 'ko');

    try {
      const res = await fetch('/api/travel/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: myLang, to: targetLang, room: roomCode }),
      });
      const { translated } = await res.json();

      setMessages(prev => [...prev, {
        id: Date.now(), original: text, translated,
        mine: true, lang: myLang,
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setTranslating(false);
    }
  };

  const startSTT = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.\nChrome을 사용해주세요.'); return; }
    recognRef.current = new SR();
    recognRef.current.lang = LANGS[myLang].stt;
    recognRef.current.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognRef.current.onresult = (e: any) => sendMessage(e.results[0][0].transcript);
    recognRef.current.onend = () => setListening(false);
    recognRef.current.start();
    setListening(true);
  };

  const stopSTT = () => { recognRef.current?.stop(); setListening(false); };

  const speakTTS = (text: string, lang: string) => {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang]?.tts || 'ko-KR';
    window.speechSynthesis.speak(u);
  };

  const RED = '#c0392b';

  /* ── HOME ── */
  if (phase === 'home') return (
    <div style={{ minHeight: '100vh', background: '#07070e', color: '#ede8e3', fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif", display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 28px', gap: 0, minHeight: '100vh' }}>
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

        <button onClick={createRoom} style={{ width: '100%', padding: 18, background: RED, border: 'none', borderRadius: 16, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10, letterSpacing: 0.5 }}>
          새 대화 시작 &nbsp;·&nbsp; 新しい会話を始める
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="· · · ·"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            style={{ flex: 1, padding: '15px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#ede8e3', fontSize: 26, textAlign: 'center', letterSpacing: 12, outline: 'none' }}
          />
          <button onClick={joinRoom} style={{ padding: '15px 22px', background: inputCode.length === 4 ? 'rgba(192,57,43,0.75)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>입장</button>
        </div>

        <p style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#2a2a3a', lineHeight: 2.2, letterSpacing: 0.5 }}>
          앱 설치 불필요 · アプリ不要<br />브라우저만으로 즉시 연결 · ブラウザのみで即接続
        </p>
      </div>
    </div>
  );

  /* ── WAITING ── */
  if (phase === 'waiting') {
    const qrUrl = `${travelUrl}?code=${roomCode}`;
    return (
      <div style={{ minHeight: '100vh', background: '#07070e', color: '#ede8e3', fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 36, maxWidth: 380 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 32 }}>SAFE-LINK · TRAVEL TALK</p>

          {/* QR코드 */}
          <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
            QR 스캔하면 바로 연결됩니다<br />
            <span style={{ fontSize: 11, color: '#3a3a4a' }}>QRを読み取ると即接続</span>
          </p>
          {travelUrl && (
            <div style={{ display: 'inline-block', background: '#fff', borderRadius: 20, padding: 18, marginBottom: 28 }}>
              <QRCodeSVG value={qrUrl} size={180} fgColor="#07070e" bgColor="#ffffff" />
            </div>
          )}

          {/* 코드 */}
          <p style={{ fontSize: 11, color: '#444', marginBottom: 10 }}>
            또는 코드로 직접 입력 · または番号を入力
          </p>
          <div style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.22)', borderRadius: 20, padding: '20px 48px', marginBottom: 28, display: 'inline-block' }}>
            <span style={{ fontSize: 72, fontWeight: 100, letterSpacing: 16, color: '#e74c3c' }}>{roomCode}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#444', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, display: 'inline-block', animation: 'blink 1.4s infinite' }} />
            대기 중 · 待機中
          </div>
          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
        </div>
      </div>
    );
  }

  /* ── CHAT ── */
  const pLang = partnerLang || (myLang === 'ko' ? 'ja' : 'ko');

  return (
    <div style={{ minHeight: '100vh', background: '#07070e', color: '#ede8e3', fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif", display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* 헤더 */}
        <div style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.055)', background: 'rgba(7,7,14,0.96)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: partnerOnline ? '#2ecc71' : '#3a3a4a', transition: 'background 0.3s' }} />
            <span style={{ fontSize: 11, color: partnerOnline ? '#2ecc71' : '#3a3a4a' }}>
              {partnerOnline ? '연결됨 · 接続中' : '연결 끊김'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#2a2a3a', letterSpacing: 4 }}>#{roomCode}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 17 }}>{LANGS[myLang]?.flag}</span>
            <span style={{ fontSize: 11, color: '#333' }}>↔</span>
            <span style={{ fontSize: 17 }}>{LANGS[pLang]?.flag}</span>
          </div>
        </div>

        {/* 메시지 리스트 */}
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 70, color: '#2e2e3e' }}>
              <p style={{ fontSize: 36, marginBottom: 20 }}>💬</p>
              <p style={{ fontSize: 13, lineHeight: 2.4, letterSpacing: 0.5 }}>
                아래 버튼을 눌러 대화를 시작하세요<br />
                <span style={{ fontSize: 11, color: '#22222e' }}>ボタンを押して話しかけてください</span>
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.mine ? 'flex-end' : 'flex-start', gap: 5 }}>
              <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: msg.mine ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: msg.mine ? `linear-gradient(135deg, ${RED}, #7b241c)` : 'rgba(255,255,255,0.07)', fontSize: 15, lineHeight: 1.65, border: msg.mine ? 'none' : '1px solid rgba(255,255,255,0.07)' }}>
                {msg.original}
              </div>
              <div style={{ maxWidth: '80%', padding: '7px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', fontSize: 13, color: '#666', fontStyle: 'italic', letterSpacing: 0.3, border: '1px solid rgba(255,255,255,0.04)' }}>
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
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
              placeholder="직접 입력하거나 말하기를 눌러주세요"
              style={{ flex: 1, padding: '13px 16px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, color: '#ede8e3', fontSize: 14, outline: 'none' }}
            />
            <button onClick={() => sendMessage(inputText)} style={{ padding: '13px 18px', background: inputText.trim() ? RED : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 20, cursor: 'pointer', transition: 'background 0.18s' }}>↑</button>
          </div>

          <button
            onMouseDown={startSTT}
            onMouseUp={stopSTT}
            onTouchStart={startSTT}
            onTouchEnd={stopSTT}
            style={{ width: '100%', padding: 17, background: listening ? `linear-gradient(135deg, #7b241c, ${RED})` : 'rgba(192,57,43,0.1)', border: `1px solid rgba(192,57,43,${listening ? '0.9' : '0.35'})`, borderRadius: 16, color: listening ? '#fff' : '#e74c3c', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: 0.5, transition: 'all 0.18s', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <span style={{ fontSize: 22 }}>{listening ? '◉' : '🎙'}</span>
            {listening ? '듣는 중... · 聞いています' : `${LANGS[myLang]?.flag} 누르고 말하기 · 押して話す`}
          </button>
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

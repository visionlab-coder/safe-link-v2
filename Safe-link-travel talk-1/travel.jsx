import { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import Head from 'next/head';

const LANGS = {
  ko: { label: '한국어', flag: '🇰🇷', stt: 'ko-KR', tts: 'ko-KR' },
  ja: { label: '日本語', flag: '🇯🇵', stt: 'ja-JP', tts: 'ja-JP' },
  en: { label: 'English', flag: '🇺🇸', stt: 'en-US', tts: 'en-US' },
  zh: { label: '中文',    flag: '🇨🇳', stt: 'zh-CN', tts: 'zh-CN' },
  vi: { label: 'Việt',   flag: '🇻🇳', stt: 'vi-VN', tts: 'vi-VN' },
};

export default function TravelTalk() {
  const [phase, setPhase]           = useState('home');    // home|waiting|chat
  const [myLang, setMyLang]         = useState('ko');
  const [roomCode, setRoomCode]     = useState('');
  const [inputCode, setInputCode]   = useState('');
  const [messages, setMessages]     = useState([]);
  const [listening, setListening]   = useState(false);
  const [partnerOnline, setPartner] = useState(false);
  const [inputText, setInputText]   = useState('');
  const [translating, setTranslating] = useState(false);
  const [partnerLang, setPartnerLang] = useState(null);

  const pusherRef  = useRef(null);
  const channelRef = useRef(null);
  const recognRef  = useRef(null);
  const bottomRef  = useRef(null);
  const myLangRef  = useRef(myLang);

  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── Pusher 연결 ── */
  const connectPusher = (code, lang) => {
    if (pusherRef.current) pusherRef.current.disconnect();

    pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });
    channelRef.current = pusherRef.current.subscribe(`travel-${code}`);

    // 상대방 입장
    channelRef.current.bind('partner-joined', (data) => {
      setPartnerLang(data.lang);
      setPartner(true);
      setPhase('chat');
    });

    // 메시지 수신
    channelRef.current.bind('new-message', (data) => {
      setMessages(prev => [...prev, { ...data, mine: false }]);
      speakTTS(data.translated, myLangRef.current);
    });

    // 상대방 퇴장
    channelRef.current.bind('partner-left', () => setPartner(false));

    // 입장 알림
    fetch('/api/travel/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: code, lang }),
    });
  };

  /* ── 방 생성 ── */
  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setPhase('waiting');
    connectPusher(code, myLang);
  };

  /* ── 방 입장 ── */
  const joinRoom = () => {
    if (inputCode.length !== 4) return;
    setRoomCode(inputCode);
    setPartner(true);
    setPhase('chat');
    connectPusher(inputCode, myLang);
  };

  /* ── 메시지 전송 ── */
  const sendMessage = async (text) => {
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

  /* ── STT ── */
  const startSTT = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.\nChrome을 사용해주세요.'); return; }
    recognRef.current = new SR();
    recognRef.current.lang = LANGS[myLang].stt;
    recognRef.current.interimResults = false;
    recognRef.current.onresult = (e) => sendMessage(e.results[0][0].transcript);
    recognRef.current.onend = () => setListening(false);
    recognRef.current.start();
    setListening(true);
  };

  const stopSTT = () => { recognRef.current?.stop(); setListening(false); };

  /* ── TTS ── */
  const speakTTS = (text, lang) => {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang]?.tts || 'ko-KR';
    window.speechSynthesis.speak(u);
  };

  /* ── 스타일 공통 ── */
  const S = {
    page: {
      minHeight: '100vh', background: '#07070e',
      color: '#ede8e3', fontFamily: "'Noto Sans JP','Apple SD Gothic Neo',sans-serif",
      display: 'flex', justifyContent: 'center',
    },
    inner: { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
    red: '#c0392b',
  };

  /* ════════════════════════════════════
     HOME
  ════════════════════════════════════ */
  if (phase === 'home') return (
    <>
      <Head><title>SAFE-LINK · Travel Talk</title></Head>
      <div style={S.page}>
        <div style={{ ...S.inner, justifyContent: 'center', padding: '56px 28px', gap: 0 }}>

          {/* 브랜드 */}
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 10, letterSpacing: 7, color: S.red, fontWeight: 700, marginBottom: 16 }}>
              SAFE-LINK
            </p>
            <h1 style={{ fontSize: 40, fontWeight: 200, letterSpacing: -2, margin: 0, lineHeight: 1.1 }}>
              Travel Talk
            </h1>
            <p style={{ fontSize: 12, color: '#4a4a5a', marginTop: 10, letterSpacing: 2 }}>
              言葉の壁を越えて · 언어의 벽을 넘어서
            </p>
          </div>

          {/* 언어 선택 */}
          <p style={{ fontSize: 10, color: '#444', letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>
            My Language
          </p>
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

          {/* 방 만들기 */}
          <button onClick={createRoom} style={{
            width: '100%', padding: 18, background: S.red, border: 'none',
            borderRadius: 16, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 10, letterSpacing: 0.5,
          }}>
            새 대화 시작 &nbsp;·&nbsp; 新しい会話を始める
          </button>

          {/* 코드 입장 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="· · · ·"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.replace(/\D/g,'').slice(0,4))}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              style={{
                flex: 1, padding: '15px 16px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
                color: '#ede8e3', fontSize: 26, textAlign: 'center',
                letterSpacing: 12, outline: 'none',
              }}
            />
            <button onClick={joinRoom} style={{
              padding: '15px 22px',
              background: inputCode.length === 4 ? 'rgba(192,57,43,0.75)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
              color: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>입장</button>
          </div>

          <p style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#2a2a3a', lineHeight: 2.2, letterSpacing: 0.5 }}>
            앱 설치 불필요 · アプリ不要<br />
            브라우저만으로 즉시 연결 · ブラウザのみで即接続
          </p>
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════
     WAITING (코드 대기 화면)
  ════════════════════════════════════ */
  if (phase === 'waiting') return (
    <>
      <Head><title>SAFE-LINK · Travel Talk</title></Head>
      <div style={{ ...S.page, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 36, maxWidth: 380 }}>

          <p style={{ fontSize: 10, letterSpacing: 7, color: S.red, fontWeight: 700, marginBottom: 48 }}>
            SAFE-LINK · TRAVEL TALK
          </p>

          <p style={{ fontSize: 13, color: '#555', lineHeight: 2.4, marginBottom: 24 }}>
            상대방에게 이 숫자를 알려주세요<br />
            <span style={{ fontSize: 11, color: '#3a3a4a' }}>相手にこの番号を伝えてください</span>
          </p>

          {/* 코드 크게 */}
          <div style={{
            background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.22)',
            borderRadius: 28, padding: '48px 64px', marginBottom: 36, display: 'inline-block',
          }}>
            <span style={{ fontSize: 86, fontWeight: 100, letterSpacing: 20, color: '#e74c3c' }}>
              {roomCode}
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#3a3a4a', lineHeight: 2.2, marginBottom: 44 }}>
            상대방이 <strong style={{ color: '#666' }}>safe-link-v2.vercel.app/travel</strong><br />
            접속 후 위 숫자 입력 → 즉시 연결됩니다
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#444', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: S.red, display: 'inline-block', animation: 'blink 1.4s infinite' }} />
            대기 중 · 待機中
          </div>

          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════
     CHAT
  ════════════════════════════════════ */
  const pLang = partnerLang || (myLang === 'ko' ? 'ja' : 'ko');

  return (
    <>
      <Head><title>SAFE-LINK · Travel Talk #{roomCode}</title></Head>
      <div style={S.page}>
        <div style={S.inner}>

          {/* 헤더 */}
          <div style={{
            padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.055)',
            background: 'rgba(7,7,14,0.96)', backdropFilter: 'blur(20px)',
            position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: partnerOnline ? '#2ecc71' : '#3a3a4a',
                transition: 'background 0.3s',
              }} />
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
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.mine ? 'flex-end' : 'flex-start', gap: 5,
              }}>
                {/* 원문 */}
                <div style={{
                  maxWidth: '80%', padding: '13px 17px',
                  borderRadius: msg.mine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  background: msg.mine
                    ? `linear-gradient(135deg, ${S.red}, #7b241c)`
                    : 'rgba(255,255,255,0.07)',
                  fontSize: 15, lineHeight: 1.65,
                  border: msg.mine ? 'none' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  {msg.original}
                </div>
                {/* 번역문 */}
                <div style={{
                  maxWidth: '80%', padding: '7px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.025)',
                  fontSize: 13, color: '#666', fontStyle: 'italic', letterSpacing: 0.3,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  {msg.translated}
                </div>
                <span style={{ fontSize: 10, color: '#2e2e3e' }}>
                  {LANGS[msg.lang]?.flag} {msg.time}
                </span>
              </div>
            ))}

            {/* 번역 중 인디케이터 */}
            {translating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3a3a4a', fontSize: 12 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: S.red, display: 'inline-block',
                    animation: `dot 1s ${i*0.2}s infinite`,
                  }} />
                ))}
                번역 중 · 翻訳中
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력 영역 */}
          <div style={{
            padding: '14px 16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.055)',
            background: 'rgba(7,7,14,0.98)', backdropFilter: 'blur(20px)',
          }}>
            {/* 텍스트 입력 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
                placeholder={LANGS[myLang]?.stt ? '직접 입력하거나 말하기를 눌러주세요' : ''}
                style={{
                  flex: 1, padding: '13px 16px',
                  background: 'rgba(255,255,255,0.055)',
                  border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14,
                  color: '#ede8e3', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={() => sendMessage(inputText)} style={{
                padding: '13px 18px',
                background: inputText.trim() ? S.red : 'rgba(255,255,255,0.04)',
                border: 'none', borderRadius: 14, color: '#fff', fontSize: 20,
                cursor: 'pointer', transition: 'background 0.18s',
              }}>↑</button>
            </div>

            {/* 마이크 버튼 */}
            <button
              onMouseDown={startSTT}
              onMouseUp={stopSTT}
              onTouchStart={startSTT}
              onTouchEnd={stopSTT}
              style={{
                width: '100%', padding: 17,
                background: listening
                  ? `linear-gradient(135deg, #7b241c, ${S.red})`
                  : 'rgba(192,57,43,0.1)',
                border: `1px solid rgba(192,57,43,${listening ? '0.9' : '0.35'})`,
                borderRadius: 16, color: listening ? '#fff' : '#e74c3c',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                letterSpacing: 0.5, transition: 'all 0.18s',
                userSelect: 'none', WebkitUserSelect: 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>{listening ? '◉' : '🎙'}</span>
              {listening
                ? '듣는 중... · 聞いています'
                : `${LANGS[myLang]?.flag} 누르고 말하기 · 押して話す`}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        input::placeholder{color:#333}
      `}</style>
    </>
  );
}

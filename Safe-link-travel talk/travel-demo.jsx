import { useState, useEffect, useRef } from "react";

const LANGS = {
  ko: { label: "한국어", flag: "🇰🇷", placeholder: "말하기 버튼을 누르세요" },
  ja: { label: "日本語", flag: "🇯🇵", placeholder: "話すボタンを押してください" },
  en: { label: "English", flag: "🇺🇸", placeholder: "Press to speak" },
};

const DEMO_PAIRS = [
  { ko: "여기서 신주쿠까지 어떻게 가요?", ja: "新宿までどうやって行けばいいですか？" },
  { ko: "이거 얼마예요?", ja: "これはいくらですか？" },
  { ko: "화장실이 어디 있나요?", ja: "トイレはどこですか？" },
  { ko: "메뉴 추천해주세요", ja: "おすすめのメニューを教えてください" },
  { ko: "사진 찍어도 될까요?", ja: "写真を撮ってもいいですか？" },
  { ko: "감사합니다!", ja: "ありがとうございます！" },
];

const REPLY_PAIRS = [
  { ja: "次の駅で降りてください", ko: "다음 역에서 내리세요" },
  { ja: "1000円です", ko: "1000엔입니다" },
  { ja: "あちらです", ko: "저쪽입니다" },
  { ja: "ラーメンがおすすめです", ko: "라멘을 추천합니다" },
  { ja: "もちろんです！", ko: "물론이죠!" },
  { ja: "どういたしまして", ko: "천만에요" },
];

export default function TravelTalk() {
  const [phase, setPhase] = useState("home");
  const [myLang, setMyLang] = useState("ko");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [listening, setListening] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const bottomRef = useRef(null);

  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setPhase("waiting");
    setTimeout(() => { setPartnerOnline(true); setPhase("chat"); }, 2500);
  };

  const joinRoom = () => {
    if (inputCode.length !== 4) return;
    setRoomCode(inputCode);
    setPartnerOnline(true);
    setPhase("chat");
    setMyLang("ja");
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isTranslating) return;
    setIsTranslating(true);
    setInputText("");

    await new Promise(r => setTimeout(r, 700));

    const i = demoIndex % DEMO_PAIRS.length;
    const pair = DEMO_PAIRS[i];
    const translated = myLang === "ko" ? pair.ja : pair.ko;

    setMessages(prev => [...prev, {
      id: Date.now(), original: text, translated,
      mine: true, lang: myLang,
      time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    }]);
    setIsTranslating(false);
    setDemoIndex(n => n + 1);

    setTimeout(() => {
      const r = REPLY_PAIRS[i];
      const rLang = myLang === "ko" ? "ja" : "ko";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        original: r[rLang], translated: r[myLang],
        mine: false, lang: rLang,
        time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }, 1800);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const bg = "#080810";
  const red = "#c0392b";
  const partnerLang = myLang === "ko" ? "ja" : "ko";

  // HOME
  if (phase === "home") return (
    <div style={{ minHeight: "100vh", background: bg, color: "#f0ede8", fontFamily: "'Noto Sans JP',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "60px 28px", display: "flex", flexDirection: "column" }}>

        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 10, letterSpacing: 7, color: red, fontWeight: 700, marginBottom: 18 }}>SAFE-LINK</div>
          <div style={{ fontSize: 38, fontWeight: 200, letterSpacing: -1.5, marginBottom: 10 }}>Travel Talk</div>
          <div style={{ fontSize: 12, color: "#555", letterSpacing: 2 }}>言葉の壁を越えて</div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>내 언어 · My Language</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(LANGS).map(([code, info]) => (
              <button key={code} onClick={() => setMyLang(code)} style={{
                flex: 1, padding: "14px 8px",
                background: myLang === code ? "rgba(192,57,43,0.15)" : "rgba(255,255,255,0.04)",
                border: myLang === code ? "1px solid rgba(192,57,43,0.5)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14, color: myLang === code ? "#e74c3c" : "#777",
                cursor: "pointer", fontSize: 11, transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{info.flag}</div>
                {info.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={createRoom} style={{
          width: "100%", padding: 18, background: red, border: "none", borderRadius: 16,
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12,
          letterSpacing: 0.5,
        }}>
          새 대화 시작  新しい会話を始める
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="· · · ·" value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g,"").slice(0,4))}
            style={{
              flex: 1, padding: 16, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16,
              color: "#f0ede8", fontSize: 24, textAlign: "center", letterSpacing: 10, outline: "none",
            }}
          />
          <button onClick={joinRoom} style={{
            padding: "16px 22px",
            background: inputCode.length === 4 ? "rgba(192,57,43,0.7)" : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16,
            color: "#fff", fontSize: 13, cursor: "pointer",
          }}>
            입장
          </button>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 48, textAlign: "center", fontSize: 11, color: "#333", lineHeight: 2.2, letterSpacing: 0.5 }}>
          앱 설치 불필요 · アプリ不要<br/>
          브라우저만으로 즉시 연결
        </div>
      </div>
    </div>
  );

  // WAITING
  if (phase === "waiting") return (
    <div style={{ minHeight: "100vh", background: bg, color: "#f0ede8", fontFamily: "'Noto Sans JP',sans-serif", display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center", padding: 32 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 7, color: red, fontWeight: 700, marginBottom: 48 }}>SAFE-LINK · TRAVEL TALK</div>

        <div style={{ fontSize: 12, color: "#555", lineHeight: 2.2, marginBottom: 24 }}>
          상대방에게 이 코드를 알려주세요<br />
          <span style={{ fontSize: 11, color: "#444" }}>相手にこのコードを伝えてください</span>
        </div>

        <div style={{
          background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.25)",
          borderRadius: 24, padding: "44px 64px", marginBottom: 36,
          display: "inline-block",
        }}>
          <div style={{ fontSize: 80, fontWeight: 100, letterSpacing: 20, color: "#e74c3c" }}>{roomCode}</div>
        </div>

        <div style={{ fontSize: 12, color: "#444", lineHeight: 2, marginBottom: 40 }}>
          상대방이 <strong style={{ color: "#777" }}>safe-link-v2.vercel.app/travel</strong><br />
          접속 후 위 코드 입력 → 즉시 연결
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontSize: 12, color: "#555" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: red, animation: "p 1.4s infinite" }} />
          대기 중 · 待機中
        </div>
        <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      </div>
    </div>
  );

  // CHAT
  return (
    <div style={{ minHeight: "100vh", background: bg, color: "#f0ede8", fontFamily: "'Noto Sans JP',sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* 헤더 */}
        <div style={{
          padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,16,0.95)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: partnerOnline ? "#2ecc71" : "#444", transition: "background 0.3s" }} />
            <span style={{ fontSize: 11, color: partnerOnline ? "#2ecc71" : "#444" }}>
              {partnerOnline ? "연결됨 · 接続中" : "대기 중"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#333", letterSpacing: 4 }}>#{roomCode}</div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>{LANGS[myLang].flag}</span>
            <span style={{ fontSize: 11, color: "#444" }}>↔</span>
            <span style={{ fontSize: 16 }}>{LANGS[partnerLang].flag}</span>
          </div>
        </div>

        {/* 메시지 */}
        <div style={{ flex: 1, padding: "20px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>

          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 60, color: "#333" }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>💬</div>
              <div style={{ fontSize: 13, lineHeight: 2.2, letterSpacing: 0.5 }}>
                아래 버튼을 눌러 말해보세요<br />
                <span style={{ fontSize: 11, color: "#2a2a2a" }}>ボタンを押して話しかけてください</span>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.mine ? "flex-end" : "flex-start", gap: 6 }}>
              <div style={{
                maxWidth: "78%", padding: "13px 17px",
                borderRadius: msg.mine ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                background: msg.mine ? `linear-gradient(135deg, ${red}, #7b241c)` : "rgba(255,255,255,0.07)",
                fontSize: 15, lineHeight: 1.6,
                border: msg.mine ? "none" : "1px solid rgba(255,255,255,0.07)",
              }}>
                {msg.original}
              </div>
              <div style={{
                maxWidth: "78%", padding: "8px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.025)", fontSize: 13, color: "#777",
                fontStyle: "italic", letterSpacing: 0.3,
                border: "1px solid rgba(255,255,255,0.04)",
              }}>
                {msg.translated}
              </div>
              <div style={{ fontSize: 10, color: "#333" }}>
                {LANGS[msg.lang]?.flag} {msg.time}
              </div>
            </div>
          ))}

          {isTranslating && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#444", fontSize: 12 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: red,
                  animation: `b 1s ${i*0.2}s infinite`,
                }} />
              ))}
              번역 중 · 翻訳中
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 */}
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,16,0.98)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage(inputText)}
              placeholder={LANGS[myLang].placeholder}
              style={{
                flex: 1, padding: "13px 16px", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14,
                color: "#f0ede8", fontSize: 14, outline: "none",
              }}
            />
            <button onClick={() => sendMessage(inputText)} style={{
              padding: "13px 18px",
              background: inputText ? red : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 14, color: "#fff", fontSize: 18, cursor: "pointer",
              transition: "background 0.2s",
            }}>↑</button>
          </div>

          <button onClick={() => {
            const demos = ["안녕하세요!", "이거 얼마예요?", "화장실이 어디 있나요?", "사진 찍어도 될까요?", "메뉴 추천해주세요"];
            sendMessage(demos[demoIndex % demos.length]);
          }} style={{
            width: "100%", padding: 17,
            background: listening ? `linear-gradient(135deg, #7b241c, ${red})` : `rgba(192,57,43,0.1)`,
            border: `1px solid rgba(192,57,43,${listening ? "0.8" : "0.35"})`,
            borderRadius: 14, color: listening ? "#fff" : "#e74c3c",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            letterSpacing: 0.5, transition: "all 0.2s",
          }}>
            <span style={{ fontSize: 22 }}>{listening ? "◉" : "🎙"}</span>
            {listening ? "듣는 중 · 聞いています..." : `${LANGS[myLang].flag} 눌러서 말하기 · タップして話す`}
          </button>
        </div>
      </div>
      <style>{`@keyframes b{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:0}`}</style>
    </div>
  );
}

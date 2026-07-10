import { useState, useEffect, useRef } from "react";

const LANGS = {
  ko: { label: "한국어", flag: "🇰🇷", placeholder: "말하기 버튼을 누르세요" },
  ja: { label: "日本語", flag: "🇯🇵", placeholder: "話すボタンを押してください" },
  en: { label: "English", flag: "🇺🇸", placeholder: "Press to speak" },
  zh: { label: "中文",    flag: "🇨🇳", placeholder: "按下说话按钮" },
  vi: { label: "Tiếng Việt", flag: "🇻🇳", placeholder: "Nhấn để nói" },
};

const DEMO_PAIRS = [
  { ko: "여기서 신주쿠까지 어떻게 가요?", ja: "新宿までどうやって行けばいいですか？" },
  { ko: "이거 얼마예요?", ja: "これはいくらですか？" },
  { ko: "화장실이 어디 있나요?", ja: "トイレはどこですか？" },
  { ko: "메뉴 추천해주세요", ja: "おすすめのメニューを教えてください" },
  { ko: "사진 찍어도 될까요?", ja: "写真を撮ってもいいですか？" },
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
  const [demoMode, setDemoMode] = useState(true);
  const [demoIndex, setDemoIndex] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setPhase("waiting");
    setTimeout(() => {
      setPartnerOnline(true);
      setPhase("chat");
    }, 2000);
  };

  const joinRoom = () => {
    if (inputCode.length !== 4) return;
    setRoomCode(inputCode);
    setPartnerOnline(true);
    setPhase("chat");
    setMyLang("ja");
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    setIsTranslating(true);

    const targetLang = myLang === "ko" ? "ja" : "ko";

    // 데모 번역 (실제 배포 시 API 호출로 교체)
    await new Promise(r => setTimeout(r, 600));
    const pair = DEMO_PAIRS[demoIndex % DEMO_PAIRS.length];
    const translated = myLang === "ko" ? pair.ja : pair.ko;
    setDemoIndex(i => i + 1);

    const msg = {
      id: Date.now(),
      original: text,
      translated,
      mine: true,
      lang: myLang,
      time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, msg]);
    setIsTranslating(false);
    setInputText("");

    // 상대방 응답 시뮬레이션
    if (demoMode) {
      setTimeout(() => {
        const replyPair = DEMO_PAIRS[(demoIndex + 1) % DEMO_PAIRS.length];
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          original: myLang === "ko" ? replyPair.ja : replyPair.ko,
          translated: myLang === "ko" ? replyPair.ko : replyPair.ja,
          mine: false,
          lang: myLang === "ko" ? "ja" : "ko",
          time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
        }]);
      }, 1800);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const styles = {
    wrap: {
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Noto Sans JP', 'Apple SD Gothic Neo', sans-serif",
      color: "#f0ede8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },
    noise: {
      position: "fixed",
      inset: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
      pointerEvents: "none",
      zIndex: 0,
    },
    inner: {
      width: "100%",
      maxWidth: 420,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      zIndex: 1,
    },
  };

  // ── HOME ──────────────────────────────────────────
  if (phase === "home") return (
    <div style={styles.wrap}>
      <div style={styles.noise} />
      <div style={{ ...styles.inner, justifyContent: "center", alignItems: "center", padding: "40px 24px", gap: 0 }}>

        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "#c0392b", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
            SAFE-LINK
          </div>
          <div style={{ fontSize: 36, fontWeight: 300, letterSpacing: -1, lineHeight: 1.2, marginBottom: 8 }}>
            Travel Talk
          </div>
          <div style={{ fontSize: 13, color: "#888", letterSpacing: 1 }}>
            言葉の壁を越えて · 언어의 벽을 넘어서
          </div>
        </div>

        {/* 내 언어 선택 */}
        <div style={{ width: "100%", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
            My Language
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {Object.entries(LANGS).slice(0, 3).map(([code, info]) => (
              <button key={code} onClick={() => setMyLang(code)} style={{
                background: myLang === code ? "rgba(192,57,43,0.15)" : "rgba(255,255,255,0.04)",
                border: myLang === code ? "1px solid rgba(192,57,43,0.6)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px 8px",
                color: myLang === code ? "#e74c3c" : "#aaa",
                cursor: "pointer",
                fontSize: 12,
                transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{info.flag}</div>
                {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* 방 만들기 */}
        <button onClick={createRoom} style={{
          width: "100%",
          padding: "18px",
          background: "#c0392b",
          border: "none",
          borderRadius: 16,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 12,
          letterSpacing: 0.5,
        }}>
          새 대화 시작 · 新しい会話
        </button>

        {/* 코드 입장 */}
        <div style={{ width: "100%", display: "flex", gap: 8 }}>
          <input
            placeholder="4자리 코드 입력"
            value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{
              flex: 1,
              padding: "16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              color: "#f0ede8",
              fontSize: 20,
              textAlign: "center",
              letterSpacing: 8,
              outline: "none",
            }}
          />
          <button onClick={joinRoom} style={{
            padding: "16px 20px",
            background: inputCode.length === 4 ? "rgba(192,57,43,0.8)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            입장
          </button>
        </div>

        <div style={{ marginTop: 48, fontSize: 11, color: "#444", textAlign: "center", lineHeight: 2, letterSpacing: 0.5 }}>
          앱 설치 불필요 · アプリ不要<br />
          브라우저만으로 연결 · ブラウザのみで接続
        </div>
      </div>
    </div>
  );

  // ── WAITING ───────────────────────────────────────
  if (phase === "waiting") return (
    <div style={styles.wrap}>
      <div style={styles.noise} />
      <div style={{ ...styles.inner, justifyContent: "center", alignItems: "center", padding: 40, textAlign: "center" }}>

        <div style={{ fontSize: 11, letterSpacing: 6, color: "#c0392b", fontWeight: 700, marginBottom: 40, textTransform: "uppercase" }}>
          SAFE-LINK · Travel Talk
        </div>

        <div style={{ fontSize: 13, color: "#666", letterSpacing: 1, marginBottom: 16 }}>
          상대방에게 이 코드를 알려주세요<br />
          <span style={{ color: "#888", fontSize: 11 }}>相手にこのコードを教えてください</span>
        </div>

        {/* 코드 크게 표시 */}
        <div style={{
          background: "rgba(192,57,43,0.08)",
          border: "1px solid rgba(192,57,43,0.3)",
          borderRadius: 24,
          padding: "40px 60px",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 72, fontWeight: 200, letterSpacing: 16, color: "#e74c3c" }}>
            {roomCode}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#555", marginBottom: 40, lineHeight: 2 }}>
          상대방이 <strong style={{ color: "#aaa" }}>safe-link-v2.vercel.app/travel</strong> 에<br />
          접속해서 위 코드를 입력하면 연결됩니다
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666", fontSize: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#c0392b",
            animation: "pulse 1.5s infinite",
          }} />
          상대방 대기 중 · 相手を待っています
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>
      </div>
    </div>
  );

  // ── CHAT ─────────────────────────────────────────
  const partnerLangCode = myLang === "ko" ? "ja" : "ko";

  return (
    <div style={styles.wrap}>
      <div style={styles.noise} />
      <div style={{ ...styles.inner }}>

        {/* 상단 바 */}
        <div style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,15,0.9)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: partnerOnline ? "#2ecc71" : "#555" }} />
              <span style={{ fontSize: 12, color: partnerOnline ? "#2ecc71" : "#555" }}>
                {partnerOnline ? "연결됨" : "대기 중"}
              </span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#444", letterSpacing: 3 }}>
            #{roomCode}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ fontSize: 18 }}>{LANGS[myLang].flag}</span>
            <span style={{ fontSize: 12, color: "#555", alignSelf: "center" }}>↔</span>
            <span style={{ fontSize: 18 }}>{LANGS[partnerLangCode].flag}</span>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div style={{
          flex: 1,
          padding: "20px 16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 0,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 60, color: "#444" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>💬</div>
              <div style={{ fontSize: 13, lineHeight: 2, letterSpacing: 0.5 }}>
                말하기 버튼을 눌러 대화를 시작하세요<br />
                <span style={{ fontSize: 11, color: "#333" }}>
                  話すボタンを押して会話を始めましょう
                </span>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.mine ? "flex-end" : "flex-start",
              gap: 4,
            }}>
              {/* 원문 */}
              <div style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: msg.mine ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                background: msg.mine
                  ? "linear-gradient(135deg, #c0392b, #922b21)"
                  : "rgba(255,255,255,0.08)",
                fontSize: 15,
                lineHeight: 1.5,
                color: "#f0ede8",
                border: msg.mine ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
                {msg.original}
              </div>

              {/* 번역문 */}
              <div style={{
                maxWidth: "80%",
                padding: "8px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                fontSize: 13,
                color: "#888",
                fontStyle: "italic",
                letterSpacing: 0.3,
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                {msg.translated}
              </div>

              <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                {LANGS[msg.lang]?.flag} {msg.time}
              </div>
            </div>
          ))}

          {isTranslating && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 12 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#c0392b",
                    animation: `bounce 1s ${i*0.2}s infinite`,
                  }} />
                ))}
              </div>
              번역 중...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 하단 입력 */}
        <div style={{
          padding: "16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,15,0.95)",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage(inputText)}
              placeholder={LANGS[myLang].placeholder}
              style={{
                flex: 1,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                color: "#f0ede8",
                fontSize: 15,
                outline: "none",
              }}
            />
            <button onClick={() => sendMessage(inputText)} style={{
              padding: "14px 18px",
              background: inputText ? "#c0392b" : "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: 14,
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}>
              ↑
            </button>
          </div>

          {/* 마이크 버튼 */}
          <button onClick={() => {
            // Web Speech API - 실제 배포 시 활성화
            // startListening();
            // 데모용 예시 문장
            const demo = ["안녕하세요!", "어디에 있어요?", "감사합니다!", "이거 주세요"];
            sendMessage(demo[Math.floor(Math.random() * demo.length)]);
          }} style={{
            width: "100%",
            padding: "16px",
            background: listening
              ? "linear-gradient(135deg, #922b21, #c0392b)"
              : "rgba(192,57,43,0.12)",
            border: "1px solid rgba(192,57,43,0.4)",
            borderRadius: 14,
            color: listening ? "#fff" : "#e74c3c",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            letterSpacing: 1,
            transition: "all 0.2s",
          }}>
            <span style={{ fontSize: 20 }}>{listening ? "●" : "🎙"}</span>
            {listening ? "듣는 중..." : `${LANGS[myLang].flag} 눌러서 말하기 · タップして話す`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-4px)}
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  );
}

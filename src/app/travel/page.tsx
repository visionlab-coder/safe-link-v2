'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { VoiceGender } from '@/utils/tts';
import { FreeTalkAudio } from '@/utils/free-talk-audio';
import { ensureFreeTalkSession, freeTalkRequest } from '@/utils/free-talk-client';
import { useCloudSTT } from '@/hooks/useCloudSTT';
import { useDisplayLanguage } from '@/hooks/useDisplayLanguage';

const LANGS: Record<string, { label: string; flag: string; stt: string }> = {
  ko: { label: '한국어', flag: '🇰🇷', stt: 'ko-KR' },
  ja: { label: '日本語', flag: '🇯🇵', stt: 'ja-JP' },
  en: { label: 'English', flag: '🇺🇸', stt: 'en-US' },
  zh: { label: '中文',    flag: '🇨🇳', stt: 'zh-CN' },
  vi: { label: 'Việt',   flag: '🇻🇳', stt: 'vi-VN' },
};

const TRAVEL_UI = {
  ja: { bridge: '言葉の壁を越えて', myLanguage: '自分の言語', start: '新しい会話', solo: '1台のスマホで会話', enter: '参加', noInstall: 'アプリ不要、ブラウザーで接続', partnerLanguage: '相手の言語を選択', selectLanguage: '言語を選択してください', back: '← 戻る', tapFlag: '国旗をタップして接続', showQr: '相手にこの画面を見せてください', codeEntry: 'またはコードを入力', waiting: '相手の参加を待っています', male: '♂ 男性', female: '♀ 女性', simultaneous: '同時通訳', conversation: '会話', learning: '学習', quick: 'クイック', interpreting: '同時通訳中', microphoneStarting: 'マイクを起動中…', partnerSpeaking: '相手が話しています', startConversation: 'ボタンを押して会話を開始', autoTranslate: '話すと自動翻訳されます', learningHint: '韓国語の発音表記と逆翻訳を表示', learningSub: '相手の言語を読み上げてみましょう', translating: '翻訳中', textInput: 'メッセージ入力', listening: '◉ 聞き取り中', meSpeak: '自分 · 話す', partner: '相手', tapToSpeak: 'タップして話す', pauseMic: 'マイク停止', restartMic: 'マイク再開', replay: '再生', pronunciation: '発音', reverseTranslation: '逆翻訳' },
  ko: { bridge: '언어의 벽을 넘어서', myLanguage: '내 언어', start: '새 대화 시작', solo: '폰 하나로 대화', enter: '입장', noInstall: '앱 설치 없이 브라우저만으로 바로 연결', partnerLanguage: '상대방 언어를 선택하세요', selectLanguage: '언어를 선택해주세요', back: '← 돌아가기', tapFlag: '국기를 누르면 바로 연결됩니다', showQr: '이 화면을 상대방에게 보여주세요', codeEntry: '또는 코드로 직접 입력', waiting: '상대방 스캔 대기 중', male: '♂ 남성', female: '♀ 여성', simultaneous: '동시 통역', conversation: '대화', learning: '학습', quick: '빠른', interpreting: '동시 통역 중', microphoneStarting: '마이크를 시작하는 중…', partnerSpeaking: '상대방이 말하는 중', startConversation: '버튼을 눌러 대화를 시작하세요', autoTranslate: '말하면 자동으로 번역됩니다', learningHint: '한글 발음과 역번역을 표시합니다', learningSub: '상대방 언어를 따라 읽을 수 있습니다', translating: '번역 중', textInput: '직접 입력', listening: '◉ 듣는 중', meSpeak: '나 · 말하기', partner: '상대', tapToSpeak: '탭해서 말하기', pauseMic: '마이크 일시 중지', restartMic: '마이크 재시작', replay: '다시 듣기', pronunciation: '발음', reverseTranslation: '역번역' },
  en: { bridge: 'Beyond language barriers', myLanguage: 'My language', start: 'Start a conversation', solo: 'One-phone conversation', enter: 'Join', noInstall: 'Connect instantly in your browser — no app required', partnerLanguage: "Select your partner's language", selectLanguage: 'Select your language', back: '← Back', tapFlag: 'Tap a flag to connect immediately', showQr: 'Show this screen to your partner', codeEntry: 'Or enter the code directly', waiting: 'Waiting for your partner to scan', male: '♂ Male', female: '♀ Female', simultaneous: 'Simultaneous', conversation: 'Conversation', learning: 'Learning', quick: 'Quick', interpreting: 'Simultaneous interpreting', microphoneStarting: 'Starting microphone…', partnerSpeaking: 'Partner is speaking', startConversation: 'Tap the button to start a conversation', autoTranslate: 'Speak to translate automatically', learningHint: 'Korean pronunciation and back-translation are shown', learningSub: "You can read along in your partner's language", translating: 'Translating', textInput: 'Type a message', listening: '◉ Listening', meSpeak: 'Me · Speak', partner: 'Partner', tapToSpeak: 'Tap to speak', pauseMic: 'Pause microphone', restartMic: 'Restart microphone', replay: 'Play again', pronunciation: 'Pronunciation', reverseTranslation: 'Back translation' },
  zh: { bridge: '跨越语言障碍', myLanguage: '我的语言', start: '开始对话', solo: '单手机对话', enter: '进入', noInstall: '无需安装应用，直接在浏览器连接', partnerLanguage: '请选择对方语言', selectLanguage: '请选择您的语言', back: '← 返回', tapFlag: '点击国旗即可连接', showQr: '请向对方展示此页面', codeEntry: '或直接输入代码', waiting: '等待对方扫描', male: '♂ 男', female: '♀ 女', simultaneous: '同声传译', conversation: '对话', learning: '学习', quick: '快速', interpreting: '同声传译中', microphoneStarting: '正在启动麦克风…', partnerSpeaking: '对方正在说话', startConversation: '点击按钮开始对话', autoTranslate: '说话即可自动翻译', learningHint: '显示韩语发音和回译', learningSub: '可跟读对方语言', translating: '正在翻译', textInput: '直接输入', listening: '◉ 聆听中', meSpeak: '我 · 说话', partner: '对方', tapToSpeak: '点击说话', pauseMic: '暂停麦克风', restartMic: '重新启动麦克风', replay: '再次播放', pronunciation: '发音', reverseTranslation: '回译' },
  vi: { bridge: 'Vượt qua rào cản ngôn ngữ', myLanguage: 'Ngôn ngữ của tôi', start: 'Bắt đầu trò chuyện', solo: 'Trò chuyện bằng một điện thoại', enter: 'Tham gia', noInstall: 'Kết nối ngay trên trình duyệt, không cần cài ứng dụng', partnerLanguage: 'Chọn ngôn ngữ của đối tác', selectLanguage: 'Chọn ngôn ngữ của bạn', back: '← Quay lại', tapFlag: 'Chạm vào cờ để kết nối ngay', showQr: 'Hãy cho đối tác xem màn hình này', codeEntry: 'Hoặc nhập mã trực tiếp', waiting: 'Đang chờ đối tác quét mã', male: '♂ Nam', female: '♀ Nữ', simultaneous: 'Phiên dịch đồng thời', conversation: 'Hội thoại', learning: 'Học tập', quick: 'Nhanh', interpreting: 'Đang phiên dịch đồng thời', microphoneStarting: 'Đang khởi động micrô…', partnerSpeaking: 'Đối tác đang nói', startConversation: 'Nhấn nút để bắt đầu trò chuyện', autoTranslate: 'Nói để dịch tự động', learningHint: 'Hiển thị phát âm tiếng Hàn và dịch ngược', learningSub: 'Bạn có thể đọc theo ngôn ngữ của đối tác', translating: 'Đang dịch', textInput: 'Nhập trực tiếp', listening: '◉ Đang nghe', meSpeak: 'Tôi · Nói', partner: 'Đối tác', tapToSpeak: 'Chạm để nói', pauseMic: 'Tạm dừng micrô', restartMic: 'Khởi động lại micrô', replay: 'Phát lại', pronunciation: 'Phát âm', reverseTranslation: 'Dịch ngược' },
  ru: { bridge: 'Без языковых барьеров', myLanguage: 'Мой язык', start: 'Начать разговор', solo: 'Разговор на одном телефоне', enter: 'Войти', noInstall: 'Подключайтесь сразу в браузере — приложение не требуется', partnerLanguage: 'Выберите язык собеседника', selectLanguage: 'Выберите ваш язык', back: '← Назад', tapFlag: 'Нажмите на флаг для подключения', showQr: 'Покажите этот экран собеседнику', codeEntry: 'Или введите код вручную', waiting: 'Ожидание сканирования собеседником', male: '♂ Мужской', female: '♀ Женский', simultaneous: 'Синхронный перевод', conversation: 'Диалог', learning: 'Обучение', quick: 'Быстро', interpreting: 'Идёт синхронный перевод', microphoneStarting: 'Запуск микрофона…', partnerSpeaking: 'Собеседник говорит', startConversation: 'Нажмите кнопку, чтобы начать разговор', autoTranslate: 'Говорите для автоматического перевода', learningHint: 'Показываются корейское произношение и обратный перевод', learningSub: 'Можно повторять за языком собеседника', translating: 'Перевод', textInput: 'Введите сообщение', listening: '◉ Слушаю', meSpeak: 'Я · Говорить', partner: 'Собеседник', tapToSpeak: 'Нажмите, чтобы говорить', pauseMic: 'Приостановить микрофон', restartMic: 'Перезапустить микрофон', replay: 'Повторить', pronunciation: 'Произношение', reverseTranslation: 'Обратный перевод' },
} as const;

type TravelUi = (typeof TRAVEL_UI)[keyof typeof TRAVEL_UI];

const ERROR_UI: Record<string, { retry: string; limit: string; room: string; mic: string }> = {
  ko: { retry:'연결을 확인하고 다시 시도해 주세요. 이용 시간이 만료됐다면 새로고침해 주세요.', limit:'잠시 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', room:'대화방이 만료되었거나 이미 다른 상대방이 참여 중입니다. 코드를 확인해 주세요.', mic:'마이크 사용 권한을 허용해 주세요.' },
  en: { retry:'Check your connection and retry. Refresh if your session has expired.', limit:'Usage limit reached. Please try again later.', room:'This room has expired or already has a partner. Check the code.', mic:'Please allow microphone access.' },
  ja: { retry:'接続を確認して再試行してください。期限切れの場合はページを更新してください。', limit:'利用上限に達しました。しばらくしてから再試行してください。', room:'ルームの期限切れ、または相手が参加済みです。コードを確認してください。', mic:'マイクの使用を許可してください。' },
  zh: { retry:'请检查连接后重试。会话过期时请刷新页面。', limit:'已达到使用上限，请稍后重试。', room:'房间已过期或已有其他参与者，请检查代码。', mic:'请允许使用麦克风。' },
  vi: { retry:'Kiểm tra kết nối và thử lại. Tải lại trang nếu phiên đã hết hạn.', limit:'Đã đạt giới hạn sử dụng. Vui lòng thử lại sau.', room:'Phòng đã hết hạn hoặc đã có người tham gia. Hãy kiểm tra mã.', mic:'Vui lòng cho phép sử dụng micrô.' },
};

interface Message {
  id: number;
  original: string;
  rawOriginal?: string;
  translated: string;
  pronunciation: string;
  reverse_translated: string;
  mine: boolean;
  lang: string;          // sender's lang
  targetLang: string;    // receiver's lang
  time: string;
}

type LocalChannel = {
  send: (args: { type: string; event: string; payload: unknown }) => Promise<void>;
};

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
function PlayBtn({ text, lang, onPlay, label }: { text: string; lang: string; onPlay: (t: string, l: string) => void; label: string }) {
  return (
    <button
      onClick={() => onPlay(text, lang)}
      title={label}
      style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, color: '#b7c2d4', fontSize: 12,
        padding: '2px 6px', cursor: 'pointer', lineHeight: 1,
      }}
    >▶</button>
  );
}

/* ─── 메시지 버블 컴포넌트 ─── */
function MsgBubble({ msg, isKorean, learningMode, onPlay, ui }: {
  msg: Message; isKorean: boolean; learningMode: boolean;
  onPlay: (text: string, lang: string) => void;
  ui: TravelUi;
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
            <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} label={ui.replay} />
          </div>
          {(hasPron || hasRev) && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {hasPron && (
                <div style={{ fontSize: 11, color: 'rgba(100,180,255,0.8)', marginBottom: 2 }}>
                  <span style={{ opacity: 0.6 }}>{ui.pronunciation} </span>{msg.pronunciation}
                </div>
              )}
              {hasRev && (
                <div style={{ fontSize: 11, color: '#b7c2d4', fontStyle: 'italic' }}>
                  <span style={{ opacity: 0.6 }}>{ui.reverseTranslation} </span>{msg.reverse_translated}
                </div>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#aebbd0' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
      </div>
    );
  }

  /* 상대방 메시지 */
  if (isKorean) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ maxWidth: '82%', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: '#b7c2d4', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ flex: 1 }}>{msg.original}</span>
            <PlayBtn text={msg.original} lang={msg.lang} onPlay={onPlay} label={ui.replay} />
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: '#ede8e3', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{msg.translated}</span>
            <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} label={ui.replay} />
          </div>
          {(hasPron || hasRev) && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {hasPron && (
                <div style={{ fontSize: 11, color: 'rgba(100,180,255,0.75)', marginBottom: 3 }}>
                  <span style={{ opacity: 0.6 }}>{ui.pronunciation} </span>{msg.pronunciation}
                </div>
              )}
              {hasRev && (
                <div style={{ fontSize: 11, color: '#b7c2d4', fontStyle: 'italic' }}>
                  <span style={{ opacity: 0.6 }}>{ui.reverseTranslation} </span>{msg.reverse_translated}
                </div>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#aebbd0' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
      </div>
    );
  }

  /* 외국인 */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div style={{ maxWidth: '82%', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: '#ede8e3', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1 }}>{msg.translated}</span>
          <PlayBtn text={msg.translated} lang={msg.targetLang} onPlay={onPlay} label={ui.replay} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#b7c2d4' }}>{msg.original}</div>
      </div>
      <span style={{ fontSize: 10, color: '#aebbd0' }}>{LANGS[msg.lang]?.flag} {msg.time}</span>
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
  const displayLanguage = useDisplayLanguage();
  const [phase, setPhase]             = useState<Phase>('home');
  const [myLang, setMyLang]           = useState('ko');
  const ui = TRAVEL_UI[myLang as keyof typeof TRAVEL_UI] || TRAVEL_UI.en;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const reportError = useCallback((cause?: unknown) => setError(cause instanceof Error ? cause.message : String(cause || 'retry')), []);
  const errorUi = ERROR_UI[myLang] || ERROR_UI.en;
  const errorMessage = error === 'voice_turn_too_long'
    ? (myLang === 'ko' ? '말씀하신 내용이 2,000자를 넘었습니다. 입력창에 보존했으니 줄여서 전송해 주세요.' : 'The transcript exceeds 2,000 characters. It is preserved in the input; shorten it before sending.')
    : error.includes('429') ? errorUi.limit : error.includes('409') ? errorUi.room : error === 'mic_denied' ? errorUi.mic : errorUi.retry;
  const notice = error ? <div role="alert" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 100, padding: 16, background: '#fff3cd', color: '#704500', borderRadius: 12 }}>{errorMessage}<button aria-label="Close" onClick={() => setError('')} style={{ padding: 8 }}>×</button></div> : null;
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
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceBusyRef = useRef(false);
  // Speech recognition may stream chunks; a conversation turn is sent only on stop.
  const voiceTurnRef = useRef<{ active: boolean; parts: string[] }>({ active: false, parts: [] });

  const channelRef          = useRef<LocalChannel | null>(null);
  const eventSourceRef      = useRef<EventSource | null>(null);
  const clientIdRef         = useRef('host');
  const bottomRef           = useRef<HTMLDivElement>(null);
  const myLangRef        = useRef(myLang);
  const ttsEnabledRef    = useRef(ttsEnabled);
  const voiceGenderRef   = useRef(voiceGender);
  const partnerLangRef   = useRef(partnerLang);
  const translatingRef    = useRef(translating);
  const audioPlayerRef = useRef<FreeTalkAudio | null>(null);
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
    if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
    eventSourceRef.current?.close();
    audioPlayerRef.current?.cancel();
  }, []);

  useEffect(() => {
    setTravelUrl(`${window.location.origin}/free-talk`);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && /^\d{8}$/.test(code)) { setPendingCode(code); setPhase('join'); }
    const selected = params.get('lang') || displayLanguage;
    setMyLang(LANGS[selected] ? selected : selected === 'jp' ? 'ja' : 'en');
    void ensureFreeTalkSession().then(() => setReady(true)).catch(reportError);
  }, [displayLanguage, reportError]);

  /* 브라우저 자동재생 정책 우회 */
  const unlockAudio = useCallback(() => {
    if (!audioPlayerRef.current) audioPlayerRef.current = new FreeTalkAudio();
    audioPlayerRef.current.unlock();
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
    // The queued audio player has bounded fetch/playback timeouts and always releases on idle.
    if (!audioPlayerRef.current) audioPlayerRef.current = new FreeTalkAudio();
    audioPlayerRef.current.speak(text, lang, voiceGenderRef.current, () => {
      scheduleUnmute(2000);
    }, reportError);
  }, [safeMute, scheduleUnmute, reportError]);

  /* ── Spring SSE 채널: 2폰 입장·메시지·발화 상태 동기화 ── */
  const subscribeChannel = useCallback((code: string, myRole: 'host' | 'guest') => {
    eventSourceRef.current?.close();
    void (async () => {
      await ensureFreeTalkSession();
      const events = new EventSource(`/api/free-talk/events?room=${encodeURIComponent(code)}`);
      eventSourceRef.current = events;
      let reconnectFailures=0;
      events.addEventListener('connected', () => { reconnectFailures=0; });
      events.onerror = () => { setPartner(false); if (++reconnectFailures > 3) { events.close(); reportError(); } };
      const readEvent = (event: Event) => {
        try {
          return JSON.parse((event as MessageEvent<string>).data) as {
            senderId?: string;
            payload?: Record<string, unknown>;
          };
        } catch {
          return null;
        }
      };
      events.addEventListener('partner-joined', event => {
        const data = readEvent(event);
        if (!data || data.senderId === clientIdRef.current) return;
        const partnerLanguage = String(data.payload?.lang || '');
        if (partnerLanguage) setPartnerLang(partnerLanguage);
        setPartner(true);
        if (myRole === 'host') setPhase('chat');
      });
      events.addEventListener('new-message', event => {
        const data = readEvent(event);
        if (!data || data.senderId === clientIdRef.current) return;
        const incoming = data.payload as unknown as Message;
        if (!incoming?.original) return;
        const received = { ...incoming, mine: false };
        setPartner(true);
        setPartnerLang(received.lang);
        setMessages(prev => {
          const next = [...prev, received];
          return next.length > 200 ? next.slice(-200) : next;
        });
        if (received.translated) speakTTS(received.translated, received.targetLang);
      });
      events.addEventListener('speaking-start', event => {
        const data = readEvent(event);
        if (!data || data.senderId === clientIdRef.current) return;
        partnerSpeakingRef.current = true;
        setPartnerSpeaking(true);
        if (modeRef.current === 'conversation') { safeMute(); scheduleUnmute(8000); }
      });
      events.addEventListener('speaking-end', event => {
        const data = readEvent(event);
        if (!data || data.senderId === clientIdRef.current) return;
        partnerSpeakingRef.current = false;
        setPartnerSpeaking(false);
      });

      channelRef.current = {
        send: async ({ event, payload }) => {
          await freeTalkRequest('signal', { room: code, event, payload }).catch(reportError);
        },
      };
    })().catch(reportError);
  }, [speakTTS, safeMute, scheduleUnmute, reportError]);

  /* ── 메시지 전송 ── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || translatingRef.current) return;
    if (text.trim().length > 2000) { setInputText(text); setError('voice_turn_too_long'); return; }
    translatingRef.current = true;
    unlockAudio();
    setError('');
    setTranslating(true);
    setInputText('');

    const isSoloPartner = soloModeRef.current && soloTurnRef.current === 'partner';
    const sl = isSoloPartner ? (partnerLangRef.current || 'ja') : myLangRef.current;
    const tl = isSoloPartner ? myLangRef.current : (partnerLangRef.current || (sl === 'ko' ? 'ja' : 'ko'));

    if (!soloModeRef.current) {
      channelRef.current?.send({ type: 'broadcast', event: 'speaking-start', payload: {} });
    }

    try {
      const { translated, pronunciation = '', reverse_translated = '', normalizedText } = await freeTalkRequest('translate', { text, from: sl, to: tl, learning: learningModeRef.current });
      if (!translated) throw new Error('empty_translation');

      const msg: Message = {
        id: Date.now(), original: normalizedText || text, rawOriginal: text, translated,
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
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'new-message',
          payload: { ...msg, mine: false },
        });
        safeMute();
        scheduleUnmute(Math.min(8000, 1500 + translated.length * 150));
      }

      if (soloModeRef.current && translated) {
        // 1폰 모드: 번역된 텍스트를 직접 TTS로 재생 (speakTTS가 내부적으로 mute 처리)
        speakTTS(translated, tl);
      }
    } catch {
      setInputText(text);
      reportError();
    } finally {
      translatingRef.current = false;
      setTranslating(false);
      if (!soloModeRef.current) {
        channelRef.current?.send({ type: 'broadcast', event: 'speaking-end', payload: {} });
      }
    }
  }, [unlockAudio, safeMute, scheduleUnmute, speakTTS, reportError]);

  const handleTranscript = useCallback((text: string) => {
    if (voiceTurnRef.current.active) {
      voiceTurnRef.current.parts.push(text);
      return;
    }
    // 2폰 모드에서만 파트너 발화 중 억제
    if (!soloModeRef.current && partnerSpeakingRef.current && modeRef.current === 'conversation') return;
    return sendMessage(text);
  }, [sendMessage]);

  const handleSpeechStart = useCallback(() => {
    if (!soloModeRef.current) {
      channelRef.current?.send({ type: 'broadcast', event: 'speaking-start', payload: {} });
    }
  }, []);

  /* activeSttLang: solo 모드에서 턴에 따라 STT 언어 전환 */
  const activeSttLang = (soloMode && soloTurn === 'partner')
    ? (LANGS[partnerLang || 'ja']?.stt || 'ja-JP')
    : (LANGS[myLang]?.stt || 'ko-KR');

  const { isRecording, toggle: toggleSTT, mute: muteSTT, unmute: unmuteSTT, stopAndDrain } = useCloudSTT({
    lang: activeSttLang,
    endpoint: '/api/free-talk/stt',
    context: 'chat',
    onError: reportError,
    onTranscript: handleTranscript,
    onSpeechStart: handleSpeechStart,
    live: true,
    silenceDuration: soloMode ? 500 : mode === 'simultaneous' ? 800 : 1200,
  });
  useEffect(() => { muteSTTRef.current = muteSTT; }, [muteSTT]);
  useEffect(() => { unmuteSTTRef.current = unmuteSTT; }, [unmuteSTT]);

  const toggleVoice = useCallback(async () => {
    if (voiceBusyRef.current || translatingRef.current) return;
    voiceBusyRef.current = true;
    setVoiceBusy(true);
    try {
      if (isRecording) {
        // Keep the speaker/language pinned until all trailing recognition has completed.
        await stopAndDrain();
        const turn = voiceTurnRef.current;
        voiceTurnRef.current = { active: false, parts: [] };
        const text = turn.parts.join(' ').trim();
        if (turn.active && text) {
          if (text.length > 2000) {
            setInputText(text); // Preserve the complete transcript for editing; never silently truncate.
            setError('voice_turn_too_long');
          } else await sendMessage(text);
        }
      } else {
        audioPlayerRef.current?.cancel();
        if (unmuteTimerRef.current) { clearTimeout(unmuteTimerRef.current); unmuteTimerRef.current = null; }
        unmuteSTTRef.current();
        setError('');
        voiceTurnRef.current = { active: soloModeRef.current || modeRef.current !== 'simultaneous', parts: [] };
        if (!await toggleSTT()) voiceTurnRef.current = { active: false, parts: [] };
      }
    } finally {
      voiceBusyRef.current = false;
      setVoiceBusy(false);
    }
  }, [isRecording, stopAndDrain, toggleSTT, sendMessage]);

  const handleSoloSpeak = useCallback(async (turn: 'mine' | 'partner') => {
    if (voiceBusyRef.current || translatingRef.current) return;
    if (soloTurnRef.current !== turn) {
      if (isRecording) await toggleVoice(); // Deliver the old speaker's turn before switching language.
      setSoloTurn(turn);
      return;
    }
    await toggleVoice();
  }, [isRecording, toggleVoice]);

  const createRoom = useCallback(async () => {
    unlockAudio();
    try {
    const { room: code } = await freeTalkRequest('room', { lang: myLang });
    clientIdRef.current = 'host';
    setRoomCode(code);
    setMyRole('host');
    setPhase('waiting');
    subscribeChannel(code, 'host');
    } catch (error) { reportError(error); }
  }, [myLang, subscribeChannel, unlockAudio, reportError]);

  const joinRoom = useCallback(async (code: string, lang: string) => {
    unlockAudio();
    try {
    const joined = await freeTalkRequest('join', { room: code, lang });
    clientIdRef.current = joined.senderId;
    setPartnerLang(joined.partnerLang || null);
    setPartner(true);
    setRoomCode(code);
    setMyLang(lang);
    setMyRole('guest');
    setPhase('chat');
    subscribeChannel(code, 'guest');
    } catch (error) { reportError(error); }
  }, [subscribeChannel, unlockAudio, reportError]);

  /* ── solo 모드 진입: 상대 언어 선택 후 바로 채팅 시작 ── */
  const enterSoloMode = useCallback(async (pLang: string) => {
    unlockAudio();
    try { await ensureFreeTalkSession(); } catch { reportError(); return; }
    setSoloMode(true);
    setPartnerLang(pLang);
    setMyRole('host');
    setPhase('chat');
  }, [unlockAudio, reportError]);

  const isKorean = myLang === 'ko';
  const isHost   = myRole === 'host';

  /* ════ HOME ════ */
  if (phase === 'home') return (
    <div style={PAGE}>
      {notice}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 28px', minHeight: '100vh' }}>
        <div
          aria-hidden="true"
          className="travel-hero"
          style={{
            height: 150,
            width: '100%',
            borderRadius: 28,
            overflow: 'hidden',
            marginBottom: 28,
            border: '1px solid #cdd6e2',
            backgroundImage: 'linear-gradient(to top, rgba(5,22,43,0.52), rgba(5,22,43,0.04)), url("/images/mobile-v3/website/translate.webp")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 18px 42px rgba(16,42,67,0.14)',
          }}
        />
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 16 }}>SQ Link</p>
          <h1 style={{ fontSize: 40, fontWeight: 200, letterSpacing: -2, margin: 0, lineHeight: 1.1 }}>Free Talk</h1>
          <p style={{ marginTop: 12, color: '#a9c8ff', fontSize: 12 }}>{myLang === 'ko' ? '현장 용어집 적용 · 한국어 / English / 日本語 / 中文 / Việt' : 'Construction glossary · 5 languages'}</p>
          <p style={{ fontSize: 12, color: '#aebbd0', marginTop: 10, letterSpacing: 2 }}>{ui.bridge}</p>
        </div>

        <p style={{ fontSize: 10, color: '#aebbd0', letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>{ui.myLanguage}</p>
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
        <button disabled={!ready} onClick={createRoom} style={{ width: '100%', padding: 18, background: RED, border: 'none', borderRadius: 16, color: '#fff', fontSize: 15, fontWeight: 700, cursor: ready ? 'pointer' : 'wait', opacity: ready ? 1 : 0.5, marginBottom: 10 }}>
          {ui.start}
        </button>

        {/* 1폰 solo 모드 */}
        <button disabled={!ready} onClick={() => setPhase('solo-setup')} style={{
          width: '100%', padding: 15, marginBottom: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}>
          📱 {ui.solo}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label={ui.codeEntry} inputMode="numeric" placeholder="00000000" value={inputCode}
            onChange={e => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={e => e.key === 'Enter' && joinRoom(inputCode, myLang)}
            style={{ flex: 1, minWidth: 0, padding: '15px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#ede8e3', fontSize: 20, textAlign: 'center', letterSpacing: 3, outline: 'none' }}
          />
          <button onClick={() => joinRoom(inputCode, myLang)} disabled={!ready || inputCode.length !== 8} style={{ padding: '15px 22px', background: inputCode.length === 8 ? 'rgba(192,57,43,0.75)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', fontSize: 13, cursor: inputCode.length === 8 ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{ui.enter}</button>
        </div>

        <p style={{ marginTop: 48, textAlign: 'center', fontSize: 11, color: '#aebbd0', lineHeight: 2.2 }}>
          {ui.noInstall}
          <br /><Link href="/" style={{ color: '#b8c9e3' }}>← SQ LINK</Link>
        </p>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input::placeholder{color:#99a5b8}`}</style>
    </div>
  );

  /* ════ SOLO SETUP: 상대방 언어 선택 ════ */
  if (phase === 'solo-setup') return (
    <div style={{ ...PAGE, alignItems: 'center' }}>
      {notice}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 40 }}>SQ LINK · FREE TALK</p>

        <div style={{ marginBottom: 40, lineHeight: 2.6 }}>
          <p style={{ fontSize: 16, color: '#ede8e3', fontWeight: 300 }}>{ui.partnerLanguage}</p>
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
          fontSize: 12, color: '#aebbd0', background: 'none', border: 'none', cursor: 'pointer',
        }}>{ui.back}</button>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  );

  /* ════ JOIN ════ */
  if (phase === 'join') return (
    <div style={{ ...PAGE, alignItems: 'center' }}>
      {notice}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 40 }}>SQ LINK · FREE TALK</p>
        <div style={{ marginBottom: 40, lineHeight: 2.6 }}>
          <p style={{ fontSize: 16, color: '#ede8e3', fontWeight: 300 }}>{ui.selectLanguage}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 48 }}>
          {Object.entries(LANGS).map(([code, info]) => (
            <button key={code} disabled={!ready} onClick={() => joinRoom(pendingCode, code)} style={{
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
        <p style={{ fontSize: 11, color: '#aebbd0' }}>{ui.tapFlag}</p>
      </div>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  );

  /* ════ WAITING ════ */
  if (phase === 'waiting') {
    const qrUrl = `${travelUrl}?code=${roomCode}`;
    return (
      <div style={{ ...PAGE, alignItems: 'center' }}>
        {notice}
        <div style={{ textAlign: 'center', padding: 36, maxWidth: 380 }}>
          <p style={{ fontSize: 10, letterSpacing: 7, color: RED, fontWeight: 700, marginBottom: 16 }}>SQ LINK · FREE TALK</p>

          <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: '#e74c3c', fontWeight: 700, marginBottom: 10 }}>📷 {ui.showQr}</p>
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
          <p style={{ fontSize: 11, color: '#aebbd0', marginBottom: 12 }}>{ui.codeEntry}</p>
          <div style={{ background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.22)', borderRadius: 20, padding: '16px 40px', marginBottom: 28, display: 'inline-block' }}>
            <span data-testid="free-talk-room-code" style={{ fontSize: 30, fontWeight: 600, letterSpacing: 3, color: '#e74c3c' }}>{roomCode}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#aebbd0', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, display: 'inline-block', animation: 'blink 1.4s infinite' }} />
            {ui.waiting}
          </div>
          <a href="/free-talk" style={{ display: 'block', marginTop: 24, color: '#b8c9e3' }}>{ui.back}</a>
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
      {notice}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* ── 헤더 ── */}
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,15,25,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 20, flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
          <a href="/free-talk" aria-label={ui.back} style={{ color: '#b8c9e3', padding: 8 }}>←</a>

          {/* 연결 상태 + 언어 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
            {soloMode ? (
              <>
                <span style={{ fontSize: 14 }}>📱</span>
                <span style={{ fontSize: 16 }}>{LANGS[myLang]?.flag}</span>
                <span style={{ fontSize: 10, color: '#aebbd0' }}>↔</span>
                <span style={{ fontSize: 16 }}>{LANGS[pLang]?.flag}</span>
                <span style={{ fontSize: 9, color: '#c0392b', letterSpacing: 2 }}>1폰</span>
              </>
            ) : (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: partnerOnline ? '#2ecc71' : '#3a3a4a', display: 'inline-block' }} />
                <span style={{ fontSize: 16 }}>{LANGS[myLang]?.flag}</span>
                <span style={{ fontSize: 10, color: '#aebbd0' }}>↔</span>
                <span style={{ fontSize: 16 }}>{LANGS[pLang]?.flag}</span>
                <span style={{ fontSize: 9, color: '#aebbd0', letterSpacing: 3 }}>#{roomCode}</span>
              </>
            )}
          </div>

          {/* TTS 켜기/끄기 */}
          <Toggle
            on={ttsEnabled}
            onToggle={() => { if (ttsEnabled) { audioPlayerRef.current?.cancel(); scheduleUnmute(0); } setTtsEnabled(v => !v); }}
            labelOn="🔊"
            labelOff="🔇"
            color="#2ecc71"
          />

          {/* 남자/여자 음성 */}
          <Toggle
            on={voiceGender === 'male'}
            onToggle={() => setVoiceGender(g => g === 'female' ? 'male' : 'female')}
            labelOn={ui.male}
            labelOff={ui.female}
            color="#5dade2"
          />

          {/* 대화 / 동시통역 모드 — 2폰 호스트만 */}
          {!soloMode && isHost && (
            <Toggle
              on={isSim}
              onToggle={async () => {
                if (voiceBusyRef.current || translatingRef.current) return;
                const next: ChatMode = isSim ? 'conversation' : 'simultaneous';
                if (isRecording) await toggleVoice();
                setMode(next);
                if (next === 'simultaneous') {
                  voiceTurnRef.current = { active: false, parts: [] };
                  voiceBusyRef.current = true; setVoiceBusy(true);
                  try { await toggleSTT(); }
                  finally { voiceBusyRef.current = false; setVoiceBusy(false); }
                }
              }}
              labelOn={ui.simultaneous}
              labelOff={ui.conversation}
              color={RED}
            />
          )}

          {/* 학습 모드 — 한국인 호스트 (2폰) 또는 한국인 사용자 (1폰) */}
          {isKorean && (soloMode || isHost) && (
            <Toggle
              on={learningMode}
              onToggle={() => setLearningMode(v => !v)}
              labelOn={ui.learning}
              labelOff={ui.quick}
              color="#f39c12"
            />
          )}
        </div>

        {/* 동시통역 배너 (2폰 모드만) */}
        {isSim && (
          <div style={{ padding: '5px 14px', background: 'rgba(192,57,43,0.07)', borderBottom: '1px solid rgba(192,57,43,0.15)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRecording ? RED : '#444', animation: isRecording ? 'blink 1s infinite' : 'none', display: 'inline-block' }} />
            <span style={{ color: isRecording ? '#e74c3c' : '#555' }}>
              {isRecording ? ui.interpreting : ui.microphoneStarting}
            </span>
          </div>
        )}

        {/* 상대방 발화 중 알림 (2폰 모드만) */}
        {!soloMode && partnerSpeaking && (
          <div style={{ padding: '4px 14px', background: 'rgba(46,204,113,0.07)', borderBottom: '1px solid rgba(46,204,113,0.15)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71', animation: 'blink 0.8s infinite', display: 'inline-block' }} />
            <span style={{ color: '#2ecc71' }}>
              {LANGS[pLang]?.flag} {ui.partnerSpeaking}
            </span>
          </div>
        )}

        {/* 메시지 목록 */}
        <div style={{ flex: 1, padding: '20px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#aebbd0' }}>
              <p style={{ fontSize: 34, marginBottom: 16 }}>💬</p>
              <p style={{ fontSize: 12, lineHeight: 2.4, color: '#aebbd0' }}>
                {soloMode
                  ? `${LANGS[myLang]?.flag} ${ui.meSpeak} → ${LANGS[pLang]?.flag} ${ui.partner} · ${ui.tapToSpeak}`
                  : isSim
                    ? ui.autoTranslate
                    : ui.startConversation
                }
              </p>
              {isKorean && learningMode && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: BLUE, borderRadius: 12, fontSize: 11, color: 'rgba(100,180,255,0.7)', lineHeight: 2 }}>
                  {ui.learningHint}<br />
                  <span style={{ opacity: 0.6 }}>{ui.learningSub}</span>
                </div>
              )}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id}>
              <MsgBubble msg={msg} isKorean={isKorean} learningMode={learningMode} onPlay={speakTTS} ui={ui} />
              {msg.rawOriginal && msg.rawOriginal !== msg.original && <details style={{ color: '#aebbd0', fontSize: 12, marginTop: 8 }}><summary>{myLang === 'ko' ? '용어 변환 전 원문' : 'Original before glossary'}</summary>{msg.rawOriginal}</details>}
            </div>
          ))}

          {translating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#aebbd0', fontSize: 12 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block', animation: `dot 1s ${i * 0.2}s infinite` }} />
              ))}
              {ui.translating}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        <div style={{ padding: '12px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.055)', background: 'rgba(7,7,14,0.98)', backdropFilter: 'blur(20px)' }}>
          {(soloMode || !isSim) && <p role="status" style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
            {voiceBusy ? ui.translating : ({
              ko: '한 번 눌러 녹음 시작 · 다시 눌러 종료 후 한 번에 전송',
              en: 'Tap to record · Tap again to stop and send as one message',
              ja: 'タップして録音 · もう一度タップして終了し、まとめて送信',
              zh: '点击开始录音 · 再次点击结束并一次发送',
              vi: 'Chạm để ghi âm · Chạm lần nữa để dừng và gửi một tin nhắn',
              ru: 'Нажмите для записи · Нажмите ещё раз для отправки одним сообщением',
            } as Record<string,string>)[myLang] || 'Tap to record · Tap again to stop and send as one message'}
          </p>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input disabled={isRecording || voiceBusy} aria-label={ui.textInput} maxLength={2000} value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
              placeholder={ui.textInput}
              style={{ flex: 1, padding: '13px 15px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, color: '#ede8e3', fontSize: 14, outline: 'none' }}
            />
            <button aria-label={ui.enter} disabled={isRecording || voiceBusy || translating || !inputText.trim() || inputText.length > 2000} onClick={() => sendMessage(inputText)} style={{ padding: '13px 17px', background: inputText.trim() ? RED : 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 20, cursor: 'pointer' }}>↑</button>
          </div>

          {/* ── solo 1폰 모드 버튼 ── */}
          {soloMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* 내 버튼 */}
              <button
                disabled={voiceBusy || translating}
                onClick={() => handleSoloSpeak('mine')}
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
                  {soloTurn === 'mine' && isRecording ? ui.listening : ui.meSpeak}
                </span>
              </button>

              {/* 상대 버튼 */}
              <button
                disabled={voiceBusy || translating}
                onClick={() => handleSoloSpeak('partner')}
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
                  {soloTurn === 'partner' && isRecording ? ui.listening : `${ui.partner} · ${LANGS[pLang]?.label}`}
                </span>
              </button>
            </div>
          ) : !isSim ? (
            /* ── 2폰 대화 모드 ── */
            <button disabled={voiceBusy || translating} onClick={toggleVoice} style={{
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
                ? `${ui.listening} (${voiceGender === 'female' ? '♀' : '♂'})`
                : `${LANGS[myLang]?.flag} ${ui.tapToSpeak}`}
            </button>
          ) : (
            /* ── 2폰 동시통역 모드 ── */
            <button disabled={voiceBusy || translating} onClick={toggleVoice} style={{
              width: '100%', padding: 11,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, color: '#aebbd0', fontSize: 11, cursor: 'pointer',
            }}>
              {isRecording ? ui.pauseMic : ui.restartMic}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dot{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:0}
        input::placeholder{color:#99a5b8}
      `}</style>
    </div>
  );
}

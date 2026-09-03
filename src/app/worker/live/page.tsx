"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { playLiveBroadcastAudio, VoiceGender } from "@/utils/tts";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import { persistDisplayLanguage, resolveDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

interface Subtitle {
    id: string;
    text_ko: string;
    translated: string;
    reverseTranslated: string;
    time: string;
    role?: "admin" | "worker";
}

const i18n: Record<string, Record<string, string>> = {
    ko: { title: "실시간 통역", waiting: "방송 대기 중...", waitingDesc: "관리자가 방송을 시작하면 자동으로 연결됩니다", connected: "연결됨", back: "나가기" },
    en: { title: "LIVE INTERPRETER", waiting: "Waiting for broadcast...", waitingDesc: "Will connect automatically when admin starts", connected: "Connected", back: "Exit" },
    zh: { title: "实时翻译", waiting: "等待广播...", waitingDesc: "管理员开始广播后自动连接", connected: "已连接", back: "退出" },
    vi: { title: "PHIÊN DỊCH TRỰC TIẾP", waiting: "Đang chờ phát sóng...", waitingDesc: "Sẽ tự động kết nối khi admin bắt đầu", connected: "Đã kết nối", back: "Thoát" },
    th: { title: "ล่ามสด", waiting: "รอการถ่ายทอด...", waitingDesc: "จะเชื่อมต่อเมื่อผู้ดูแลเริ่มถ่ายทอด", connected: "เชื่อมต่อแล้ว", back: "ออก" },
    uz: { title: "JONLI TARJIMA", waiting: "Efirni kutmoqda...", waitingDesc: "Admin boshlaganda avtomatik ulanadi", connected: "Ulangan", back: "Chiqish" },
    ph: { title: "LIVE INTERPRETER", waiting: "Naghihintay sa broadcast...", waitingDesc: "Awtomatikong kokonektahin kapag nagsimula ang admin", connected: "Nakakonekta", back: "Lumabas" },
    ru: { title: "СИНХРОННЫЙ ПЕРЕВОД", waiting: "Ожидание трансляции...", waitingDesc: "Автоматически подключится, когда начнёт администратор", connected: "Подключено", back: "Выйти" },
    jp: { title: "同時通訳", waiting: "放送を待っています...", waitingDesc: "管理者が放送を開始すると自動接続されます", connected: "接続済み", back: "退出" },
    km: { title: "បកប្រែផ្ទាល់", waiting: "កំពុងរង់ចាំការផ្សាយ...", waitingDesc: "នឹងភ្ជាប់ដោយស្វ័យប្រវត្តិនៅពេលអ្នកគ្រប់គ្រងចាប់ផ្តើម", connected: "បានភ្ជាប់", back: "ចាកចេញ" },
    mn: { title: "ШУУД ОРЧУУЛГА", waiting: "Нэвтрүүлэг хүлээж байна...", waitingDesc: "Захиргаа эхлүүлэхэд автоматаар холбогдоно", connected: "Холбогдсон", back: "Гарах" },
    my: { title: "တိုက်ရိုက် ဘာသာပြန်", waiting: "ထုတ်လွှင့်မှုကို စောင့်နေသည်...", waitingDesc: "မန်နေဂျာ စတင်သောအခါ အလိုအလျောက် ချိတ်ဆက်မည်", connected: "ချိတ်ဆက်ပြီး", back: "ထွက်မည်" },
    ne: { title: "लाइभ अनुवाद", waiting: "प्रसारण पर्खँदै...", waitingDesc: "व्यवस्थापकले सुरु गरेपछि स्वतः जडान हुनेछ", connected: "जडान भयो", back: "बाहिर निस्कनुहोस्" },
    bn: { title: "লাইভ অনুবাদ", waiting: "সম্প্রচারের অপেক্ষা...", waitingDesc: "ম্যানেজার শুরু করলে স্বয়ংক্রিয়ভাবে সংযুক্ত হবে", connected: "সংযুক্ত", back: "বের হন" },
    kk: { title: "ТІКЕЛЕЙ АУДАРМА", waiting: "Трансляция күтуде...", waitingDesc: "Менеджер бастаған кезде автоматты түрде қосылады", connected: "Қосылды", back: "Шығу" },
    ar: { title: "ترجمة فورية", waiting: "في انتظار البث...", waitingDesc: "سيتصل تلقائيًا عند بدء المدير", connected: "متصل", back: "خروج" },
    hi: { title: "लाइव अनुवाद", waiting: "प्रसारण की प्रतीक्षा में...", waitingDesc: "प्रबंधक के शुरू करने पर स्वचालित रूप से जुड़ जाएगा", connected: "जुड़ा हुआ", back: "बाहर निकलें" },
    id: { title: "PENERJEMAH LANGSUNG", waiting: "Menunggu siaran...", waitingDesc: "Akan terhubung otomatis saat admin memulai", connected: "Terhubung", back: "Keluar" },
};
const getT = (lang: string) => i18n[lang] || i18n["en"];

const LIVE_COMMON: Record<string, Record<string, string>> = {
    ko: { info:"관리자의 안전 안내를 선택한 언어로 실시간 전달합니다.", myVoice:"내 음성", manager:"관리자", stop:"말하기 중지", speak:"관리자에게 말하기", wait:"관리자 대기 중" },
    en: { info:"Safety guidance from the administrator is delivered live in your selected language.", myVoice:"My voice", manager:"Manager", stop:"STOP SPEAKING", speak:"SPEAK TO MANAGER", wait:"WAITING FOR MANAGER" },
    zh: { info:"管理员的安全指导将以您选择的语言实时传达。", myVoice:"我的语音", manager:"管理员", stop:"停止说话", speak:"向管理员说话", wait:"等待管理员" },
    vi: { info:"Hướng dẫn an toàn của quản trị viên được truyền trực tiếp bằng ngôn ngữ bạn chọn.", myVoice:"Giọng nói của tôi", manager:"Quản trị viên", stop:"DỪNG NÓI", speak:"NÓI VỚI QUẢN TRỊ VIÊN", wait:"ĐANG CHỜ QUẢN TRỊ VIÊN" },
    ru: { info:"Указания по безопасности от администратора передаются в реальном времени на выбранном языке.", myVoice:"Мой голос", manager:"Администратор", stop:"ОСТАНОВИТЬ РЕЧЬ", speak:"ГОВОРИТЬ С АДМИНИСТРАТОРОМ", wait:"ОЖИДАНИЕ АДМИНИСТРАТОРА" },
    th: { info:"คำแนะนำด้านความปลอดภัยจากผู้ดูแลจะส่งแบบสดในภาษาที่คุณเลือก", myVoice:"เสียงของฉัน", manager:"ผู้ดูแล", stop:"หยุดพูด", speak:"พูดกับผู้ดูแล", wait:"รอผู้ดูแล" },
    uz: { info:"Administrator xavfsizlik ko'rsatmalari tanlangan tilingizda jonli uzatiladi.", myVoice:"Mening ovozim", manager:"Administrator", stop:"GAPIRISHNI TO'XTATISH", speak:"ADMINISTRATORGA GAPIRISH", wait:"ADMINISTRATOR KUTILMOQDA" },
    ph: { info:"Ang gabay sa kaligtasan ng administrator ay ipinapadala nang live sa iyong napiling wika.", myVoice:"Aking boses", manager:"Administrator", stop:"ITIGIL ANG PAGSASALITA", speak:"KUMAUSAP SA ADMINISTRATOR", wait:"HINIHINTAY ANG ADMINISTRATOR" },
    km: { info:"ការណែនាំសុវត្ថិភាពពីអ្នកគ្រប់គ្រងត្រូវបានបញ្ជូនផ្ទាល់ជាភាសាដែលអ្នកជ្រើសរើស។", myVoice:"សំឡេងរបស់ខ្ញុំ", manager:"អ្នកគ្រប់គ្រង", stop:"ឈប់និយាយ", speak:"និយាយទៅកាន់អ្នកគ្រប់គ្រង", wait:"កំពុងរង់ចាំអ្នកគ្រប់គ្រង" },
    mn: { info:"Администраторын аюулгүй ажиллагааны заавар таны сонгосон хэлээр шууд дамжина.", myVoice:"Миний дуу", manager:"Администратор", stop:"ЯРИХАА ЗОГСООХ", speak:"АДМИНИСТРАТОРТ ЯРИХ", wait:"АДМИНИСТРАТОР ХҮЛЭЭЖ БАЙНА" },
    my: { info:"စီမံခန့်ခွဲသူ၏ ဘေးကင်းရေးညွှန်ကြားချက်ကို သင်ရွေးချယ်သောဘာသာဖြင့် တိုက်ရိုက်ပို့ပေးသည်။", myVoice:"ကျွန်ုပ်၏အသံ", manager:"စီမံခန့်ခွဲသူ", stop:"စကားပြောရပ်ရန်", speak:"စီမံခန့်ခွဲသူထံ ပြောရန်", wait:"စီမံခန့်ခွဲသူကို စောင့်နေသည်" },
    ne: { info:"प्रशासकको सुरक्षा निर्देशन तपाईंको छनोटको भाषामा प्रत्यक्ष पठाइन्छ।", myVoice:"मेरो आवाज", manager:"प्रशासक", stop:"बोल्न रोक्नुहोस्", speak:"प्रशासकसँग बोल्नुहोस्", wait:"प्रशासकको प्रतीक्षा" },
    bn: { info:"প্রশাসকের নিরাপত্তা নির্দেশনা আপনার নির্বাচিত ভাষায় সরাসরি পাঠানো হয়।", myVoice:"আমার কণ্ঠ", manager:"প্রশাসক", stop:"কথা বলা বন্ধ করুন", speak:"প্রশাসকের সঙ্গে কথা বলুন", wait:"প্রশাসকের অপেক্ষায়" },
    kk: { info:"Әкімшінің қауіпсіздік нұсқаулары таңдалған тіліңізде тікелей беріледі.", myVoice:"Менің дауысым", manager:"Әкімші", stop:"СӨЙЛЕУДІ ТОҚТАТУ", speak:"ӘКІМШІГЕ СӨЙЛЕУ", wait:"ӘКІМШІ КҮТІЛУДЕ" },
    jp: { info:"管理者の安全案内を選択した言語でリアルタイムに伝えます。", myVoice:"自分の声", manager:"管理者", stop:"発話を停止", speak:"管理者に話す", wait:"管理者を待機中" },
    fr: { info:"Les consignes de sécurité de l’administrateur sont transmises en direct dans la langue choisie.", myVoice:"Ma voix", manager:"Administrateur", stop:"ARRÊTER DE PARLER", speak:"PARLER À L’ADMINISTRATEUR", wait:"EN ATTENTE DE L’ADMINISTRATEUR" },
    es: { info:"Las indicaciones de seguridad del administrador se transmiten en directo en el idioma seleccionado.", myVoice:"Mi voz", manager:"Administrador", stop:"DEJAR DE HABLAR", speak:"HABLAR CON EL ADMINISTRADOR", wait:"ESPERANDO AL ADMINISTRADOR" },
    ar: { info:"تُنقل تعليمات السلامة من المسؤول مباشرةً باللغة التي اخترتها.", myVoice:"صوتي", manager:"المسؤول", stop:"إيقاف التحدث", speak:"التحدث إلى المسؤول", wait:"بانتظار المسؤول" },
    hi: { info:"प्रशासक के सुरक्षा निर्देश आपकी चुनी हुई भाषा में लाइव भेजे जाते हैं।", myVoice:"मेरी आवाज़", manager:"प्रशासक", stop:"बोलना बंद करें", speak:"प्रशासक से बात करें", wait:"प्रशासक की प्रतीक्षा" },
    id: { info:"Panduan keselamatan dari administrator disampaikan langsung dalam bahasa pilihan Anda.", myVoice:"Suara saya", manager:"Administrator", stop:"BERHENTI BERBICARA", speak:"BICARA KE ADMINISTRATOR", wait:"MENUNGGU ADMINISTRATOR" },
};
const LIVE_LOCALES: Record<string, string> = { ko:"ko-KR", en:"en-US", zh:"zh-CN", vi:"vi-VN", ru:"ru-RU" };

export default function WorkerLivePage() {
    const router = useRouter();
    const lang = useDisplayLanguage();
    const common = LIVE_COMMON[lang] || LIVE_COMMON.en;
    const locale = LIVE_LOCALES[lang] || LIVE_LOCALES.en;
    const [gender] = useState<VoiceGender>("female");
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [isTranslating, setIsTranslating] = useState(false);
    const [sttError, setSttError] = useState("");
    // profileId와 siteId를 동시에 세팅하여 subscription이 한 번만 생성되도록
    const [authReady, setAuthReady] = useState<{
        profileId: string;
        siteId: string | null;
        displayName: string;
    } | null>(null);
    const [activeAdminId, setActiveAdminId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const ttsQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const audioEnabledRef = useRef(true);
    const langRef = useRef("ko");
    const genderRef = useRef<VoiceGender>("female");
    const seenRowsRef = useRef<Set<string>>(new Set());
    const activeSessionIdRef = useRef<string | null>(null);
    const sessionLifecycleSupportedRef = useRef(true);
    const translatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRenderedRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

    // Keep refs in sync
    useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { genderRef.current = gender; }, [gender]);

    // 자막 추가 후 렌더 완료 시점에 스크롤 (requestAnimationFrame은 렌더 전 실행되어 부정확)
    useEffect(() => {
        if (subtitles.length === 0) return;
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [subtitles]);

    // 오디오 자동재생 unlock — 모바일 브라우저는 사용자 터치 전 오디오 차단
    useEffect(() => {
        const unlock = () => {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            ctx.resume().then(() => ctx.close());
            // 무음 오디오 재생하여 브라우저 오디오 정책 해제
            const silent = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
            silent.play().catch(() => {});
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('click', unlock);
        };
        document.addEventListener('touchstart', unlock, { once: true });
        document.addEventListener('click', unlock, { once: true });
        return () => {
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('click', unlock);
        };
    }, []);

    const handleWorkerTranscript = useCallback(async (text: string) => {
        if (!authReady?.siteId || !activeAdminId) return;
        const cleanText = text.trim().replace(/\s+/g, " ");
        if (!cleanText) return;
        setSttError("");

        let koreanText = "";
        try {
            const response = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: cleanText,
                    sl: langRef.current,
                    tl: "ko",
                    fast: true,
                    pronunciation: false,
                    useGlossary: true,
                }),
            });
            const data = await response.json();
            koreanText = String(data.translated || "").trim();
        } catch {
            koreanText = "";
        }
        if (!koreanText) return;

        const saveRes = await fetch("/api/live/worker-responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                siteId: authReady.siteId,
                adminId: activeAdminId,
                sourceLang: langRef.current,
                sourceText: cleanText,
                translatedText: koreanText,
                speakerName: authReady.displayName,
            }),
        });

        if (!saveRes.ok) {
            console.error("[worker/live] response insert failed:", saveRes.status);
            return;
        }
        const saved = await saveRes.json() as { id: string };

        const time = new Date().toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        setSubtitles(prev => [...prev, {
            id: saved.id,
            text_ko: koreanText,
            translated: cleanText,
            reverseTranslated: koreanText,
            time,
            role: "worker",
        }]);
    }, [activeAdminId, authReady, locale]);

    const {
        isRecording,
        audioLevel,
        toggle: toggleRecording,
        mute: muteRecording,
        unmute: unmuteRecording,
    } = useCloudSTT({
        lang,
        onTranscript: handleWorkerTranscript,
        onError: (_type, message) => setSttError(message),
        live: true,
    });

    const processQueue = useCallback(() => {
        if (isPlayingRef.current || ttsQueueRef.current.length === 0) return;
        isPlayingRef.current = true;
        const text = ttsQueueRef.current.shift()!;
        muteRecording();
        // 근로자 방송 수신은 기본적으로 음성 켜짐이며, 도착 순서대로 자동 재생한다.
        // 앱 WebView는 MainActivity에서 자동 재생을 허용한다.
        playLiveBroadcastAudio(text, langRef.current, genderRef.current, () => {
            isPlayingRef.current = false;
            unmuteRecording();
            processQueue();
        });
    }, [muteRecording, unmuteRecording]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (!res.ok) return;
            const data = await res.json() as {
                user?: { id: string };
                profile?: { preferred_lang?: string | null; site_id?: string | null; display_name?: string | null } | null;
            };
            if (data.user?.id) {
                const preferredLang = resolveDisplayLanguage(data.profile?.preferred_lang);
                persistDisplayLanguage(preferredLang);
                langRef.current = preferredLang;
                setAuthReady({
                    profileId: data.user.id,
                    siteId: data.profile?.site_id || null,
                    displayName: data.profile?.display_name || "Worker",
                });
            }
        };
        load();
    }, []);

    // 관리자가 아직 말을 시작하지 않았어도 같은 현장의 관리자에게 먼저 응답할 수 있다.
    // 방송 시작 이벤트가 오면 해당 관리자 ID로 즉시 교체된다.
    useEffect(() => {
        if (!authReady?.siteId || activeAdminId) return;
        let cancelled = false;
        const loadSiteAdmin = async () => {
            const res = await fetch("/api/worker/chat/admins", { cache: "no-store" });
            if (!res.ok || cancelled) return;
            const data = await res.json() as { admins?: Array<{ id?: string; site_id?: string | null }> };
            const siteAdmin = data.admins?.find(admin => String(admin.site_id ?? "") === String(authReady.siteId));
            if (siteAdmin?.id && !cancelled) setActiveAdminId(siteAdmin.id);
        };
        void loadSiteAdmin();
        return () => { cancelled = true; };
    }, [activeAdminId, authReady]);

    // 과거 방송 이력은 화면에 진입한 순간 새 방송처럼 자동 재생하면 안 된다.
    // 현재 접속 이후 관리자가 실제로 전파한 이벤트만 SSE로 수신·자동 재생한다.
    useEffect(() => {
        if (!authReady) return;
        const { siteId } = authReady;
        let cancelled = false;
        type TranslationRow = {
            id: string;
            session_id?: string;
            text_ko: string;
            translations?: Record<string, string>;
            created_by?: string;
        };

        const handleTranslation = async (row: TranslationRow) => {
            if (cancelled || seenRowsRef.current.has(row.id)) return;
            // 방송 시작 신호를 받은 세션만 수신한다. 종료된/이전 세션은 절대 재생하지 않는다.
            if (activeSessionIdRef.current && row.session_id !== activeSessionIdRef.current) return;
            if (!activeSessionIdRef.current && sessionLifecycleSupportedRef.current) return;
            // 이전 운영 백엔드 호환: 세션 API가 아직 없는 경우에도 화면 진입 뒤
            // 새로 도착한 첫 발화만 방송으로 잡는다. 과거 이력은 불러오지 않는다.
            if (!activeSessionIdRef.current && !sessionLifecycleSupportedRef.current) {
                activeSessionIdRef.current = row.session_id ?? "legacy-live";
                setIsConnected(true);
            }
            seenRowsRef.current.add(row.id);
            if (row.created_by) setActiveAdminId(row.created_by);
            const cleanTextKo = String(row.text_ko || "").trim().replace(/\s+/g, " ");
            if (!cleanTextKo) return;
            const now = Date.now();
            if (lastRenderedRef.current.text === cleanTextKo && now - lastRenderedRef.current.at < 10_000) return;
            lastRenderedRef.current = { text: cleanTextKo, at: now };
            setIsConnected(true);
            setIsTranslating(false);
            const time = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const myLang = langRef.current;

            const addSubAndScroll = (sub: Subtitle, ttsText?: string) => {
                setSubtitles(prev => [...prev, sub]);
                if (ttsText && audioEnabledRef.current) {
                    ttsQueueRef.current.push(ttsText);
                    processQueue();
                }
            };

            if (myLang === 'ko') {
                addSubAndScroll(
                    { id: row.id, text_ko: cleanTextKo, translated: cleanTextKo, reverseTranslated: "", time },
                    cleanTextKo
                );
                return;
            }

            const pretranslated = row.translations?.[myLang];
            if (pretranslated) {
                addSubAndScroll(
                    { id: row.id, text_ko: cleanTextKo, translated: pretranslated, reverseTranslated: cleanTextKo, time },
                    pretranslated
                );
                return;
            }

            try {
                const res = await fetch("/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: cleanTextKo,
                        sl: "ko",
                        tl: myLang,
                        fast: true,
                        pronunciation: false,
                        useGlossary: true,
                    }),
                });
                const data = await res.json();
                const translatedNow = data.translated || row.text_ko;
                addSubAndScroll(
                    { id: row.id, text_ko: cleanTextKo, translated: translatedNow, reverseTranslated: data.reverse_translated || "", time },
                    translatedNow
                );
            } catch {
                addSubAndScroll(
                    { id: row.id, text_ko: cleanTextKo, translated: cleanTextKo, reverseTranslated: "", time }
                );
            }
        };

        const params = new URLSearchParams({ type: "translations" });
        if (siteId) params.set("siteId", siteId);
        const events = new EventSource(`/api/live/events?${params.toString()}`);
        events.addEventListener("broadcast-start", event => {
            try {
                const broadcast = JSON.parse((event as MessageEvent<string>).data) as { session_id?: string; started_by?: string };
                activeSessionIdRef.current = broadcast.session_id ?? null;
                if (broadcast.started_by) setActiveAdminId(broadcast.started_by);
                setIsConnected(Boolean(activeSessionIdRef.current));
            } catch {
                // 다음 방송 시작 신호에서 다시 동기화한다.
            }
        });
        events.addEventListener("broadcast-stop", event => {
            try {
                const broadcast = JSON.parse((event as MessageEvent<string>).data) as { session_id?: string };
                if (broadcast.session_id === activeSessionIdRef.current) {
                    activeSessionIdRef.current = null;
                    setIsConnected(false);
                    setIsTranslating(false);
                }
            } catch {
                // 연결이 유지되는 동안 다음 상태 신호를 기다린다.
            }
        });
        events.addEventListener("broadcast-speaking", event => {
            try {
                const broadcast = JSON.parse((event as MessageEvent<string>).data) as { session_id?: string };
                if (broadcast.session_id !== activeSessionIdRef.current) return;
                setIsTranslating(true);
                if (translatingTimerRef.current) clearTimeout(translatingTimerRef.current);
                // 인식 실패 시에도 표시가 영구히 남지 않도록 안전하게 해제한다.
                translatingTimerRef.current = setTimeout(() => setIsTranslating(false), 12_000);
            } catch {
                // 다음 정상 신호를 기다린다.
            }
        });
        events.addEventListener("translation", event => {
            try {
                void handleTranslation(JSON.parse((event as MessageEvent<string>).data));
            } catch {
                // EventSource reconnects automatically; missed rows are loaded on the next mount.
            }
        });

        // 근로자가 방송 도중 화면에 들어온 경우 현재 활성 세션만 조회한다.
        const loadCurrentBroadcast = async () => {
            const query = new URLSearchParams();
            if (siteId) query.set("siteId", siteId);
            const res = await fetch(`/api/live/sessions?${query.toString()}`, { cache: "no-store" });
            if (res.status === 404) {
                sessionLifecycleSupportedRef.current = false;
                return;
            }
            if (!res.ok || cancelled) return;
            const data = await res.json() as { active?: boolean; session?: { session_id?: string; started_by?: string } };
            if (!data.active || !data.session?.session_id) return;
            activeSessionIdRef.current = data.session.session_id;
            if (data.session.started_by) setActiveAdminId(data.session.started_by);
            setIsConnected(true);
        };
        void loadCurrentBroadcast();
        return () => {
            cancelled = true;
            if (translatingTimerRef.current) clearTimeout(translatingTimerRef.current);
            events.close();
        };
    }, [authReady, processQueue, locale]);

    const t = getT(lang);

    return (
        <RoleGuard allowedRole="worker">
            <div className="visualization-light h-screen font-sans flex flex-col overflow-hidden">
                <header className="concept-page-header safe-area-sticky-top sticky z-50">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push("/worker")} className="p-2 -ml-2 rounded-full hover:bg-white/5 tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-lg font-black tracking-tight uppercase italic">{t.title}</span>
                        {isConnected && (
                            <div className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-green-400 font-black tracking-widest">{t.connected}</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className={`p-3 rounded-full transition-all ${audioEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-600'}`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {audioEnabled ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                            )}
                        </svg>
                    </button>
                </header>

                <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 flex flex-col gap-4">
                    <div className="admin-concept-hero relative h-40 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl shrink-0">
                        <picture>
                            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/live.webp" />
                            <Image src="/images/mobile-v3/website/live.webp" alt="Live field monitoring" fill className="object-cover" priority />
                        </picture>
                        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                        <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                            <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ LINK LIVE</p>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
                            <p className="mt-2 text-sm font-bold text-slate-100">{common.info}</p>
                        </div>
                    </div>

                    {subtitles.length === 0 && (
                        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                            <div className="flex flex-col items-center gap-6 text-center">
                                <div className="w-24 h-24 glass rounded-[32px] flex items-center justify-center">
                                    <div className="flex gap-1">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="w-2 bg-blue-400/40 rounded-full animate-pulse" style={{ height: `${16 + Math.random() * 24}px`, animationDelay: `${i * 0.2}s` }} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xl font-black text-slate-400">{t.waiting}</p>
                                    <p className="text-sm text-slate-600 font-bold mt-2">{t.waitingDesc}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTranslating && (
                        <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-center text-sm font-black text-blue-200 animate-pulse">
                            번역 중…
                        </div>
                    )}

                    {subtitles.map((sub) => (
                        <div
                            key={sub.id}
                            className={`glass rounded-[28px] p-6 animate-float flex flex-col gap-2 ${
                                sub.role === "worker"
                                    ? "border-emerald-500/30 bg-emerald-500/10 ml-8"
                                    : "border-white/5 mr-8"
                            }`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                                sub.role === "worker" ? "text-emerald-400" : "text-blue-400"
                            }`}>
                                {sub.role === "worker" ? common.myVoice : common.manager}
                            </span>
                            <p className="text-2xl font-black text-white leading-snug">{sub.translated}</p>
                            {lang !== 'ko' && sub.reverseTranslated && (
                                <p className="text-sm font-bold text-slate-600 mt-1">{sub.reverseTranslated}</p>
                            )}
                            <span className="text-[10px] font-black text-slate-700 self-end">{sub.time}</span>
                        </div>
                    ))}
                </div>

                <div className="sticky bottom-0 glass border-t border-white/5 px-6 py-4 flex gap-3">
                    {sttError && (
                        <div role="alert" className="absolute bottom-full inset-x-4 mb-2 rounded-2xl border border-red-500/30 bg-red-950/95 px-4 py-3 text-sm font-bold text-red-100">
                            {sttError}
                        </div>
                    )}
                    <button
                        onClick={toggleRecording}
                        disabled={!authReady?.siteId || !activeAdminId}
                        className={`flex flex-1 items-center justify-center gap-3 py-4 rounded-2xl font-black tap-effect text-center transition-colors ${
                            isRecording
                                ? "bg-red-600 text-white"
                                : "bg-emerald-500 text-slate-950 disabled:bg-slate-800 disabled:text-slate-600"
                        }`}
                    >
                        {isRecording ? (
                            <>
                                <span
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.75)] transition-transform duration-75"
                                    style={{ transform: `scale(${0.85 + Math.min(1, audioLevel) * 1.8})` }}
                                />
                                <span>{common.stop}</span>
                            </>
                        ) : activeAdminId ? (
                            common.speak
                        ) : (
                            common.wait
                        )}
                    </button>
                    <button onClick={() => router.push("/worker")} className="px-6 py-4 glass rounded-2xl border-white/10 text-slate-400 font-black tap-effect text-center">
                        {t.back}
                    </button>
                </div>
            </div>
        </RoleGuard>
    );
}

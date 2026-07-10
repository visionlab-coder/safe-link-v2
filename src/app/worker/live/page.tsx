"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { playPremiumAudio, VoiceGender } from "@/utils/tts";
import { useCloudSTT } from "@/hooks/useCloudSTT";

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

export default function WorkerLivePage() {
    const router = useRouter();
    const [lang, setLang] = useState("ko");
    const [gender] = useState<VoiceGender>("female");
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
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
    const lastTranslationIdRef = useRef(0);
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

        const time = new Date().toLocaleTimeString("ko-KR", {
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
    }, [activeAdminId, authReady]);

    const {
        isRecording,
        toggle: toggleRecording,
        mute: muteRecording,
        unmute: unmuteRecording,
    } = useCloudSTT({
        lang,
        onTranscript: handleWorkerTranscript,
        live: true,
    });

    const processQueue = useCallback(() => {
        if (isPlayingRef.current || ttsQueueRef.current.length === 0) return;
        isPlayingRef.current = true;
        const text = ttsQueueRef.current.shift()!;
        muteRecording();
        playPremiumAudio(text, langRef.current, genderRef.current, () => {
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
                const preferredLang = data.profile?.preferred_lang || "ko";
                setLang(preferredLang);
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

    // Load the backlog once, then receive new translations over Spring SSE.
    useEffect(() => {
        if (!authReady) return;
        const { siteId } = authReady;
        let cancelled = false;
        type TranslationRow = {
            id: string;
            text_ko: string;
            translations?: Record<string, string>;
            created_by?: string;
        };

        const handleTranslation = async (row: TranslationRow) => {
            if (cancelled || seenRowsRef.current.has(row.id)) return;
            seenRowsRef.current.add(row.id);
            lastTranslationIdRef.current = Math.max(lastTranslationIdRef.current, Number(row.id));
            if (row.created_by) setActiveAdminId(row.created_by);
            const cleanTextKo = String(row.text_ko || "").trim().replace(/\s+/g, " ");
            if (!cleanTextKo) return;
            const now = Date.now();
            if (lastRenderedRef.current.text === cleanTextKo && now - lastRenderedRef.current.at < 10_000) return;
            lastRenderedRef.current = { text: cleanTextKo, at: now };
            setIsConnected(true);
            const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

        const loadMissedTranslations = async () => {
            const params = new URLSearchParams({ afterId: String(lastTranslationIdRef.current) });
            if (siteId) params.set("siteId", siteId);
            const res = await fetch(`/api/live/translations?${params.toString()}`, { cache: "no-store" });
            if (!res.ok || cancelled) return;
            const data = await res.json() as { translations?: TranslationRow[] };
            for (const row of data.translations ?? []) {
                await handleTranslation(row);
            }
        };

        const params = new URLSearchParams({ type: "translations" });
        if (siteId) params.set("siteId", siteId);
        const events = new EventSource(`/api/live/events?${params.toString()}`);
        events.addEventListener("translation", event => {
            try {
                void handleTranslation(JSON.parse((event as MessageEvent<string>).data));
            } catch {
                // EventSource reconnects automatically; missed rows are loaded on the next mount.
            }
        });
        void loadMissedTranslations();

        return () => {
            cancelled = true;
            events.close();
        };
    }, [authReady, processQueue]);

    const t = getT(lang);

    return (
        <RoleGuard allowedRole="worker">
            <div className="h-screen bg-mesh text-white font-sans flex flex-col overflow-hidden">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
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
                    <div className="relative h-40 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl shrink-0">
                        <Image src="/images/safelink-pages/live-field-monitoring.png" alt="Live field monitoring" fill className="object-cover" priority />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
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
                                {sub.role === "worker" ? "My voice" : "Manager"}
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
                    <button
                        onClick={toggleRecording}
                        disabled={!authReady?.siteId || !activeAdminId}
                        className={`flex-1 py-4 rounded-2xl font-black tap-effect text-center transition-colors ${
                            isRecording
                                ? "bg-red-600 text-white"
                                : "bg-emerald-500 text-slate-950 disabled:bg-slate-800 disabled:text-slate-600"
                        }`}
                    >
                        {isRecording
                            ? "STOP SPEAKING"
                            : activeAdminId
                                ? "SPEAK TO MANAGER"
                                : "WAITING FOR MANAGER"}
                    </button>
                    <button onClick={() => router.push("/worker")} className="px-6 py-4 glass rounded-2xl border-white/10 text-slate-400 font-black tap-effect text-center">
                        {t.back}
                    </button>
                </div>
            </div>
        </RoleGuard>
    );
}

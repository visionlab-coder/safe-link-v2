"use client";
import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import { normalizeKoAsync } from "@/utils/normalize";
import { motion, AnimatePresence } from "framer-motion";
import { analyzeMessageWithAI } from "@/utils/ai/watchdog";
import { playPremiumAudio, playProxyAudio } from "@/utils/tts";
import { playNotificationSound } from "@/utils/notifications";
import { Trash2, QrCode } from "lucide-react";
import { hangulize } from "@/utils/hangulize";

type ParsedMessage = { norm: string; text: string; pron: string; rev: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
const ui: Record<string, Record<string, string>> = {
    ko: {
        title: "실시간 번역 대화",
        back: "뒤로",
        selectWorker: "대화할 근로자를 선택하세요.",
        search: "이름 검색...",
        noWorkers: "현장에 등록된 근로자가 없습니다.",
        chatPlaceholder: "메시지 입력 (자동 번역/TTS)...",
        listening: "듣고 있습니다...",
        admin: "나 (관리자)",
        pron: "발음",
        rev: "역번역",
        trans: "번역",
    },
    en: {
        title: "Live Translation Chat",
        back: "Back",
        selectWorker: "Select a worker to chat with.",
        search: "Search name...",
        noWorkers: "No workers registered on site.",
        chatPlaceholder: "Type message (auto-translate/TTS)...",
        listening: "Listening...",
        admin: "Me (Admin)",
        pron: "Pronunciation",
        rev: "Reverse Trans",
        trans: "Translation",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

const getVoiceLang = (c: string) => {
    const map: Record<string, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP", ph: "tl-PH" };
    return map[c] || c;
};

type WorkerProfile = { id: string; display_name: string; preferred_lang: string; };
type Message = {
    id: string;
    from_user: string;
    to_user: string;
    source_lang: string;
    target_lang: string;
    source_text: string;
    translated_text: string;
    created_at: string;
    is_read?: boolean;
};

/** translated_text 컬럼을 파싱. 항상 안전하게 객체를 반환 */
const parseMsg = (raw: string | null | undefined): ParsedMessage => {
    if (!raw) return { norm: '', text: '', pron: '', rev: '' };
    try {
        const p = JSON.parse(raw) as Partial<ParsedMessage>;
        return {
            norm: p.norm || '',
            text: p.text || '',
            pron: p.pron || '',
            rev: p.rev || '',
        };
    } catch {
        return { norm: '', text: raw, pron: '', rev: '' };
    }
};

function AdminChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");

    const [adminLang, setAdminLang] = useState("ko");
    const [workers, setWorkers] = useState<WorkerProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeWorker, setActiveWorker] = useState<WorkerProfile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [myId, setMyId] = useState("");
    const triedJitTranslate = useRef<Set<string>>(new Set());
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female'); // Immediately updated
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Helper to change gender: updates ref immediately (no async delay) + state for UI
    const changeGender = (g: 'male' | 'female') => {
        voiceGenderRef.current = g;
        setVoiceGender(g);
        console.log('[Gender] Changed to:', g, '| Ref now:', voiceGenderRef.current);
    };

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setMyId(session.user.id);
            const { data: adminProfile } = await supabase.from("profiles").select("preferred_lang").eq("id", session.user.id).single();
            let finalLang = adminProfile?.preferred_lang || "ko";
            if (urlLang && urlLang !== adminProfile?.preferred_lang) {
                await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
                finalLang = urlLang;
            }
            setAdminLang(finalLang);
        }

        const { data } = await supabase.from("profiles")
            .select("id, display_name, preferred_lang, role")
            .eq("role", "WORKER")
            .not("role", "eq", "ROOT"); // ROOT는 어떤 리스트에서도 제외
        if (data) setWorkers(data);

        // 🆕 새로운 근로자 가입 시 사이드바 실시간 업데이트
        const profileSubscription = supabase
            .channel('sidebar_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: { eventType: string; new: Partial<WorkerProfile> & { role?: string } }) => {
                if (payload.eventType === 'INSERT' && payload.new.role === 'WORKER' && payload.new.id && payload.new.display_name && payload.new.preferred_lang) {
                    setWorkers(prev => [...prev, payload.new as WorkerProfile]);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(profileSubscription); };
    }, [urlLang]);

    const fetchMessages = useCallback(async () => {
        if (!activeWorker || !myId) return;
        const supabase = createClient();
        const { data } = await supabase
            .from("messages")
            .select("*")
            .or(`and(from_user.eq.${myId},to_user.eq.${activeWorker.id}),and(from_user.eq.${activeWorker.id},to_user.eq.${myId})`)
            .order("created_at", { ascending: true });
        if (data) setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

        // Mark as read (is_read 컬럼이 없어도 에러 무시)
        supabase
            .from("messages")
            .update({ is_read: true })
            .eq("from_user", activeWorker.id)
            .eq("to_user", myId)
            .eq("is_read", false)
            .then(() => {});
    }, [activeWorker, myId]);

    const activeWorkerRef = useRef<WorkerProfile | null>(null);
    useEffect(() => {
        activeWorkerRef.current = activeWorker;
        if (activeWorker) {
            setUnreadWorkers(prev => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [activeWorker.id]: _, ...rest } = prev;
                return rest;
            });
            fetchMessages();
        }
    }, [activeWorker, fetchMessages]);

    // 🌍 실시간 미번역 메시지 처리 (근로자 측 번역 누락 대비 JIT 번역)
    useEffect(() => {
        if (!myId) return;
        const translateUntranslated = async () => {
            const untranslated = messages.filter(m => {
                if (m.from_user === myId) return false;
                if (triedJitTranslate.current.has(m.id)) return false;
                const parsed = parseMsg(m.translated_text);
                // 번역이 없거나 원문과 같은 경우(미번역) 처리
                return (!parsed.text || (parsed.text === m.source_text && m.source_lang !== 'ko'));
            });

            if (untranslated.length === 0) return;

            for (const m of untranslated) {
                triedJitTranslate.current.add(m.id);
                // source_lang이 없거나 이미 한국어면 번역 불필요
                if (!m.source_lang || m.source_lang === 'ko') continue;
                try {
                    const res = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: m.source_text, sl: m.source_lang, tl: 'ko' })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const newJson = JSON.stringify({
                            text: data.translated,
                            pron: data.pronunciation,
                            rev: data.reverse_translated
                        });
                        setMessages(prev => prev.map(old => old.id === m.id ? { ...old, translated_text: newJson } : old));
                        const supabase = createClient();
                        await supabase.from("messages").update({ translated_text: newJson }).eq("id", m.id);
                    }
                } catch (e) {
                    console.error("JIT Translation Error:", e);
                }
            }
        };
        translateUntranslated();
    }, [messages, myId]);

    useEffect(() => {
        let cleanup: (() => void) | void;
        void (async () => {
            cleanup = await load();
        })();
        return () => {
            if (cleanup) cleanup();
        };
    }, [load]);

    // 🆕 글로벌 메시지 리스너 (알림 및 읽지 않음 표시용)
    const [unreadWorkers, setUnreadWorkers] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!myId) return;
        const supabase = createClient();

        const channel = supabase
            .channel('global_admin_monitor')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const msg = payload.new as Message;
                if (!msg || msg.from_user === myId) return;

                // 1. 현재 대화 중인 근로자의 메시지라면 메시지 목록 업데이트
                if (activeWorkerRef.current && msg.from_user === activeWorkerRef.current.id) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, ({ ...msg, is_read: true } as Message)];
                    });

                    // Mark as read in DB
                    supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then();
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                } else {
                    // 2. 다른 근로자의 메시지라면 사이드바에 알림 표시
                    setUnreadWorkers(prev => ({ ...prev, [msg.from_user]: (prev[msg.from_user] || 0) + 1 }));
                }

                // 3. AI 분석 수행
                void analyzeMessageWithAI(msg.source_text);

                // 4. 무조건 알림음 발생
                playNotificationSound();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
                const updated = payload.new as Message;
                // '1' 표시 업데이트를 위해 읽음 상태 변경 시 메시지 목록 갱신
                setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, is_read: updated.is_read } : m));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [myId]); // activeWorker에 의존하지 않음

    const playAudio = (text: string, langCode: string) => {
        // 프리미엄 AI 음성을 위해 Proxy(클라우드) 엔진 우선 사용
        const currentGender = voiceGenderRef.current;
        playProxyAudio(text, langCode, currentGender, (success) => {
            if (!success) {
                // 실패 시 브라우저 내장 음성으로 백업
                playPremiumAudio(text, langCode, currentGender);
            }
        });
    };

    const acquireMic = async () => {
        if (!micStreamRef.current) {
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    };

    const toggleRecording = async () => {
        const speechWindow = window as Window & typeof globalThis & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
        };
        const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
            return;
        }

        if (isRecording) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            recognitionRef.current = null;
            setIsRecording(false);
        } else {
            await acquireMic();

            const recognition = new SpeechRecognition();
            recognition.lang = getVoiceLang(adminLang);
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onstart = () => setIsRecording(true);
            recognition.onresult = (event: SpeechRecognitionEventLike) => {
                const lastIdx = event.results.length - 1;
                const result = event.results[lastIdx][0].transcript;
                if (result && result.trim()) {
                    setText(prev => prev ? `${prev} ${result.trim()}` : result.trim());
                }
            };
            recognition.onerror = (event: Event) => {
                console.error("STT Error:", event);
            };
            recognition.onend = () => {
                if (recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch { setIsRecording(false); }
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        }
    };

    const handleSend = async (overrideText?: string | React.MouseEvent) => {
        const messageText = typeof overrideText === 'string' ? overrideText : text;
        if (!messageText.trim() || !activeWorker || !myId || isSending) return;

        const originalText = messageText.trim();
        const tempId = `temp-${Date.now()}`;

        // 🚀 즉시 표시 (번역 전)
        setText("");
        setIsSending(true);
        setMessages(prev => [...prev, {
            id: tempId, from_user: myId, to_user: activeWorker.id,
            source_lang: "ko", target_lang: activeWorker.preferred_lang,
            source_text: originalText,
            translated_text: JSON.stringify({ norm: originalText, text: originalText, pron: "", rev: "" }),
            created_at: new Date().toISOString(),
        }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

        try {
            const { normalized } = await normalizeKoAsync(originalText);
            let translated = normalized;
            let pron = "";
            let rev = "";

            if (activeWorker.preferred_lang !== "ko") {
                try {
                    const transRes = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: normalized, sl: 'ko', tl: activeWorker.preferred_lang })
                    });
                    if (transRes.ok) {
                        const transData = await transRes.json();
                        translated = transData.translated || normalized;
                        pron = transData.pronunciation || "";
                        rev = transData.reverse_translated || "";
                    }
                } catch (e) {
                    console.warn("[AdminChat] 번역 실패 - 원문 전송:", e);
                }
            }

            const supabase = createClient();
            const payload = {
                from_user: myId,
                to_user: activeWorker.id,
                source_lang: "ko",
                target_lang: activeWorker.preferred_lang,
                source_text: originalText,
                translated_text: JSON.stringify({ norm: normalized, text: translated, pron, rev }),
            };

            const { data: inserted, error } = await supabase.from("messages").insert(payload).select().single();
            if (!error && inserted) {
                setMessages(prev => prev.map(m => m.id === tempId ? inserted as Message : m));
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsSending(false);
        }
    };

    const [hiddenWorkers, setHiddenWorkers] = useState<Set<string>>(new Set());
    const [showQR, setShowQR] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("adm_hidden_workers");
        if (saved) setHiddenWorkers(new Set(JSON.parse(saved)));
    }, []);

    const hideWorker = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const next = new Set(hiddenWorkers).add(id);
        setHiddenWorkers(next);
        localStorage.setItem("adm_hidden_workers", JSON.stringify(Array.from(next)));
        if (activeWorker?.id === id) setActiveWorker(null);
    };



    const t = getUI(adminLang);
    // ROOT 제외 + 숨긴 근로자 제외
    const filteredWorkers = workers
        .filter(w => !hiddenWorkers.has(w.id))
        .filter(w => (w.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <RoleGuard allowedRole="admin">
            {/* White/Bright Theme applied to root */}
            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-200">
                <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { if (activeWorker) setActiveWorker(null); else router.back(); }} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors tap-effect text-slate-500 relative">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                            {Object.values(unreadWorkers).reduce((a, b) => a + b, 0) > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[2px] border-white text-white text-[10px] font-black flex items-center justify-center">
                                    {Object.values(unreadWorkers).reduce((a, b) => a + b, 0)}
                                </span>
                            )}
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-slate-800 uppercase">{activeWorker ? activeWorker.display_name : t.title}</span>
                                <span className="px-2 py-0.5 bg-red-500 text-[10px] font-black rounded text-white tracking-widest uppercase animate-pulse">Live</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Voice Gender Switch - Always visible to ensure use in 1:1 and mobile */}
                        <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 shadow-inner">
                            <button
                                onClick={() => changeGender('male')}
                                className={`px-2 py-1 md:px-3 rounded-full text-[9px] md:text-[10px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                MALE
                            </button>
                            <button
                                onClick={() => changeGender('female')}
                                className={`px-2 py-1 md:px-3 rounded-full text-[9px] md:text-[10px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                FEMALE
                            </button>
                        </div>

                        {activeWorker && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowQR(true)}
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-all border border-slate-100"
                                    title="Add Friend QR"
                                >
                                    <QrCode className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => fetchMessages()}
                                    className="p-2 rounded-full hover:bg-slate-100 text-blue-500 transition-all tap-effect border border-slate-100 shadow-sm"
                                    title="Refresh Chat"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 flex w-full max-w-6xl mx-auto h-[calc(100vh-76px)] overflow-hidden bg-white shadow-xl md:my-4 md:h-[calc(100vh-100px)] md:rounded-[40px] border border-slate-100">

                    {/* Worker Sidebar */}
                    <div className={`${activeWorker ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-slate-100 bg-slate-50/50 p-4 h-full overflow-y-auto`}>
                        <div className="mb-6 z-10 sticky top-0 bg-slate-50/90 backdrop-blur-md pb-4 pt-2 border-b border-slate-100">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">{t.title}</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t.search}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-full px-5 py-3 text-sm font-bold placeholder-slate-400 text-slate-800 outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                                <svg className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {filteredWorkers.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 font-bold italic">{t.noWorkers}</div>
                            ) : (
                                filteredWorkers.map(w => (
                                    <div
                                        key={w.id}
                                        onClick={() => setActiveWorker(w)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && setActiveWorker(w)}
                                        className={`group/btn flex items-center gap-4 p-4 rounded-3xl transition-all tap-effect border cursor-pointer ${activeWorker?.id === w.id ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]' : 'bg-white border-transparent shadow-sm hover:shadow hover:bg-slate-50'}`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <Image
                                                src={`https://flagcdn.com/w40/${isoMap[w.preferred_lang] || "un"}.png`}
                                                alt={w.preferred_lang}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 object-cover rounded-full shadow border-2 border-slate-100"
                                                unoptimized
                                            />
                                            {(unreadWorkers[w.id] || 0) > 0 && (
                                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white text-white text-[10px] font-black flex items-center justify-center">
                                                    {unreadWorkers[w.id]}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-start flex-1 overflow-hidden">
                                            <span className={`font-black truncate w-full text-left ${activeWorker?.id === w.id ? 'text-blue-700' : 'text-slate-700'}`}>{w.display_name}</span>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{w.preferred_lang}</span>
                                        </div>
                                        <button
                                            onClick={(e) => hideWorker(e, w.id)}
                                            className="p-2 rounded-full opacity-0 group-hover/btn:opacity-100 hover:bg-red-50 text-red-300 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* QR Modal */}
                    <AnimatePresence>
                        {showQR && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                                onClick={() => setShowQR(false)}
                            >
                                <motion.div
                                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                                    className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">친구 추가 QR</h3>
                                    <div className="bg-slate-50 p-6 rounded-[32px] border-4 border-slate-100 shadow-inner">
                                        <Image
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/worker/chat?add_friend=${myId}`)}`}
                                            alt="Add Friend QR"
                                            width={250}
                                            height={250}
                                            className="w-48 h-48 md:w-64 md:h-64"
                                            unoptimized
                                        />
                                    </div>
                                    <p className="text-center text-slate-500 font-bold leading-tight">
                                        이 관리자를 근로자의 대화 목록에<br />추가하려면 QR 코드를 스캔하세요.
                                    </p>
                                    <button
                                        onClick={() => setShowQR(false)}
                                        className="w-full py-4 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                                    >
                                        닫기
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Chat Area */}
                    <div className={`${!activeWorker ? 'hidden' : 'flex'} flex-col flex-1 bg-[#f8fafc] h-full relative`}>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(circle at center, #e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                            <AnimatePresence initial={false}>
                                {messages.map((m, i) => {
                                    const isAdmin = m.from_user === myId;
                                    const parsed = parseMsg(m.translated_text);

                                    return (
                                        <motion.div
                                            key={m.id || i}
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'} landscape:max-w-[95%]`}
                                        >
                                            <div className={`flex items-center gap-2 mb-1 ${isAdmin ? 'mr-2' : 'ml-2'}`}>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {isAdmin ? t.admin : activeWorker?.display_name}
                                                </span>
                                                <button
                                                    onClick={() => playAudio(
                                                        isAdmin ? (parsed.text || m.source_text) : (parsed.text || m.source_text),
                                                        isAdmin ? (activeWorker?.preferred_lang || "ko") : "ko"
                                                    )}
                                                    className="text-blue-500 hover:text-blue-600 tap-effect bg-white outline-none rounded-full p-1 shadow-sm border border-slate-200"
                                                >
                                                    <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                </button>
                                            </div>

                                            <div className={`p-5 rounded-3xl shadow-md border flex flex-col gap-3 ${isAdmin ? 'bg-blue-600 border-blue-700 rounded-tr-sm text-white' : 'bg-white border-slate-200 rounded-tl-sm text-slate-800'}`}>

                                                {isAdmin ? (
                                                    // ── 관리자 메시지: 원문(한국어) → 한글발음 → 번역(외국어) → 역번역 ──
                                                    <>
                                                        {/* 1. 한국어 원문 (맨 위, 가장 크게) */}
                                                        <div className="flex flex-col gap-1">
                                                            <p className="font-black text-xl md:text-2xl landscape:text-4xl whitespace-pre-wrap leading-snug drop-shadow-sm">
                                                                {m.source_text}
                                                            </p>
                                                            {m.is_read === false && (
                                                                <span className="text-[10px] font-black text-amber-300 self-end mr-1 leading-none">1</span>
                                                            )}
                                                        </div>

                                                        <div className="pt-3 border-t border-blue-400/50 flex flex-col gap-2">
                                                            {/* 2. 한글 발음 */}
                                                            {(() => {
                                                                const pron = parsed.pron || hangulize(parsed.text, activeWorker?.preferred_lang || "en");
                                                                return pron ? (
                                                                    <div className="flex items-start gap-1.5">
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-white/20 text-white shrink-0 mt-0.5 font-black">{t.pron}</span>
                                                                        <span className="font-bold text-base opacity-90">{pron}</span>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                            {/* 3. 번역 (외국어) */}
                                                            <div className="flex items-start gap-1.5">
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-white/20 text-white shrink-0 mt-0.5 font-black">{t.trans}</span>
                                                                <span className="font-bold text-lg landscape:text-2xl">{parsed.text}</span>
                                                            </div>
                                                            {/* 4. 역번역 */}
                                                            {parsed.rev && (
                                                                <div className="flex items-start gap-1.5">
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-white/20 text-white shrink-0 mt-0.5 font-black">{t.rev}</span>
                                                                    <span className="font-bold text-base opacity-80">{parsed.rev}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    // ── 근로자 메시지: 한국어 번역문(메인) + 하단에 원문(외국어) ──
                                                    <>
                                                        <div className="flex flex-col gap-1">
                                                            <p className="font-black text-xl md:text-2xl landscape:text-4xl whitespace-pre-wrap leading-snug drop-shadow-sm">
                                                                {parsed.text || m.source_text}
                                                            </p>
                                                        </div>
                                                        {m.source_text !== parsed.text && m.source_lang !== 'ko' && (
                                                            <div className="pt-3 border-t border-slate-100 flex items-start gap-1.5">
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 shrink-0 mt-0.5 font-black">原文</span>
                                                                <span className="font-bold text-lg landscape:text-2xl text-slate-500">{m.source_text}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <span className={`text-[10px] text-slate-400 font-bold mt-1 ${isAdmin ? 'mr-2' : 'ml-2'} landscape:text-base`}>
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] flex gap-2 items-center">

                            <button
                                onClick={toggleRecording}
                                className={`p-5 rounded-full shadow-md shrink-0 transition-all tap-effect flex items-center justify-center border-2 ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-blue-500'}`}
                            >
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                            </button>

                            <div className="relative flex flex-1 items-center bg-slate-50 border-2 border-slate-200 rounded-[36px] overflow-hidden focus-within:border-blue-500 focus-within:bg-white transition-all shadow-inner">
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder={isRecording ? t.listening : t.chatPlaceholder}
                                    className="w-full bg-transparent p-5 pl-8 text-slate-800 text-lg landscape:text-2xl font-black outline-none resize-none max-h-32 min-h-[64px] placeholder-slate-400"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!text.trim() || isSending}
                                    className="mr-3 bg-blue-600 text-white p-4 rounded-full transition-all disabled:opacity-40 disabled:bg-slate-300 tap-effect shadow-md flex items-center justify-center"
                                >
                                    {isSending ? (
                                        <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-7 h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {!activeWorker && (
                        <div className="hidden md:flex flex-col flex-1 items-center justify-center p-8 text-center gap-6 bg-[#f8fafc]">
                            <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 shadow-inner">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                            </div>
                            <h2 className="text-2xl font-black text-slate-400">{t.selectWorker}</h2>
                        </div>
                    )}
                </main>
            </div>

            <style jsx global>{`
                /* Hide scrollbar for a cleaner look */
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}</style>
        </RoleGuard>
    );
}

export default function AdminChat() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <AdminChatContent />
        </Suspense>
    );
}

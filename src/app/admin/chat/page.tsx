"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import { normalizeKoAsync } from "@/utils/normalize";
import { hangulize } from "@/utils/hangulize";

const ui: Record<string, any> = {
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
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

const getVoiceLang = (c: string) => {
    const map: any = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP", ph: "tl-PH" };
    return map[c] || c;
};

type WorkerProfile = { id: string; display_name: string; preferred_lang: string; };
type Message = { id: string; from_user: string; to_user: string; source_text: string; translated_text: string; created_at: string; };

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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const [myId, setMyId] = useState("");

    const load = async () => {
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

        const { data } = await supabase.from("profiles").select("id, display_name, preferred_lang").eq("role", "WORKER");
        if (data) setWorkers(data);
    };

    useEffect(() => { load(); }, [urlLang]);

    useEffect(() => {
        if (!activeWorker || !myId) return;
        const supabase = createClient();

        const fetchMessages = async () => {
            const { data } = await supabase
                .from("messages")
                .select("*")
                .or(`and(from_user.eq.${myId},to_user.eq.${activeWorker.id}),and(from_user.eq.${activeWorker.id},to_user.eq.${myId})`)
                .order("created_at", { ascending: true });
            if (data) setMessages(data);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        };
        fetchMessages();

        const channel = supabase
            .channel(`admin_realtime_${myId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "messages" },
                (payload) => {
                    const msg = payload.new as Message;
                    if (!msg || !msg.id) return;
                    // Check if message belongs to the current conversation with activeWorker
                    if (activeWorker && ((msg.from_user === myId && msg.to_user === activeWorker.id) || (msg.from_user === activeWorker.id && msg.to_user === myId))) {
                        setMessages(prev => {
                            if (prev.find(m => m.id === msg.id)) return prev;
                            const isDup = prev.findIndex(m => String(m.id).startsWith("temp-") && m.source_text === msg.source_text && m.from_user === msg.from_user);
                            if (isDup !== -1) {
                                const newArr = [...prev];
                                newArr[isDup] = msg;
                                return newArr;
                            }
                            return [...prev, msg];
                        });
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

                        // AUTO TTS for INCOMING message from worker (Admin hears Korean)
                        if (msg.from_user === activeWorker.id) {
                            let speakText = msg.translated_text as any;
                            try {
                                const p = typeof speakText === "string" ? JSON.parse(speakText) : speakText;
                                speakText = p.text; // Korean
                            } catch (e) {
                                speakText = String(speakText);
                            }
                            if (speakText && typeof speakText === "string") {
                                window.speechSynthesis.cancel();
                                const utter = new SpeechSynthesisUtterance(speakText);
                                utter.lang = getVoiceLang("ko");
                                utter.rate = 0.95;
                                window.speechSynthesis.speak(utter);
                            }
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime Admin] Subscription Status for ${myId} -> ${activeWorker?.id}: ${status}`);
            });

        return () => { supabase.removeChannel(channel); };
    }, [activeWorker, myId]);

    const playAudio = (text: string, langCode: string) => {
        if (!text) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = getVoiceLang(langCode);
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
    };

    const toggleRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert("Not supported in this browser."); return; }

        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            const recognition = new SpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = true;
            recognition.interimResults = false;
            recognitionRef.current = recognition;
            recognition.start();
            setIsRecording(true);
            recognition.onresult = (event: any) => {
                let txt = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) txt += event.results[i][0].transcript;
                if (txt.trim()) setText((prev) => prev ? prev + " " + txt.trim() : txt.trim());
            };
            recognition.onerror = () => setIsRecording(false);
            recognition.onend = () => setIsRecording(false);
        }
    };

    const handleSend = async () => {
        if (!text.trim() || !activeWorker || !myId) return;
        setIsSending(true);
        try {
            const { normalized, changes } = await normalizeKoAsync(text.trim());

            let translated = normalized;
            let pron = "";
            let rev = "";
            let foreignSlang = "";

            if (activeWorker.preferred_lang !== "ko") {
                // 1. Target Trans + Pron
                const dtUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${activeWorker.preferred_lang}&dt=t&dt=rm&q=${encodeURIComponent(normalized)}`;
                const transRes = await fetch(dtUrl);
                const transData = await transRes.json();
                translated = transData[0].map((item: any) => item[0]).join("");

                // Correct Pronunciation (Transliteration) logic: find block where segment[0] is null
                if (transData[0]) {
                    const translitBlock = transData[0].find((item: any) => item[0] === null && item[2]);
                    if (translitBlock) pron = translitBlock[2];
                    // Fallback to source translit if target not found (rare)
                    if (!pron && translitBlock && translitBlock[3]) pron = translitBlock[3];
                }

                // Convert Romanized Pronunciation to Hangul sounds
                if (pron) {
                    pron = hangulize(pron, activeWorker.preferred_lang);
                }

                // 2. Reverse Trans
                const revUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${activeWorker.preferred_lang}&tl=ko&dt=t&q=${encodeURIComponent(translated)}`;
                const revRes = await fetch(revUrl);
                const revData = await revRes.json();
                rev = revData[0].map((item: any) => item[0]).join("");

                // Foreign Slang Simulation (Just add an indicator to show it's localized to field terms)
                foreignSlang = translated + " (Field)";
            } else {
                foreignSlang = translated;
            }

            const supabase = createClient();
            const payload = {
                from_user: myId,
                to_user: activeWorker.id,
                source_lang: "ko",
                target_lang: activeWorker.preferred_lang,
                source_text: text.trim(), // 원문 저장
                translated_text: JSON.stringify({
                    norm: normalized,
                    text: foreignSlang, // 외국 현장 은어 적용본 
                    pron,
                    rev
                }),
            };

            await supabase.from("messages").insert(payload);
            // Optimistic update
            setMessages(prev => [...prev, { ...payload, id: `temp-${Date.now()}`, created_at: new Date().toISOString() } as any]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

            setText("");
            if (isRecording) toggleRecording();

            // Auto TTS for outgoing message (Admin's phone speaks the foreign language so the worker next to them can hear)
            if (translated && activeWorker.preferred_lang !== "ko") {
                playAudio(translated, activeWorker.preferred_lang);
            }
        } catch (e) {
            console.error(e);
            alert("전송 중 오류가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(adminLang);
    const filteredWorkers = workers.filter(w => (w.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()));

    // Safe JSON parser for display
    const parseMsg = (raw: any) => {
        if (!raw) return { text: "", pron: "", rev: "" };
        if (typeof raw === "object") return raw;
        try { return JSON.parse(raw); }
        catch { return { text: String(raw), pron: "", rev: "" }; }
    };

    return (
        <RoleGuard allowedRole="admin">
            {/* White/Bright Theme applied to root */}
            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-200">
                <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { if (activeWorker) setActiveWorker(null); else router.back(); }} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors tap-effect text-slate-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-slate-800 uppercase">{activeWorker ? activeWorker.display_name : t.title}</span>
                                <span className="px-2 py-0.5 bg-red-500 text-[10px] font-black rounded text-white tracking-widest uppercase animate-pulse">Live</span>
                            </div>
                        </div>
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
                                    <button
                                        key={w.id}
                                        onClick={() => setActiveWorker(w)}
                                        className={`flex items-center gap-4 p-4 rounded-3xl transition-all tap-effect border ${activeWorker?.id === w.id ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]' : 'bg-white border-transparent shadow-sm hover:shadow hover:bg-slate-50'}`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img src={`https://flagcdn.com/w40/${isoMap[w.preferred_lang] || "un"}.png`} alt={w.preferred_lang} className="w-10 h-10 object-cover rounded-full shadow border-2 border-slate-100" />
                                        </div>
                                        <div className="flex flex-col items-start flex-1 overflow-hidden">
                                            <span className={`font-black truncate w-full text-left ${activeWorker?.id === w.id ? 'text-blue-700' : 'text-slate-700'}`}>{w.display_name}</span>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{w.preferred_lang}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className={`${!activeWorker ? 'hidden' : 'flex'} flex-col flex-1 bg-[#f8fafc] h-full relative`}>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(circle at center, #e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                            {messages.map((m, i) => {
                                const isAdmin = m.from_user === myId;
                                const parsed = parseMsg(m.translated_text);

                                return (
                                    <div key={m.id || i} className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'} landscape:max-w-[95%]`}>
                                        <div className={`flex items-center gap-2 mb-1 ${isAdmin ? 'mr-2' : 'ml-2'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {isAdmin ? t.admin : activeWorker?.display_name}
                                            </span>
                                            <button onClick={() => playAudio(isAdmin ? parsed.text : parsed.text, isAdmin ? activeWorker?.preferred_lang || "ko" : "ko")} className="text-blue-500 hover:text-blue-600 tap-effect bg-white outline-none rounded-full p-1 shadow-sm border border-slate-200">
                                                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </button>
                                        </div>

                                        <div className={`p-5 rounded-3xl shadow-md border flex flex-col gap-3 ${isAdmin ? 'bg-blue-600 border-blue-700 rounded-tr-sm text-white' : 'bg-white border-slate-200 rounded-tl-sm text-slate-800'}`}>

                                            {/* Source Text (Korean for Admin, Foreign for Worker) as Big Text */}
                                            <p className="font-black text-xl md:text-2xl landscape:text-4xl whitespace-pre-wrap leading-snug drop-shadow-sm">
                                                {isAdmin ? m.source_text : parsed.text}
                                            </p>

                                            {/* Advanced AI Translation Area */}
                                            {parsed.text && (
                                                <div className={`pt-3 border-t flex flex-col gap-1.5 ${isAdmin ? 'border-blue-400/50' : 'border-slate-100'}`}>

                                                    {isAdmin && parsed.norm && parsed.norm !== m.source_text && (
                                                        <div className="flex items-center gap-1.5 opacity-90 mb-1">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-emerald-500/20 text-emerald-100' : 'bg-emerald-100 text-emerald-700'}`}>표준어</span>
                                                            <span className={`text-sm font-bold ${isAdmin ? 'text-emerald-100' : 'text-emerald-700'}`}>{parsed.norm}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-1.5 opacity-90">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                            {isAdmin ? '현장용어' : '原文'}
                                                        </span>
                                                        <span className="font-bold text-lg landscape:text-2xl">
                                                            {isAdmin ? parsed.text : m.source_text}
                                                        </span>
                                                    </div>

                                                    {parsed.pron && (
                                                        <div className="flex items-center gap-1.5 opacity-80 mt-1">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-white/10' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{t.pron}</span>
                                                            <span className="text-sm font-medium italic landscape:text-xl tracking-wide">{parsed.pron}</span>
                                                        </div>
                                                    )}

                                                    {parsed.rev && (
                                                        <div className="flex items-start gap-1.5 opacity-80 mt-1">
                                                            <span className={`px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isAdmin ? 'bg-black/20 text-blue-100' : 'bg-amber-100 text-amber-700'}`}>{t.rev}</span>
                                                            <span className="text-sm font-bold landscape:text-xl">{parsed.rev}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[10px] text-slate-400 font-bold mt-1 ${isAdmin ? 'mr-2' : 'ml-2'} landscape:text-base`}>
                                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] flex gap-2 items-center">

                            <button
                                onClick={toggleRecording}
                                className={`p-5 rounded-full shadow-md shrink-0 transition-all tap-effect flex items-center justify-center border-2 ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-blue-500'}`}
                            >
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
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
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
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

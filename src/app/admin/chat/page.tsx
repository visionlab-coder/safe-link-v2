"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const ui: Record<string, any> = {
    ko: {
        title: "실시간 번역 대화",
        back: "뒤로",
        selectWorker: "대화할 근로자를 선택하세요.",
        search: "이름 검색...",
        noWorkers: "현장에 등록된 근로자가 없습니다.",
        chatPlaceholder: "메시지 입력 (자동 번역됨)...",
        send: "전송",
        listening: "듣고 있습니다...",
        admin: "나 (관리자)",
    },
    en: {
        title: "Live Translation Chat",
        back: "Back",
        selectWorker: "Select a worker to chat with.",
        search: "Search name...",
        noWorkers: "No workers registered on site.",
        chatPlaceholder: "Type message (auto-translated)...",
        send: "Send",
        listening: "Listening...",
        admin: "Me (Admin)",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
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

        // Load workers
        const { data } = await supabase.from("profiles").select("id, display_name, preferred_lang").eq("role", "WORKER");
        if (data) setWorkers(data);
    };

    useEffect(() => { load(); }, [urlLang]);

    useEffect(() => {
        if (!activeWorker || !myId) return;
        const supabase = createClient();

        // Initial fetch
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

        // Subscribe to real-time messages
        const channel = supabase
            .channel(`admin_chat_${activeWorker.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                (payload) => {
                    const msg = payload.new as Message;
                    if ((msg.from_user === myId && msg.to_user === activeWorker.id) || (msg.from_user === activeWorker.id && msg.to_user === myId)) {
                        setMessages(prev => [...prev, msg]);
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeWorker, myId]);

    const handleSend = async () => {
        if (!text.trim() || !activeWorker || !myId) return;
        setIsSending(true);
        try {
            const supabase = createClient();

            // translate to activeWorker's language
            // For MVP client-side API call (in production, use robust backend)
            let translated = text.trim();
            if (activeWorker.preferred_lang !== "ko") {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${activeWorker.preferred_lang}&dt=t&q=${encodeURIComponent(text.trim())}`;
                const res = await fetch(url);
                const data = await res.json();
                translated = data[0].map((item: any) => item[0]).join("");
            }

            const payload = {
                from_user: myId,
                to_user: activeWorker.id,
                source_lang: "ko",
                target_lang: activeWorker.preferred_lang,
                source_text: text.trim(),
                translated_text: translated,
            };

            await supabase.from("messages").insert(payload);
            setText("");
        } catch (e) {
            console.error(e);
            alert("전송 중 오류가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(adminLang);
    const filteredWorkers = workers.filter(w => (w.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-4 md:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { if (activeWorker) setActiveWorker(null); else router.back(); }} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">{activeWorker ? activeWorker.display_name : "AI Chat"}</span>
                                <span className="px-2 py-0.5 bg-blue-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Live</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex w-full max-w-5xl mx-auto h-[calc(100vh-76px)] overflow-hidden">
                    {/* Worker List (Sidebar on desktop, full on mobile if none selected) */}
                    <div className={`${activeWorker ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-white/5 bg-slate-900/40 p-4 h-full overflow-y-auto`}>
                        <div className="mb-6 z-10 sticky top-0 bg-[#020617]/80 backdrop-blur-md pb-4 pt-2">
                            <h2 className="text-2xl font-black text-white text-gradient uppercase tracking-tight mb-4">{t.title}</h2>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t.search}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-full px-5 py-3 text-sm font-bold placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                                />
                                <svg className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {filteredWorkers.length === 0 ? (
                                <div className="text-center py-10 text-slate-600 font-bold italic">{t.noWorkers}</div>
                            ) : (
                                filteredWorkers.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => setActiveWorker(w)}
                                        className={`flex items-center gap-4 p-4 rounded-3xl transition-all tap-effect border ${activeWorker?.id === w.id ? 'glass border-blue-500/30 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]' : 'border-transparent hover:bg-white/5'}`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img src={`https://flagcdn.com/w40/${isoMap[w.preferred_lang] || "un"}.png`} alt={w.preferred_lang} className="w-10 h-10 object-cover rounded-full shadow border-2 border-slate-800" />
                                        </div>
                                        <div className="flex flex-col items-start flex-1 overflow-hidden">
                                            <span className="font-black text-slate-100 truncate w-full text-left">{w.display_name}</span>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{w.preferred_lang}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className={`${!activeWorker ? 'hidden' : 'flex'} flex-col flex-1 bg-black/20 h-full relative`}>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6">
                            {messages.map((m, i) => {
                                const isAdmin = m.from_user === myId;
                                return (
                                    <div key={m.id || i} className={`flex flex-col max-w-[85%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'}`}>
                                        <span className={`text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ${isAdmin ? 'mr-2' : 'ml-2'}`}>
                                            {isAdmin ? t.admin : activeWorker?.display_name}
                                        </span>
                                        <div className={`p-5 rounded-3xl shadow-xl border ${isAdmin ? 'bg-blue-600 border-blue-500 rounded-tr-sm text-blue-50' : 'glass border-white/10 rounded-tl-sm text-slate-200'}`}>
                                            <p className="font-bold text-lg whitespace-pre-wrap leading-relaxed">{m.source_text}</p>
                                            {m.translated_text && m.source_text !== m.translated_text && (
                                                <div className={`mt-3 pt-3 border-t text-sm font-medium italic opacity-80 ${isAdmin ? 'border-blue-500/50' : 'border-white/10'}`}>
                                                    {m.translated_text}
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[10px] text-slate-600 font-bold mt-1 ${isAdmin ? 'mr-2' : 'ml-2'}`}>
                                            {new Date(m.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 md:p-6 glass border-t border-white/10 shrink-0">
                            <div className="relative flex items-center bg-slate-900 border border-slate-700 rounded-[32px] overflow-hidden focus-within:border-blue-500 transition-colors shadow-inner">
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder={t.chatPlaceholder}
                                    className="w-full bg-transparent p-4 pl-6 text-white font-bold outline-none resize-none max-h-32 min-h-[56px]"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!text.trim() || isSending}
                                    className="mr-3 glass p-3 rounded-full text-blue-400 hover:text-white hover:bg-blue-600 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-blue-400 tap-effect"
                                >
                                    {isSending ? (
                                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Placeholder when no worker selected (Desktop) */}
                    {!activeWorker && (
                        <div className="hidden md:flex flex-col flex-1 items-center justify-center p-8 text-center gap-6 glass/10 opacity-60">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-slate-600 border border-white/5">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                            </div>
                            <h2 className="text-2xl font-black text-slate-400">{t.selectWorker}</h2>
                        </div>
                    )}
                </main>
            </div>
        </RoleGuard>
    );
}

export default function AdminChat() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <AdminChatContent />
        </Suspense>
    );
}

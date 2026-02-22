"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const ui: Record<string, any> = {
    ko: {
        title: "실시간 대화",
        chatPlaceholder: "메시지 입력...",
        adminName: "관리자",
        me: "나",
    },
    en: {
        title: "Live Chat",
        chatPlaceholder: "Type message...",
        adminName: "Admin",
        me: "Me",
    },
    zh: {
        title: "实时聊天",
        chatPlaceholder: "输入消息...",
        adminName: "管理员",
        me: "我",
    },
    vi: {
        title: "Trò chuyện",
        chatPlaceholder: "Nhập tin nhắn...",
        adminName: "Quản lý",
        me: "Tôi",
    },
    th: {
        title: "แชทสด",
        chatPlaceholder: "พิมพ์ข้อความ...",
        adminName: "ผู้ดูแลระบบ",
        me: "ฉัน",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

type Message = { id: string; from_user: string; to_user: string; source_text: string; translated_text: string; created_at: string; };

function WorkerChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");

    const [lang, setLang] = useState("ko");
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [myId, setMyId] = useState("");
    const [adminId, setAdminId] = useState("");

    const load = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setMyId(session.user.id);

        // Handle Lang Sync
        const { data: profile } = await supabase.from("profiles").select("preferred_lang, site_id").eq("id", session.user.id).single();
        let finalLang = profile?.preferred_lang || "ko";
        if (urlLang && urlLang !== profile?.preferred_lang) {
            await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
            finalLang = urlLang;
        }
        setLang(finalLang);

        // Find Admin
        let query = supabase.from("profiles").select("id").eq("role", "HQ_ADMIN").limit(1);
        if (profile?.site_id) query = (query as any).eq("site_id", profile.site_id);
        const { data: adminData } = await (query as any);
        const aId = adminData?.[0]?.id;
        if (aId) setAdminId(aId);
    };

    useEffect(() => { load(); }, [urlLang]);

    useEffect(() => {
        if (!adminId || !myId) return;
        const supabase = createClient();

        // Initial fetch
        const fetchMessages = async () => {
            const { data } = await supabase
                .from("messages")
                .select("*")
                .or(`and(from_user.eq.${myId},to_user.eq.${adminId}),and(from_user.eq.${adminId},to_user.eq.${myId})`)
                .order("created_at", { ascending: true });
            if (data) setMessages(data);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        };
        fetchMessages();

        // Subscribe to real-time messages
        // Worker channel listens to messages sent to them or from them
        const channel = supabase
            .channel(`worker_chat_${myId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                (payload) => {
                    const msg = payload.new as Message;
                    if ((msg.from_user === myId && msg.to_user === adminId) || (msg.from_user === adminId && msg.to_user === myId)) {
                        setMessages(prev => [...prev, msg]);
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [adminId, myId]);

    const handleSend = async () => {
        if (!text.trim() || !adminId || !myId) return;
        setIsSending(true);
        try {
            const supabase = createClient();

            // translate to Korean (Admin's expected language)
            let translated = text.trim();
            if (lang !== "ko") {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ko&dt=t&q=${encodeURIComponent(text.trim())}`;
                const res = await fetch(url);
                const data = await res.json();
                translated = data[0].map((item: any) => item[0]).join("");
            }

            const payload = {
                from_user: myId,
                to_user: adminId,
                source_lang: lang,
                target_lang: "ko",
                source_text: text.trim(),
                translated_text: translated,
            };

            await supabase.from("messages").insert(payload);
            setText("");
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(lang);

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-mesh text-white font-sans flex flex-col selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black tracking-tight text-white uppercase italic">{t.adminName}</span>
                                <span className="px-2 py-0.5 bg-green-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-[calc(100vh-76px)] overflow-hidden relative">
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 pb-8">
                        {messages.map((m, i) => {
                            const isMe = m.from_user === myId;
                            return (
                                <div key={m.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                    <span className={`text-xs font-black uppercase tracking-widest text-slate-500 mb-1 ${isMe ? 'mr-2' : 'ml-2'}`}>
                                        {isMe ? t.me : t.adminName}
                                    </span>
                                    <div className={`p-4 rounded-[28px] shadow-xl border ${isMe ? 'bg-blue-600 border-blue-500 rounded-tr-sm text-white' : 'glass border-white/10 rounded-tl-sm text-slate-200'}`}>
                                        <p className="font-bold text-xl md:text-2xl leading-snug whitespace-pre-wrap">{isMe ? m.source_text : (m.translated_text || m.source_text)}</p>
                                    </div>
                                    <span className={`text-[10px] items-center gap-1 flex text-slate-600 font-bold mt-1 ${isMe ? 'mr-2' : 'ml-2'}`}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 glass shrink-0 relative z-20 shadow-[0_-20px_40px_rgba(2,6,23,0.8)]">
                        <div className="relative flex items-center bg-slate-800/80 border-2 border-slate-700/80 rounded-[36px] overflow-hidden focus-within:border-blue-500 transition-colors shadow-inner">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={t.chatPlaceholder}
                                className="w-full bg-transparent p-5 pl-6 text-white text-lg font-bold outline-none resize-none max-h-32 min-h-[64px]"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!text.trim() || isSending}
                                className="mr-3 bg-blue-600 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:bg-slate-700 tap-effect shadow-md"
                            >
                                {isSending ? (
                                    <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-7 h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}

export default function WorkerChat() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <WorkerChatContent />
        </Suspense>
    );
}

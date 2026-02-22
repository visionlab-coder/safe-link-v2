"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const ui: Record<string, any> = {
    ko: {
        title: "관리자 대화창",
        chatPlaceholder: "메시지 입력 (자동 번역/TTS)...",
        listening: "듣고 있습니다...",
        adminName: "관리자",
        me: "근로자 (나)",
        pron: "발음",
        rev: "역번역",
    },
    en: {
        title: "Admin Chat",
        chatPlaceholder: "Type message (Automated)...",
        listening: "Listening...",
        adminName: "Admin",
        me: "Worker (Me)",
        pron: "Pronunciation",
        rev: "Reverse Trans",
    },
    zh: {
        title: "管理员对话",
        chatPlaceholder: "输入消息（自动翻译/语音）...",
        listening: "正在倾听...",
        adminName: "管理员",
        me: "工人 (我)",
        pron: "发音",
        rev: "反向翻译",
    },
    vi: {
        title: "Trò chuyện quản lý",
        chatPlaceholder: "Nhập tin nhắn (dịch tự động)...",
        listening: "Đang nghe...",
        adminName: "Quản lý",
        me: "Công nhân (Tôi)",
        pron: "Phát âm",
        rev: "Dịch ngược",
    },
    th: {
        title: "แชทผู้ดูแลระบบ",
        chatPlaceholder: "พิมพ์ข้อความ (แปลอัตโนมัติ)...",
        listening: "กำลังฟัง...",
        adminName: "ผู้ดูแล",
        me: "คนงาน (ฉัน)",
        pron: "การออกเสียง",
        rev: "แปลย้อนกลับ",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

const getVoiceLang = (c: string) => {
    const map: any = { ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP", ph: "tl-PH" };
    return map[c] || c;
};

type Message = { id: string; from_user: string; to_user: string; source_text: string; translated_text: string; created_at: string; };

function WorkerChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");

    const [lang, setLang] = useState("ko");
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    const [myId, setMyId] = useState("");
    const [adminId, setAdminId] = useState("");

    const load = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setMyId(session.user.id);

        const { data: profile } = await supabase.from("profiles").select("preferred_lang, site_id").eq("id", session.user.id).single();
        let finalLang = profile?.preferred_lang || "ko";
        if (urlLang && urlLang !== profile?.preferred_lang) {
            await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
            finalLang = urlLang;
        }
        setLang(finalLang);

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

                        // AUTO TTS for INCOMING message (Admin speaks to Worker Native)
                        if (msg.from_user === adminId) {
                            let speakText = msg.translated_text as any;
                            try {
                                const p = typeof speakText === "string" ? JSON.parse(speakText) : speakText;
                                speakText = p.text;
                            } catch (e) {
                                speakText = String(speakText);
                            }
                            if (speakText && typeof speakText === "string") {
                                window.speechSynthesis.cancel();
                                const utter = new SpeechSynthesisUtterance(speakText);
                                utter.lang = getVoiceLang(lang);
                                utter.rate = 0.95;
                                window.speechSynthesis.speak(utter);
                            }
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [adminId, myId, lang]);

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
            recognition.lang = getVoiceLang(lang);
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
        if (!text.trim() || !adminId || !myId) return;
        setIsSending(true);
        try {
            let translated = text.trim();
            let pron = "";
            let rev = "";
            let normalizedInput = text.trim();

            if (lang !== "ko") {
                // 1. Target Trans (to ko) + Pron
                const dtUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ko&dt=t&dt=rm&q=${encodeURIComponent(text.trim())}`;
                const transRes = await fetch(dtUrl);
                const transData = await transRes.json();
                translated = transData[0].map((item: any) => item[0]).join("");

                const pronParts = transData[0].map((item: any) => item[1]).filter(Boolean);
                if (pronParts.length > 0) pron = pronParts.join(" ");

                // 2. Reverse Trans (back to worker lang)
                const revUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${lang}&dt=t&q=${encodeURIComponent(translated)}`;
                const revRes = await fetch(revUrl);
                const revData = await revRes.json();
                rev = revData[0].map((item: any) => item[0]).join("");
            }

            const supabase = createClient();
            const payload = {
                from_user: myId,
                to_user: adminId,
                source_lang: lang,
                target_lang: "ko",
                source_text: text.trim(),
                translated_text: JSON.stringify({
                    text: translated, // Korean output
                    pron,
                    rev
                }),
            };

            await supabase.from("messages").insert(payload);
            setText("");
            if (isRecording) toggleRecording();

            // Auto TTS for outgoing message (Worker's phone speaks Korean so the Admin next to them can hear)
            if (translated) {
                playAudio(translated, "ko");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    const t = getUI(lang);
    const parseMsg = (raw: any) => {
        if (!raw) return { text: "", pron: "", rev: "" };
        if (typeof raw === "object") return raw;
        try { return JSON.parse(raw); }
        catch { return { text: String(raw), pron: "", rev: "" }; }
    };

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-200">
                <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors tap-effect text-slate-500">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black tracking-tight text-slate-800 uppercase">{t.adminName}</span>
                                <span className="px-2 py-0.5 bg-green-500 text-[10px] font-black rounded text-white tracking-widest uppercase animate-pulse">Online</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-[calc(100vh-76px)] overflow-hidden relative bg-[#f8fafc]">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-8" style={{ backgroundImage: 'radial-gradient(circle at center, #e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                        {messages.map((m, i) => {
                            const isMe = m.from_user === myId;
                            const parsed = parseMsg(m.translated_text);

                            return (
                                <div key={m.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'} landscape:max-w-[95%]`}>
                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'mr-2' : 'ml-2'}`}>
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                            {isMe ? t.me : t.adminName}
                                        </span>
                                        <button onClick={() => playAudio(isMe ? parsed.text : parsed.text, isMe ? "ko" : lang)} className="text-blue-500 hover:text-blue-600 tap-effect bg-white outline-none rounded-full p-1 shadow-sm border border-slate-200">
                                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </button>
                                    </div>

                                    <div className={`p-5 md:p-6 rounded-[32px] shadow-lg border flex flex-col gap-3 ${isMe ? 'bg-blue-600 border-blue-700 rounded-tr-sm text-white' : 'bg-white border-slate-400 rounded-tl-sm text-slate-800'}`}>

                                        {/* Source Text (Foreign Language always as Main big text) */}
                                        <p className="font-black text-2xl md:text-3xl landscape:text-5xl leading-snug whitespace-pre-wrap drop-shadow-sm">
                                            {isMe ? m.source_text : (parsed.text || m.source_text)}
                                        </p>

                                        {/* Translation Details Area (Korean text always underneath) */}
                                        {parsed.text && (
                                            <div className={`pt-3 mt-1 border-t flex flex-col gap-1.5 ${isMe ? 'border-blue-400/50' : 'border-slate-200'}`}>

                                                {/* If Admin's message, show standard form if it differs from source text */}
                                                {!isMe && parsed.norm && parsed.norm !== m.source_text && (
                                                    <div className="flex items-center gap-1.5 opacity-90 mb-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isMe ? 'bg-emerald-500/20 text-emerald-100' : 'bg-emerald-100 text-emerald-700'}`}>표준어</span>
                                                        <span className={`text-sm font-bold ${isMe ? 'text-emerald-100' : 'text-emerald-700'}`}>{parsed.norm}</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1.5 opacity-90">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isMe ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                        {isMe ? "A/文" : "原文"}
                                                    </span>
                                                    <span className="font-bold text-xl landscape:text-3xl">
                                                        {isMe ? parsed.text : m.source_text}
                                                    </span>
                                                </div>

                                                {parsed.pron && (
                                                    <div className="flex items-center gap-1.5 opacity-80 mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isMe ? 'bg-white/10' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>{t.pron}</span>
                                                        <span className="text-base font-medium italic landscape:text-2xl tracking-wide">{parsed.pron}</span>
                                                    </div>
                                                )}

                                                {parsed.rev && (
                                                    <div className="flex items-start gap-1.5 opacity-80 mt-1">
                                                        <span className={`px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isMe ? 'bg-black/20 text-blue-100' : 'bg-amber-100 text-amber-700'}`}>{t.rev}</span>
                                                        <span className="text-base font-bold landscape:text-2xl">{parsed.rev}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-[11px] items-center gap-1 flex text-slate-400 font-bold mt-1.5 ${isMe ? 'mr-3' : 'ml-3'} landscape:text-lg`}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 relative z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.04)] flex gap-2 items-center">

                        <button
                            onClick={toggleRecording}
                            className={`p-5 md:p-6 rounded-full shadow-md shrink-0 transition-all tap-effect flex items-center justify-center border-2 ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-slate-50 border-slate-300 text-slate-400 hover:text-blue-500'}`}
                        >
                            <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </button>

                        <div className="relative flex flex-1 items-center bg-slate-50 border-2 border-slate-300 rounded-[36px] overflow-hidden focus-within:border-blue-500 focus-within:bg-white transition-all shadow-inner">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={isRecording ? t.listening : t.chatPlaceholder}
                                className="w-full bg-transparent p-5 pl-8 text-slate-800 text-xl landscape:text-3xl font-black outline-none resize-none max-h-40 min-h-[72px]"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!text.trim() || isSending}
                                className="mr-3 bg-blue-600 text-white p-5 rounded-full transition-all disabled:opacity-30 disabled:bg-slate-300 tap-effect shadow-md flex items-center justify-center"
                            >
                                {isSending ? (
                                    <div className="w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-8 h-8 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            <style jsx global>{`
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            `}</style>
        </RoleGuard>
    );
}

export default function WorkerChat() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <WorkerChatContent />
        </Suspense>
    );
}

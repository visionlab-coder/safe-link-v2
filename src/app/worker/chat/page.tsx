"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import { hangulize } from "@/utils/hangulize";
import { analyzeMessageWithAI } from "@/utils/ai/watchdog";
import { ShieldAlert, ShieldCheck, Users, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playPremiumAudio } from "@/utils/tts";
import { transcribeAudio, createSTTRecorder } from "@/utils/stt";
import { playNotificationSound } from "@/utils/notifications";
import { formalizeKo } from "@/utils/politeness";

const ui: Record<string, any> = {
    ko: {
        title: "관리자 선택",
        chatPlaceholder: "메시지 입력 (자동 번역/TTS)...",
        listening: "듣고 있습니다...",
        adminName: "관리자",
        me: "근로자 (나)",
        pron: "발음",
        rev: "역번역",
        selectAdmin: "대화할 관리자를 선택하세요.",
        friendAdded: "새로운 관리자가 대화 목록에 추가되었습니다.",
    },
    en: {
        title: "Select Admin",
        chatPlaceholder: "Type message (Automated)...",
        listening: "Listening...",
        adminName: "Admin",
        me: "Worker (Me)",
        pron: "Pronunciation",
        rev: "Reverse Trans",
        selectAdmin: "Select an admin to chat with.",
        friendAdded: "New admin has been added to your chat list.",
    },
    zh: {
        title: "选择管理员",
        chatPlaceholder: "输入消息（自动翻译/语音）...",
        listening: "正在倾听...",
        adminName: "管理员",
        me: "工人 (我)",
        pron: "发音",
        rev: "反向翻译",
        selectAdmin: "请选择与之交谈的管理员。",
        friendAdded: "新管理员已添加到您的对话列表中。",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

const getSTTLang = (c: string) => {
    const map: Record<string, string> = {
        ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN", th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP", ph: "fil-PH"
    };
    return map[c] || c;
};

type AdminProfile = { id: string; display_name: string; role: string; site_id: string | null; };
type Message = { id: string; from_user: string; to_user: string; source_text: string; translated_text: string; created_at: string; };

function WorkerChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");
    const addFriendId = searchParams.get("add_friend");

    const [lang, setLang] = useState("ko");
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const processedAudioIds = useRef<Set<string>>(new Set());

    const [myId, setMyId] = useState("");
    const [admins, setAdmins] = useState<AdminProfile[]>([]);
    const [activeAdmin, setActiveAdmin] = useState<AdminProfile | null>(null);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female');
    const [showSidebar, setShowSidebar] = useState(false);
    const [unreadAdmins, setUnreadAdmins] = useState<Set<string>>(new Set());
    const activeAdminRef = useRef<AdminProfile | null>(null);

    // Friend list persistence
    const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

    const changeGender = (g: 'male' | 'female') => {
        voiceGenderRef.current = g;
        setVoiceGender(g);
    };

    const load = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setMyId(session.user.id);

        const { data: profile } = await supabase.from("profiles").select("preferred_lang, site_id").eq("id", session.user.id).single();
        if (profile?.site_id) setSiteId(profile.site_id);

        let finalLang = profile?.preferred_lang || "ko";
        if (urlLang && urlLang !== profile?.preferred_lang) {
            await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
            finalLang = urlLang;
        }
        setLang(finalLang);

        // Load friend IDs from local storage
        const savedFriends = localStorage.getItem(`wrk_friends_${session.user.id}`);
        const currentFriends = new Set<string>(savedFriends ? JSON.parse(savedFriends) : []);

        // Handling QR Add Friend
        if (addFriendId && addFriendId !== session.user.id) {
            currentFriends.add(addFriendId);
            localStorage.setItem(`wrk_friends_${session.user.id}`, JSON.stringify(Array.from(currentFriends)));
            alert(getUI(finalLang).friendAdded);
            // Remove param from URL without reload
            window.history.replaceState({}, '', window.location.pathname + (urlLang ? `?lang=${urlLang}` : ''));
        }
        setFriendIds(currentFriends);

        const { data: adminList } = await supabase
            .from("profiles")
            .select("id, display_name, role, site_id")
            .not("role", "ilike", "worker")
            .not("role", "eq", "ROOT"); // ROOT 제외

        if (adminList) {
            const prioritized = adminList.sort((a, b) => {
                const isFriendA = currentFriends.has(a.id) ? 0 : 1;
                const isFriendB = currentFriends.has(b.id) ? 0 : 1;
                return isFriendA - isFriendB;
            });
            setAdmins(prioritized);

            // Auto-select if there's only one or a friend is active
            if (prioritized.length > 0 && !activeAdmin) {
                const autoTarget = prioritized.find(a => currentFriends.has(a.id)) || prioritized[0];
                setActiveAdmin(autoTarget);
            }
        }
    };

    useEffect(() => { load(); }, [urlLang, addFriendId]);

    useEffect(() => {
        activeAdminRef.current = activeAdmin;
        if (activeAdmin) {
            setUnreadAdmins(prev => {
                const next = new Set(prev);
                next.delete(activeAdmin.id);
                return next;
            });
        }
        if (!myId || !activeAdmin) return;
        const supabase = createClient();

        const fetchMessages = async () => {
            const { data } = await supabase
                .from("messages")
                .select("*")
                .or(`and(from_user.eq.${myId},to_user.eq.${activeAdmin.id}),and(from_user.eq.${activeAdmin.id},to_user.eq.${myId})`)
                .order("created_at", { ascending: true });
            if (data) {
                setMessages(data);
                // Mark existing messages as processed so they don't play on reload
                data.forEach(m => processedAudioIds.current.add(m.id));
            }
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        };
        fetchMessages();

        const monitorId = `msg_wrk_${myId}_${activeAdmin.id}`;
        const channel = supabase
            .channel(monitorId)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
                const msg = payload.new as Message;
                if (!msg || processedAudioIds.current.has(msg.id)) return;

                const isForMe = msg.to_user === myId && msg.from_user === activeAdmin.id;

                if (isForMe) {
                    processedAudioIds.current.add(msg.id);
                    setMessages(prev => {
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

                    // 🔊 Audio Feedback for incoming admin messages
                    playNotificationSound();
                    const p = parseMsg(msg.translated_text);
                    if (p.text) playPremiumAudio(p.text, lang, voiceGenderRef.current);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [myId, activeAdmin, lang]);

    // 🆕 Global Message Monitor (For Unread Notifications)
    useEffect(() => {
        if (!myId) return;
        const supabase = createClient();
        const globalChannel = supabase
            .channel(`worker_global_${myId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
                const msg = payload.new as Message;
                if (!msg || msg.from_user === myId) return;

                // If message is for me but not from the active admin, mark as unread
                if (msg.to_user === myId && (!activeAdminRef.current || msg.from_user !== activeAdminRef.current.id)) {
                    setUnreadAdmins(prev => new Set(prev).add(msg.from_user));
                    playNotificationSound();
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(globalChannel); };
    }, [myId]);

    const handleSend = async (overrideText?: string | React.MouseEvent) => {
        const messageText = typeof overrideText === 'string' ? overrideText : text;
        if (!messageText.trim() || !myId || !activeAdmin) return;
        setIsSending(true);
        const originalText = messageText.trim();
        try {
            const supabase = createClient();
            let translated = originalText;
            let pron = "";

            if (lang !== "ko") {
                const dtUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ko&dt=t&dt=rm&q=${encodeURIComponent(originalText)}`;
                const transRes = await fetch(dtUrl);
                const transData = await transRes.json();
                if (transData?.[0]) {
                    translated = formalizeKo(transData[0].map((item: any) => item[0]).join(""));
                    const translitBlock = transData[0].find((item: any) => item[0] === null && (item[2] || item[3]));
                    if (translitBlock) pron = hangulize(translitBlock[2] || translitBlock[3], lang);
                }
            }

            const payload = {
                site_id: siteId || "00000000-0000-0000-0000-000000000000",
                from_user: myId,
                to_user: activeAdmin.id,
                source_lang: lang,
                target_lang: "ko",
                source_text: originalText,
                translated_text: JSON.stringify({ text: translated, pron }),
                ai_analysis: await analyzeMessageWithAI(translated),
            };

            // 🚀 Optimistic Update
            setMessages(prev => [...prev, { ...payload, id: `temp-${Date.now()}`, created_at: new Date().toISOString() } as any]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

            const { error: msgErr } = await supabase.from("messages").insert(payload);
            if (!msgErr) {
                setText("");
                if (isRecording) toggleRecording();
                // Play Korean for admin nearby
                if (translated) playPremiumAudio(translated, "ko", voiceGenderRef.current);
            }
        } catch (e) { console.error(e); }
        finally { setIsSending(false); }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
            setIsRecording(false);
        } else {
            try {
                audioChunksRef.current = [];
                const recorder = await createSTTRecorder((blob) => {
                    audioChunksRef.current.push(blob);
                });

                recorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                    // Use getSTTLang to convert local code (bi, zh) to Google format (vi-VN, zh-CN)
                    const sttLang = getSTTLang(lang);
                    const result = await transcribeAudio(audioBlob, sttLang);
                    if (result.trim()) {
                        setText(result.trim());
                        // Auto-send for premium experience
                        setTimeout(() => handleSend(result.trim()), 100);
                    }
                };

                mediaRecorderRef.current = recorder;
                recorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error("STT Start Error:", err);
                alert("Microphone access denied.");
            }
        }
    };

    const t = getUI(lang);
    const parseMsg = (raw: any) => {
        if (!raw) return { text: "", pron: "", rev: "" };
        if (typeof raw === "object") return raw;
        try { return JSON.parse(raw); } catch { return { text: String(raw), pron: "", rev: "" }; }
    };

    // Filter admins based on user criteria: ROOT excluded, friends/site prioritized
    const filteredAdmins = admins.filter(a => {
        // Show friends, same-site staff, or ALL if no specific site set (inclusive fallback)
        if (friendIds.has(a.id)) return true;
        if (siteId && a.site_id === siteId) return true;
        if (!siteId) return true; // Show all if site unknown to prevent empty list
        return false;
    });

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
                <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => activeAdmin ? setActiveAdmin(null) : router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold tracking-tight text-slate-800 uppercase">{activeAdmin ? activeAdmin.display_name : t.title}</span>
                                {activeAdmin && (
                                    <span className="px-2 py-0.5 bg-blue-600 text-[9px] font-bold rounded text-white tracking-widest uppercase animate-pulse">
                                        {activeAdmin.role === 'HQ_ADMIN' ? 'Site Manager' : activeAdmin.role === 'SAFETY_OFFICER' ? 'Safety Officer' : 'Staff'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                            <button onClick={() => changeGender('male')} className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>MALE</button>
                            <button onClick={() => changeGender('female')} className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}>FEMALE</button>
                        </div>
                        <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><Users className="w-6 h-6" /></button>
                    </div>
                </header>

                <main className="flex-1 flex w-full max-w-6xl mx-auto h-[calc(100vh-76px)] overflow-hidden relative">
                    <div className={`${!activeAdmin || showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col border-r border-slate-200 bg-white p-4 overflow-y-auto shrink-0 z-30`}>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t.title}</h2>
                            <QrCode className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {filteredAdmins.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 font-bold italic px-4">
                                    등록된 관리자가 없습니다.<br />QR 코드를 스캔하여 추가하세요.
                                </div>
                            ) : (
                                filteredAdmins.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => { setActiveAdmin(a); setShowSidebar(false); }}
                                        className={`flex items-center gap-4 p-4 rounded-3xl transition-all border ${activeAdmin?.id === a.id ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-xs shrink-0 relative">
                                            {a.display_name[0]}
                                            {unreadAdmins.has(a.id) && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce" />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-start overflow-hidden text-left">
                                            <div className="flex items-center gap-1.5 w-full">
                                                <span className="font-black truncate">{a.display_name}</span>
                                                {friendIds.has(a.id) && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0" />}
                                            </div>
                                            <span className={`text-[9px] font-black tracking-widest uppercase opacity-60`}>
                                                {a.role === 'HQ_ADMIN' ? 'Site Manager' : a.role === 'SAFETY_OFFICER' ? 'Safety Officer' : a.role} {a.site_id === siteId ? "⭐️ Site" : ""}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className={`${!activeAdmin ? 'hidden' : 'flex'} flex-1 flex-col bg-[#f5f8fa] overflow-hidden relative`}>
                        {activeAdmin ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(circle at center, #cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                                    <AnimatePresence initial={false}>
                                        {messages.map((m, i) => {
                                            const isMe = m.from_user === myId;
                                            const parsed = parseMsg(m.translated_text);
                                            return (
                                                <motion.div key={m.id || i} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'mr-3' : 'ml-3'}`}>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isMe ? t.me : activeAdmin.display_name}</span>
                                                        <button onClick={() => playPremiumAudio(isMe ? m.source_text : parsed.text, isMe ? lang : "ko", voiceGenderRef.current)} className="p-1 rounded-full bg-white border border-slate-200 text-blue-500 shadow-sm"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></button>
                                                    </div>
                                                    <div className={`p-5 rounded-[32px] shadow-lg border-2 flex flex-col gap-3 ${isMe ? 'bg-blue-600 border-blue-700 rounded-tr-sm text-white' : 'bg-white border-slate-200 rounded-tl-sm text-slate-800'}`}>
                                                        <p className="font-black text-2xl md:text-3xl leading-snug whitespace-pre-wrap">{isMe ? m.source_text : (parsed.text || m.source_text)}</p>
                                                        {parsed.text && (
                                                            <div className={`pt-3 border-t flex flex-col gap-1.5 ${isMe ? 'border-blue-400/50' : 'border-slate-100'}`}>
                                                                <div className="flex items-center gap-1.5 opacity-90"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isMe ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{isMe ? "A/文" : "原文"}</span><span className="font-bold text-lg">{isMe ? parsed.text : m.source_text}</span></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-bold mt-1.5">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] flex gap-2 items-center">
                                    <button onClick={toggleRecording} className={`p-5 rounded-full shadow-md transition-all border-2 ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400'}`}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                                    <div className="relative flex flex-1 items-center bg-slate-50 border-2 border-slate-200 rounded-[36px] overflow-hidden focus-within:border-blue-500 transition-all shadow-inner">
                                        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isRecording ? t.listening : t.chatPlaceholder} className="w-full bg-transparent p-5 pl-8 text-slate-800 text-xl font-black outline-none resize-none min-h-[72px]" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                                        <button onClick={handleSend} disabled={!text.trim() || isSending} className="mr-3 bg-blue-600 text-white p-5 rounded-full disabled:opacity-30 shadow-md transform active:scale-95 transition-all">{isSending ? <div className="w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-8 h-8 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>}</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
                                <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 shadow-inner">
                                    <Users className="w-16 h-16" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-400 uppercase tracking-widest leading-tight">{t.selectAdmin}</h2>
                                <p className="text-slate-400 font-bold max-w-xs">{t.friendAdded ? "현장의 담당 관리자나 안내받은 QR 코드를 통해 관리자를 추가하세요." : ""}</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <style jsx global>{`::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }`}</style>
        </RoleGuard>
    );
}

export default function WorkerChat() {
    return (<Suspense fallback={<div className="min-h-screen bg-white" />}><WorkerChatContent /></Suspense>);
}

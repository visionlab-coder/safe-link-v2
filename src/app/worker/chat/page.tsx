"use client";
import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SwarmAgentHUD from "@/components/agents/SwarmAgentHUD";
import RoleGuard from "@/components/RoleGuard";

import { Users, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playPremiumAudio, playProxyAudio } from "@/utils/tts";
import { playNotificationSound } from "@/utils/notifications";
import { formalizeKo } from "@/utils/politeness";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import { usePresence } from "@/hooks/usePresence";

type ParsedMessage = { text: string; pron: string; rev: string };
type RealtimeMessagePayload = { new: Message };

const ui: Record<string, Record<string, string>> = {
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


type AdminProfile = { id: string; display_name: string; role: string; site_id: string | null; };
type Message = { id: string; from_user: string; to_user: string; source_text: string; translated_text: string; created_at: string; is_read?: boolean; };

function WorkerChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");
    const addFriendId = searchParams.get("add_friend");

    const [lang, setLang] = useState("ko");
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const processedAudioIds = useRef<Set<string>>(new Set());

    const [myId, setMyId] = useState("");
    const onlineUsers = usePresence(myId || null);
    const [admins, setAdmins] = useState<AdminProfile[]>([]);
    const [activeAdmin, setActiveAdmin] = useState<AdminProfile | null>(null);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female');
    const [showSidebar, setShowSidebar] = useState(false);
    const [unreadAdmins, setUnreadAdmins] = useState<Record<string, number>>({});
    const activeAdminRef = useRef<AdminProfile | null>(null);
    const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem('sl_voice_enabled') !== 'false';
    });

    // Friend list persistence
    const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

    const changeGender = (g: 'male' | 'female') => {
        voiceGenderRef.current = g;
        setVoiceGender(g);
    };

    const playAudio = (text: string, langCode: string) => {
        const currentGender = voiceGenderRef.current;
        playProxyAudio(text, langCode, currentGender, (success) => {
            if (!success) {
                playPremiumAudio(text, langCode, currentGender);
            }
        });
    };

    const toggleVoice = () => {
        const next = !voiceEnabled;
        setVoiceEnabled(next);
        localStorage.setItem('sl_voice_enabled', String(next));
    };

    const load = useCallback(async () => {
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

            // Auto-select removed - User must select an admin from the list first
        }
    }, [urlLang, addFriendId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        activeAdminRef.current = activeAdmin;
        if (activeAdmin) {
            setUnreadAdmins(prev => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [activeAdmin.id]: _, ...rest } = prev;
                return rest;
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

                // Mark as read (is_read 컬럼이 없어도 에러 무시)
                supabase
                    .from("messages")
                    .update({ is_read: true })
                    .eq("from_user", activeAdmin.id)
                    .eq("to_user", myId)
                    .eq("is_read", false)
                    .then(() => {});
            }
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        };
        fetchMessages();

        const monitorId = `msg_wrk_${myId}_${activeAdmin.id}`;
        const channel = supabase
            .channel(monitorId)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: RealtimeMessagePayload) => {
                const msg = payload.new as Message;
                if (!msg || processedAudioIds.current.has(msg.id)) return;

                const isForMe = msg.to_user === myId && msg.from_user === activeAdmin.id;

                if (isForMe) {
                    processedAudioIds.current.add(msg.id);
                    setMessages(prev => {
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, ({ ...msg, is_read: true } as Message)];
                    });

                    // 읽음 처리
                    supabase.from("messages").update({ is_read: true }).eq("id", msg.id).then();
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    playNotificationSound();
                    if (typeof navigator !== "undefined" && navigator.vibrate) {
                        navigator.vibrate([300, 100, 300]);
                    }
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
                const updated = payload.new as Message;
                setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, is_read: updated.is_read } : m));
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
                    setUnreadAdmins(prev => ({ ...prev, [msg.from_user]: (prev[msg.from_user] || 0) + 1 }));
                    playNotificationSound();
                    if (typeof navigator !== "undefined" && navigator.vibrate) {
                        navigator.vibrate([300, 100, 300]);
                    }
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(globalChannel); };
    }, [myId]);

    const handleSend = async (overrideText?: string | React.MouseEvent) => {
        const messageText = typeof overrideText === 'string' ? overrideText : text;
        if (!messageText.trim() || !myId || !activeAdmin || isSending) return;

        const originalText = messageText.trim();
        const tempId = `temp-${Date.now()}`;

        // 🚀 즉시 표시 (번역 전)
        setText("");
        setIsSending(true);
        setMessages(prev => [...prev, {
            id: tempId, from_user: myId, to_user: activeAdmin.id,
            source_lang: lang, target_lang: "ko",
            source_text: originalText,
            translated_text: JSON.stringify({ text: originalText, pron: "", rev: "" }),
            created_at: new Date().toISOString(),
        }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

        try {
            const supabase = createClient();
            let translated = originalText;
            let pron = "";
            let rev = "";

            if (lang !== "ko") {
                try {
                    const transRes = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: originalText, sl: lang, tl: 'ko' })
                    });
                    if (transRes.ok) {
                        const transData = await transRes.json() as { translated?: string; pronunciation?: string; reverse_translated?: string };
                        translated = formalizeKo(transData.translated || originalText);
                        pron = transData.pronunciation || "";
                        rev = transData.reverse_translated || "";
                    }
                } catch (e) {
                    console.warn("[Chat] 번역 실패 - 원문 전송:", e);
                }
            }

            const payload: Record<string, unknown> = {
                from_user: myId,
                to_user: activeAdmin.id,
                source_lang: lang,
                target_lang: "ko",
                source_text: originalText,
                translated_text: JSON.stringify({ text: translated, pron, rev }),
                is_read: false,
            };
            if (siteId) payload.site_id = siteId;

            const { data: inserted, error: msgErr } = await supabase.from("messages").insert(payload).select().single();
            if (!msgErr && inserted) {
                // 임시 메시지를 실제 DB 메시지로 교체
                setMessages(prev => prev.map(m => m.id === tempId ? inserted as Message : m));
            } else {
                // 실패 시 임시 메시지 제거
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsSending(false);
        }
    };

    const handleTranscript = useCallback((transcript: string) => {
        setText(prev => prev ? `${prev} ${transcript}` : transcript);
    }, []);

    const { isRecording, toggle: toggleRecording } = useCloudSTT({
        lang,
        onTranscript: handleTranscript,
    });

    const t = getUI(lang);
    const parseMsg = (raw: unknown): ParsedMessage => {
        if (!raw) return { text: "", pron: "", rev: "" };
        if (typeof raw === "object") return raw as ParsedMessage;
        try { return JSON.parse(raw as string) as ParsedMessage; } catch { return { text: String(raw), pron: "", rev: "" }; }
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
                        {/* 🔊 Voice On/Off Toggle */}
                        <button onClick={toggleVoice} className="flex flex-col items-center gap-0.5">
                            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${voiceEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${voiceEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </div>
                            <span className={`text-[8px] font-black tracking-widest uppercase transition-colors ${voiceEnabled ? 'text-blue-500' : 'text-slate-400'}`}>
                                {voiceEnabled ? 'VOC ON' : 'VOC OFF'}
                            </span>
                        </button>
                        <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                            <button onClick={() => changeGender('male')} className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>MALE</button>
                            <button onClick={() => changeGender('female')} className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}>FEMALE</button>
                        </div>
                        <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 relative transition-all">
                            <Users className="w-6 h-6" />
                            {Object.values(unreadAdmins).reduce((a, b) => a + b, 0) > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[2px] border-white text-white text-[10px] font-black flex items-center justify-center">
                                    {Object.values(unreadAdmins).reduce((a, b) => a + b, 0)}
                                </span>
                            )}
                        </button>
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
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 relative ${onlineUsers.has(a.id) ? 'bg-white/20 ring-2 ring-green-400/60' : 'bg-white/20'}`}>
                                            {a.display_name[0]}
                                            {onlineUsers.has(a.id) && (
                                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                                            )}
                                            {(unreadAdmins[a.id] || 0) > 0 && (
                                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white text-white text-[10px] font-black flex items-center justify-center">
                                                    {unreadAdmins[a.id]}
                                                </span>
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
                                                        <button onClick={() => {
                                                                if (!voiceEnabled) return;
                                                                if (isMe) {
                                                                    playAudio(m.source_text, lang);
                                                                } else {
                                                                    // 관리자 메시지: 번역문(근로자 언어)이 있으면 번역 재생, 없으면 원문(한국어) 재생
                                                                    const audioText = parsed.text || m.source_text;
                                                                    const audioLang = parsed.text ? lang : 'ko';
                                                                    playAudio(audioText, audioLang);
                                                                }
                                                            }} className={`p-1 rounded-full border shadow-sm transition-colors ${voiceEnabled ? 'bg-white border-slate-200 text-blue-500' : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'}`}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></button>
                                                    </div>
                                                    <div className={`p-5 rounded-[32px] shadow-lg border-2 flex flex-col gap-3 ${isMe ? 'bg-blue-600 border-blue-700 rounded-tr-sm text-white' : 'bg-white border-slate-200 rounded-tl-sm text-slate-800'}`}>

                                                        {isMe ? (
                                                            // ── 내가 보낸 메시지: 원문(내 언어) + 하단에 한국어 번역 ──
                                                            <>
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="font-black text-2xl md:text-3xl leading-snug whitespace-pre-wrap">{m.source_text}</p>
                                                                    {m.is_read === false && (
                                                                        <span className="text-[10px] font-black text-amber-300 self-end mr-2 leading-none">1</span>
                                                                    )}
                                                                </div>
                                                                {parsed.text && parsed.text !== m.source_text && (
                                                                    <div className="pt-3 border-t border-blue-400/50 flex items-start gap-1.5">
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-white/20 text-white shrink-0 mt-0.5 font-black">번역</span>
                                                                        <span className="font-bold text-lg">{parsed.text}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            // ── 관리자 메시지: 외국어 번역문(메인, 크게) + 하단에 한국어 원문만 ──
                                                            <>
                                                                <p className="font-black text-2xl md:text-3xl leading-snug whitespace-pre-wrap">
                                                                    {parsed.text || m.source_text}
                                                                </p>
                                                                <div className="pt-3 border-t border-slate-100 flex items-start gap-1.5">
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-400 shrink-0 mt-0.5 font-black">KO</span>
                                                                    <span className="font-bold text-lg text-slate-500">{m.source_text}</span>
                                                                </div>
                                                            </>
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

            {/* 🤖 Tier 3 Ambient Edge Agent */}
            <SwarmAgentHUD />
        </RoleGuard>
    );
}

export default function WorkerChat() {
    return (<Suspense fallback={<div className="min-h-screen bg-white" />}><WorkerChatContent /></Suspense>);
}

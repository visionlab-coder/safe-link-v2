"use client";
import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import SwarmAgentHUD from "@/components/agents/SwarmAgentHUD";
import RoleGuard from "@/components/RoleGuard";

import { Users, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playPremiumAudio } from "@/utils/tts";
import { useCloudSTT } from "@/hooks/useCloudSTT";
import { usePresence } from "@/hooks/usePresence";
import ChatPlayButton from "@/components/ChatPlayButton";
import { resolveDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

type ParsedMessage = { text: string; pron: string; rev: string };

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
        noAdmins: "등록된 관리자가 없습니다. QR 코드를 스캔하여 추가하세요.", older: "이전 메시지", translation: "번역", assistantHint: "현장의 담당 관리자나 안내받은 QR 코드를 통해 관리자를 추가하세요.", male: "남성", female: "여성", conversationList: "대화 상대 목록",
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
        noAdmins: "No administrators are registered. Scan a QR code to add one.", older: "Older messages", translation: "Translation", assistantHint: "Add an administrator through your site contact or the QR code you were given.", male: "Male", female: "Female", conversationList: "Conversation list",
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
        noAdmins: "没有已登记的管理员。请扫描二维码添加管理员。", older: "更多消息", translation: "翻译", assistantHint: "请通过现场负责人或收到的二维码添加管理员。", male: "男", female: "女", conversationList: "对话对象列表",
    },
    vi: {
        title: "Chọn Quản trị viên",
        chatPlaceholder: "Nhập tin nhắn (tự động dịch)...",
        listening: "Đang nghe...",
        adminName: "Quản trị viên",
        me: "Công nhân (Tôi)",
        pron: "Phát âm",
        rev: "Dịch ngược",
        selectAdmin: "Chọn quản trị viên để trò chuyện.",
        friendAdded: "Quản trị viên mới đã được thêm vào danh sách.",
        noAdmins: "Chưa có quản trị viên được đăng ký. Hãy quét mã QR để thêm.", older: "Tin nhắn cũ", translation: "Bản dịch", assistantHint: "Hãy thêm quản trị viên qua người phụ trách công trường hoặc mã QR được cung cấp.", male: "Nam", female: "Nữ", conversationList: "Danh sách đối tượng trò chuyện",
    },
    th: {
        title: "เลือกผู้ดูแล",
        chatPlaceholder: "พิมพ์ข้อความ (แปลอัตโนมัติ)...",
        listening: "กำลังฟัง...",
        adminName: "ผู้ดูแล",
        me: "คนงาน (ฉัน)",
        pron: "การออกเสียง",
        rev: "แปลกลับ",
        selectAdmin: "เลือกผู้ดูแลเพื่อพูดคุย",
        friendAdded: "เพิ่มผู้ดูแลใหม่ในรายการแล้ว",
    },
    uz: {
        title: "Admin tanlash",
        chatPlaceholder: "Xabar yozing (avtomatik tarjima)...",
        listening: "Eshitmoqda...",
        adminName: "Admin",
        me: "Ishchi (Men)",
        pron: "Talaffuz",
        rev: "Teskari tarjima",
        selectAdmin: "Suhbatlashish uchun adminni tanlang.",
        friendAdded: "Yangi admin suhbat ro'yxatiga qo'shildi.",
    },
    ph: {
        title: "Pumili ng Admin",
        chatPlaceholder: "Mag-type ng mensahe (awtomatikong isinalin)...",
        listening: "Nakikinig...",
        adminName: "Admin",
        me: "Manggagawa (Ako)",
        pron: "Pagbigkas",
        rev: "Kabaligtaran ng Pagsasalin",
        selectAdmin: "Pumili ng admin para makipag-chat.",
        friendAdded: "Bagong admin ang naidagdag sa listahan ng chat.",
    },
    km: {
        title: "ជ្រើសអ្នកគ្រប់គ្រង",
        chatPlaceholder: "វាយសារ (បកប្រែដោយស្វ័យប្រវត្តិ)...",
        listening: "កំពុងស្តាប់...",
        adminName: "អ្នកគ្រប់គ្រង",
        me: "កម្មករ (ខ្ញុំ)",
        pron: "ការបញ្ចេញសម្លេង",
        rev: "បកប្រែបញ្ច្រាស",
        selectAdmin: "ជ្រើសអ្នកគ្រប់គ្រងដើម្បីជជែក",
        friendAdded: "អ្នកគ្រប់គ្រងថ្មីត្រូវបានបន្ថែម",
    },
    mn: {
        title: "Захиргаа сонгох",
        chatPlaceholder: "Мессеж бичнэ үү (автомат орчуулга)...",
        listening: "Сонсож байна...",
        adminName: "Захиргаа",
        me: "Ажилтан (Би)",
        pron: "Дуудлага",
        rev: "Эргүүлэн орчуулах",
        selectAdmin: "Чатлах захиргааг сонгоно уу.",
        friendAdded: "Шинэ захиргаа чатын жагсаалтад нэмэгдлээ.",
    },
    my: {
        title: "မန်နေဂျာ ရွေးပါ",
        chatPlaceholder: "မက်ဆေ့ဂျ် ရိုက်ထည့်ပါ (အလိုအလျောက် ဘာသာပြန်)...",
        listening: "နားထောင်နေသည်...",
        adminName: "မန်နေဂျာ",
        me: "အလုပ်သမား (ကျွန်တော်)",
        pron: "အသံထွက်",
        rev: "ပြန်ဘာသာပြန်",
        selectAdmin: "ဆွေးနွေးရန် မန်နေဂျာ ရွေးချယ်ပါ",
        friendAdded: "မန်နေဂျာ အသစ်ကို chat စာရင်းသို့ ထည့်ပါပြီ",
    },
    ne: {
        title: "व्यवस्थापक छान्नुहोस्",
        chatPlaceholder: "सन्देश लेख्नुहोस् (स्वतः अनुवाद)...",
        listening: "सुन्दैछ...",
        adminName: "व्यवस्थापक",
        me: "कामदार (म)",
        pron: "उच्चारण",
        rev: "उल्टो अनुवाद",
        selectAdmin: "कुरा गर्न व्यवस्थापक छान्नुहोस्।",
        friendAdded: "नयाँ व्यवस्थापक कुराकानी सूचीमा थपियो।",
    },
    bn: {
        title: "ম্যানেজার বেছে নিন",
        chatPlaceholder: "বার্তা লিখুন (স্বয়ংক্রিয় অনুবাদ)...",
        listening: "শুনছি...",
        adminName: "ম্যানেজার",
        me: "শ্রমিক (আমি)",
        pron: "উচ্চারণ",
        rev: "বিপরীত অনুবাদ",
        selectAdmin: "কথা বলতে ম্যানেজার বেছে নিন।",
        friendAdded: "নতুন ম্যানেজার চ্যাট তালিকায় যোগ করা হয়েছে।",
    },
    kk: {
        title: "Менеджер таңдау",
        chatPlaceholder: "Хабарлама жазыңыз (автоматты аударма)...",
        listening: "Тыңдап жатыр...",
        adminName: "Менеджер",
        me: "Жұмысшы (Мен)",
        pron: "Айтылым",
        rev: "Кері аударма",
        selectAdmin: "Сөйлесу үшін менеджер таңдаңыз.",
        friendAdded: "Жаңа менеджер чат тізіміне қосылды.",
    },
    ru: {
        title: "Выбор администратора",
        chatPlaceholder: "Введите сообщение (авто-перевод)...",
        listening: "Слушаю...",
        adminName: "Администратор",
        me: "Рабочий (Я)",
        pron: "Произношение",
        rev: "Обратный перевод",
        selectAdmin: "Выберите администратора для чата.",
        friendAdded: "Новый администратор добавлен в список чата.",
        noAdmins: "Нет зарегистрированных администраторов. Отсканируйте QR-код, чтобы добавить администратора.", older: "Предыдущие сообщения", translation: "Перевод", assistantHint: "Добавьте администратора через ответственного на объекте или полученный QR-код.", male: "Муж", female: "Жен", conversationList: "Список собеседников",
    },
    ar: {
        title: "اختيار المدير",
        chatPlaceholder: "اكتب رسالة (ترجمة تلقائية)...",
        listening: "جارٍ الاستماع...",
        adminName: "المدير",
        me: "العامل (أنا)",
        pron: "النطق",
        rev: "الترجمة العكسية",
        selectAdmin: "اختر مديرًا للدردشة.",
        friendAdded: "تمت إضافة مدير جديد إلى قائمة الدردشة.",
    },
    hi: {
        title: "प्रबंधक चुनें",
        chatPlaceholder: "संदेश लिखें (स्वतः अनुवाद)...",
        listening: "सुन रहा हूँ...",
        adminName: "प्रबंधक",
        me: "कामगार (मैं)",
        pron: "उच्चारण",
        rev: "उल्टा अनुवाद",
        selectAdmin: "बात करने के लिए प्रबंधक चुनें।",
        friendAdded: "नया प्रबंधक चैट सूची में जोड़ा गया।",
    },
    id: {
        title: "Pilih Admin",
        chatPlaceholder: "Ketik pesan (terjemahan otomatis)...",
        listening: "Mendengarkan...",
        adminName: "Admin",
        me: "Pekerja (Saya)",
        pron: "Pengucapan",
        rev: "Terjemahan Balik",
        selectAdmin: "Pilih admin untuk mengobrol.",
        friendAdded: "Admin baru telah ditambahkan ke daftar obrolan.",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];


type AdminProfile = { id: string; display_name: string; role: string; site_id: string | null; };
type WorkerChatAdminsResponse = {
    worker?: { id?: string; preferred_lang?: string | null; site_id?: string | null };
    admins?: AdminProfile[];
};
type Message = {
    id: string;
    from_user: string;
    to_user: string;
    source_lang?: string;
    target_lang?: string;
    source_text: string;
    translated_text: string;
    created_at: string;
    is_read?: boolean;
};
type ChatMessagesResponse = { messages?: Message[] };
type ChatMessageResponse = { message?: Message };

function WorkerChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlLang = searchParams.get("lang");
    const addFriendId = searchParams.get("add_friend");
    const displayLang = useDisplayLanguage();

    const [lang, setLang] = useState("ko");
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [sttError, setSttError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const processedAudioIds = useRef<Set<string>>(new Set());
    const MSG_PAGE_SIZE = 50;
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);

    const [myId, setMyId] = useState("");
    const [admins, setAdmins] = useState<AdminProfile[]>([]);
    const onlineUsers = usePresence(myId || null, admins.map((admin) => admin.id));
    const [activeAdmin, setActiveAdmin] = useState<AdminProfile | null>(null);
    const [siteId, setSiteId] = useState<string | null>(null);
    const [adminActivity, setAdminActivity] = useState<Record<string, number>>({});
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female');
    const [showSidebar, setShowSidebar] = useState(false);
    const [unreadAdmins, setUnreadAdmins] = useState<Record<string, number>>({});
    const activeAdminRef = useRef<AdminProfile | null>(null);
    const latestMessageIdRef = useRef<string | null>(null);

    const recordAdminActivity = useCallback((adminId: string, createdAt?: string) => {
        const parsed = createdAt ? Date.parse(createdAt) : Date.now();
        const timestamp = Number.isFinite(parsed) ? parsed : Date.now();
        setAdminActivity(prev => prev[adminId] === timestamp ? prev : { ...prev, [adminId]: timestamp });
    }, []);

    const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior });
    }, []);

    const revealLatestMessage = useCallback(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollMessagesToBottom("smooth"));
        });
        window.setTimeout(() => scrollMessagesToBottom("auto"), 240);
    }, [scrollMessagesToBottom]);
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

    const playAudio = (messageId: string, text: string, langCode: string) => {
        const currentGender = voiceGenderRef.current;
        playPremiumAudio(text, langCode, currentGender, () => {
            setPlayingMessageId(current => current === messageId ? null : current);
        }, () => {
            setPlayingMessageId(messageId);
        });
    };

    const toggleVoice = () => {
        const next = !voiceEnabled;
        setVoiceEnabled(next);
        localStorage.setItem('sl_voice_enabled', String(next));
    };

    const markMessagesRead = useCallback(async (peerId: string) => {
        const response = await fetch("/api/chat/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peer_id: peerId }),
        }).catch(() => null);
        return response?.ok === true;
    }, []);

    const load = useCallback(async () => {
        const adminsRes = await fetch("/api/worker/chat/admins", { cache: "no-store" });
        if (!adminsRes.ok) {
            if (adminsRes.status === 401) router.push("/auth");
            setAdmins([]);
            return;
        }

        const payload = (await adminsRes.json()) as WorkerChatAdminsResponse;
        const userId = payload.worker?.id;
        if (!userId) return;
        setMyId(userId);

        const mySiteId = payload.worker?.site_id ?? null;
        if (mySiteId) setSiteId(mySiteId);

        const finalLang = resolveDisplayLanguage(payload.worker?.preferred_lang, urlLang, displayLang);
        setLang(finalLang);

        // Load friend IDs from local storage
        const savedFriends = localStorage.getItem(`wrk_friends_${userId}`);
        const currentFriends = new Set<string>(savedFriends ? JSON.parse(savedFriends) : []);

        // Handling QR Add Friend
        if (addFriendId && addFriendId !== userId) {
            currentFriends.add(addFriendId);
            localStorage.setItem(`wrk_friends_${userId}`, JSON.stringify(Array.from(currentFriends)));
            alert(getUI(finalLang).friendAdded);
            window.history.replaceState({}, '', window.location.pathname + (urlLang ? `?lang=${urlLang}` : ''));
        }
        setFriendIds(currentFriends);

        const prioritized = [...(payload.admins ?? [])].sort((a, b) => {
            const isFriendA = currentFriends.has(a.id) ? 0 : 1;
            const isFriendB = currentFriends.has(b.id) ? 0 : 1;
            return isFriendA - isFriendB;
        });
        setAdmins(prioritized);
    }, [router, urlLang, addFriendId, displayLang]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        activeAdminRef.current = activeAdmin;
        if (activeAdmin) {
            setUnreadAdmins(prev => {
                const { [activeAdmin.id]: _, ...rest } = prev;
                return rest;
            });
        }
        if (!myId || !activeAdmin) return;

        const fetchMessages = async (scroll = true) => {
            const res = await fetch(`/api/chat/messages?peer_id=${activeAdmin.id}&limit=${MSG_PAGE_SIZE}`, {
                cache: "no-store",
            });
            if (!res.ok) return;

            const payload = (await res.json()) as ChatMessagesResponse;
            const sorted = payload.messages ?? [];
            const latest = sorted.at(-1);
            const hasNewLatestMessage = Boolean(latest?.id && latest.id !== latestMessageIdRef.current);
            latestMessageIdRef.current = latest?.id ?? null;
            if (latest) recordAdminActivity(activeAdmin.id, latest.created_at);
            setMessages(sorted);
            setHasMore(sorted.length >= MSG_PAGE_SIZE);
            sorted.forEach(m => processedAudioIds.current.add(m.id));

            const hasUnreadIncoming = sorted.some(message =>
                message.from_user === activeAdmin.id &&
                message.to_user === myId &&
                message.is_read === false
            );
            if (hasUnreadIncoming) {
                void markMessagesRead(activeAdmin.id).then(marked => {
                    if (!marked) return;
                    setMessages(current => current.map(message =>
                        message.from_user === activeAdmin.id && message.to_user === myId
                            ? { ...message, is_read: true }
                            : message
                    ));
                });
            }
            if (scroll || hasNewLatestMessage) {
                revealLatestMessage();
            }
        };
        void fetchMessages();
        const events = new EventSource(`/api/chat/events?peer_id=${encodeURIComponent(activeAdmin.id)}`);
        events.addEventListener("message", () => {
            void fetchMessages(false);
        });
        events.onerror = () => {};
        const fallbackPoll = window.setInterval(() => {
            void fetchMessages(false);
        }, 3000);
        const refreshVisibleChat = () => {
            if (document.visibilityState === "visible") void fetchMessages(false);
        };
        window.addEventListener("focus", refreshVisibleChat);
        document.addEventListener("visibilitychange", refreshVisibleChat);

        return () => {
            window.clearInterval(fallbackPoll);
            window.removeEventListener("focus", refreshVisibleChat);
            document.removeEventListener("visibilitychange", refreshVisibleChat);
            events.close();
        };
    }, [myId, activeAdmin, siteId, markMessagesRead, recordAdminActivity, revealLatestMessage]); // lang 제거: 언어 변경 시 채널 재생성 불필요

    // 🆕 Global Message Monitor (For Unread Notifications)
    const unreadAdminSeenRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!myId || admins.length === 0) return;
        let cancelled = false;
        const pollUnread = async () => {
            for (const admin of admins) {
                if (cancelled || activeAdminRef.current?.id === admin.id) continue;
                const res = await fetch(`/api/chat/messages?peer_id=${admin.id}&limit=5`, { cache: "no-store" });
                if (!res.ok) continue;
                const payload = (await res.json()) as ChatMessagesResponse;
                const recent = payload.messages ?? [];
                const latest = recent.at(-1);
                if (latest) recordAdminActivity(admin.id, latest.created_at);
                const incoming = recent.filter((msg) =>
                    msg.from_user === admin.id &&
                    msg.to_user === myId &&
                    msg.is_read === false &&
                    !unreadAdminSeenRef.current.has(msg.id)
                );
                if (incoming.length === 0) continue;
                incoming.forEach((msg) => unreadAdminSeenRef.current.add(msg.id));
                setUnreadAdmins(prev => ({ ...prev, [admin.id]: (prev[admin.id] || 0) + incoming.length }));
            }
        };
        void pollUnread();
        const events = new EventSource("/api/chat/user-events");
        events.addEventListener("message", () => {
            void load();
            void pollUnread();
        });
        return () => {
            cancelled = true;
            events.close();
        };
    }, [myId, admins, load, recordAdminActivity]);

    const handleSend = async (overrideText?: string | React.MouseEvent) => {
        const messageText = typeof overrideText === 'string' ? overrideText : text;
        if (!messageText.trim() || !myId || !activeAdmin || isSending) return;

        const originalText = messageText.trim();
        const tempId = `temp-${crypto.randomUUID()}`;

        // 🚀 즉시 표시 (번역 전)
        setText("");
        setIsSending(true);
        recordAdminActivity(activeAdmin.id);
        setMessages(prev => [...prev, {
            id: tempId, from_user: myId, to_user: activeAdmin.id,
            source_lang: lang, target_lang: "ko",
            source_text: originalText,
            translated_text: JSON.stringify({ text: originalText, pron: "", rev: "" }),
            created_at: new Date().toISOString(),
        }]);
        revealLatestMessage();

        try {
            let translated = originalText;
            let pron = "";
            let rev = "";

            if (lang !== "ko") {
                try {
                    const transRes = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: originalText, sl: lang, tl: 'ko', fast: true, quality: 'high', pronunciation: false })
                    });
                    if (transRes.ok) {
                        const transData = await transRes.json() as { translated?: string; pronunciation?: string; reverse_translated?: string };
                        // 1:1 대화 번역은 발신자가 입력한 의미를 그대로 보존한다.
                        // TBM용 문장 보정은 일반 대화에 적용하지 않는다.
                        translated = transData.translated || originalText;
                        pron = transData.pronunciation || "";
                        rev = transData.reverse_translated || "";
                    }
                } catch (e) {
                    console.warn("[Chat] 번역 실패 - 원문 전송:", e);
                }
            }

            const payload: Record<string, unknown> = {
                to_user: activeAdmin.id,
                source_lang: lang,
                target_lang: "ko",
                source_text: originalText,
                translated_text: JSON.stringify({ text: translated, pron, rev }),
                client_message_id: tempId,
            };

            const msgRes = await fetch("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = msgRes.ok ? ((await msgRes.json()) as ChatMessageResponse) : {};
            if (msgRes.ok && data.message) {
                // 임시 메시지를 실제 DB 메시지로 교체
                setMessages(prev => prev.map(m => m.id === tempId ? data.message as Message : m));
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
        setSttError("");
        setText(prev => prev ? `${prev} ${transcript}` : transcript);
    }, []);

    const { isRecording, toggle: toggleRecording } = useCloudSTT({
        lang,
        onTranscript: handleTranscript,
        onError: (_type, message) => setSttError(message),
        chunkInterval: 4000,   // 4s max — 채팅은 짧은 발화, 10s 대기 불필요
        silenceDuration: 1200, // 1.2s 침묵 = 대화형 자연 휴지
        context: "chat",
    });

    const t = getUI(lang);
    const parseMsg = (raw: unknown): ParsedMessage => {
        if (!raw) return { text: "", pron: "", rev: "" };
        if (typeof raw === "object") return raw as ParsedMessage;
        try { return JSON.parse(raw as string) as ParsedMessage; } catch { return { text: String(raw), pron: "", rev: "" }; }
    };

    // Filter admins based on user criteria: ROOT excluded, friends/site prioritized
    const filteredAdmins = admins
        .filter(a => {
            // Show friends, same-site staff, or ALL if no specific site set (inclusive fallback)
            if (friendIds.has(a.id)) return true;
            if (siteId && a.site_id === siteId) return true;
            if (!siteId) return true; // Show all if site unknown to prevent empty list
            return false;
        })
        .sort((a, b) => {
            const activityDelta = (adminActivity[b.id] || 0) - (adminActivity[a.id] || 0);
            if (activityDelta !== 0) return activityDelta;
            return Number(friendIds.has(b.id)) - Number(friendIds.has(a.id));
        });

    return (
        <RoleGuard allowedRole="worker">
            <div
                className="h-dvh min-h-0 overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans"
                style={{ borderBottomWidth: 0 }}
            >
                <header className="concept-page-header safe-area-sticky-top sticky z-50">
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
                        <button onClick={toggleVoice} className="min-h-11 min-w-11 flex flex-col items-center justify-center gap-0.5">
                            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${voiceEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${voiceEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </div>
                            <span className={`text-[8px] font-black tracking-widest uppercase transition-colors ${voiceEnabled ? 'text-blue-500' : 'text-slate-400'}`}>
                                {voiceEnabled ? 'VOC ON' : 'VOC OFF'}
                            </span>
                        </button>
                        <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                            <button onClick={() => changeGender('male')} className={`min-h-11 min-w-11 px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{t.male || "MALE"}</button>
                            <button onClick={() => changeGender('female')} className={`min-h-11 min-w-11 px-2 py-1 rounded-full text-[9px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}>{t.female || "FEMALE"}</button>
                        </div>
                        <button aria-label={t.conversationList || "Conversation list"} onClick={() => setShowSidebar(!showSidebar)} className="min-h-11 min-w-11 p-2 rounded-full hover:bg-slate-100 text-slate-500 relative transition-all">
                            <Users className="w-6 h-6" />
                            {Object.values(unreadAdmins).reduce((a, b) => a + b, 0) > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-[2px] border-white text-white text-[10px] font-black flex items-center justify-center">
                                    {Object.values(unreadAdmins).reduce((a, b) => a + b, 0)}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                <main className="min-h-0 flex-1 flex w-full max-w-6xl mx-auto overflow-hidden relative">
                    <div className={`${!activeAdmin || showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col border-r border-slate-200 bg-white p-4 overflow-y-auto shrink-0 z-30`}>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t.title}</h2>
                            <QrCode className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="relative mb-4 h-28 w-full overflow-hidden rounded-2xl border border-slate-200">
                            <picture>
                                <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/translate.webp" />
                                <Image src="/images/mobile-v3/website/translate.webp" alt="Worker translation chat" fill className="object-cover" />
                            </picture>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {filteredAdmins.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 font-bold italic px-4">
                                    {t.noAdmins || "No administrators are registered."}
                                </div>
                            ) : (
                                filteredAdmins.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => { setActiveAdmin(a); setShowSidebar(false); }}
                                        className={`flex items-center gap-4 p-4 rounded-3xl transition-all border ${activeAdmin?.id === a.id ? 'bg-blue-100 border-blue-200 text-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 relative ${activeAdmin?.id === a.id ? 'bg-blue-200' : 'bg-white/20'} ${onlineUsers.has(a.id) ? 'ring-2 ring-green-400/60' : ''}`}>
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

                    <div className={`${!activeAdmin ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col bg-[#f5f8fa] overflow-hidden relative`}>
                        {activeAdmin ? (
                            <>
                                <div ref={messagesContainerRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-4 md:p-8 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(circle at center, #cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
                                    {hasMore && (
                                        <button disabled={loadingOlder} onClick={async () => {
                                            if (loadingOlder || messages.length === 0 || !activeAdmin) return;
                                            setLoadingOlder(true);
                                            try {
                                                const oldest = messages[0];
                                                const res = await fetch(`/api/chat/messages?peer_id=${activeAdmin.id}&limit=${MSG_PAGE_SIZE}&before=${encodeURIComponent(oldest.created_at)}`, {
                                                    cache: "no-store",
                                                });
                                                if (res.ok) {
                                                    const payload = (await res.json()) as ChatMessagesResponse;
                                                    const older = payload.messages ?? [];
                                                    if (older.length > 0) setMessages(prev => [...older, ...prev]);
                                                    setHasMore(older.length >= MSG_PAGE_SIZE);
                                                }
                                            } finally {
                                                setLoadingOlder(false);
                                            }
                                        }} className="self-center px-4 py-2 text-xs font-black text-slate-400 hover:text-slate-600 bg-white/80 rounded-full border border-slate-200 tap-effect uppercase tracking-widest disabled:opacity-50">
                                            {loadingOlder ? '...' : t.older || 'Older messages'}
                                        </button>
                                    )}
                                    <AnimatePresence initial={false}>
                                        {messages.map((m, i) => {
                                            const isMe = m.from_user === myId;
                                            const parsed = parseMsg(m.translated_text);
                                            return (
                                                <motion.div key={m.id || i} initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'mr-3' : 'ml-3'}`}>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isMe ? t.me : activeAdmin.display_name}</span>
                                                        <ChatPlayButton onClick={() => {
                                                                if (!voiceEnabled) return;
                                                                if (isMe) {
                                                                    playAudio(m.id, m.source_text, lang);
                                                                } else {
                                                                    // 관리자 메시지: 번역문(근로자 언어)이 있으면 번역 재생, 없으면 원문(한국어) 재생
                                                                    const audioText = parsed.text || m.source_text;
                                                                    const audioLang = parsed.text ? lang : 'ko';
                                                                    playAudio(m.id, audioText, audioLang);
                                                                }
                                                            }} disabled={!voiceEnabled} playing={playingMessageId === m.id} />
                                                    </div>
                                                    <div className={`p-5 rounded-[32px] shadow-lg border-2 flex flex-col gap-3 ${isMe ? 'bg-blue-100 border-blue-200 rounded-tr-sm text-slate-900' : 'bg-white border-slate-200 rounded-tl-sm text-slate-800'}`}>

                                                        {isMe ? (
                                                            // ── 내가 보낸 메시지: 원문(내 언어) + 하단에 한국어 번역 ──
                                                            <>
                                                                <div className="flex flex-col gap-1">
                                                                    <p className="font-black text-2xl md:text-3xl leading-snug whitespace-pre-wrap">{m.source_text}</p>
                                                                    {m.is_read === false && (
                                                                        <span className="text-[11px] font-black text-blue-700 self-end mr-2 leading-none">1</span>
                                                                    )}
                                                                </div>
                                                                {parsed.text && parsed.text !== m.source_text && (
                                                                    <div className="pt-3 border-t border-blue-200 flex items-start gap-1.5">
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-blue-200 text-blue-800 shrink-0 mt-0.5 font-black">{t.translation || "Translation"}</span>
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
                                    <div aria-hidden="true" className="h-px shrink-0" />
                                </div>
                                <div className="sticky bottom-0 z-40 shrink-0 bg-white border-t border-slate-200 px-2 pt-2 md:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] flex gap-2 items-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.25rem)" }}>
                                    {sttError && (
                                        <p role="status" aria-live="polite" className="absolute -top-10 left-3 right-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 shadow-sm">
                                            {sttError}
                                        </p>
                                    )}
                                    <button onClick={toggleRecording} className={`flex h-12 w-12 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-full shadow-md transition-all border-2 ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400'}`}><svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                                    <div className="relative flex min-w-0 flex-1 items-center bg-slate-50 border-2 border-slate-200 rounded-[28px] md:rounded-[36px] overflow-hidden focus-within:border-blue-500 transition-all shadow-inner">
                                        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isRecording ? t.listening : t.chatPlaceholder} className="w-full min-w-0 overflow-hidden whitespace-pre-wrap bg-transparent px-3 py-3 md:p-5 md:pl-8 text-slate-800 text-base md:text-lg font-black outline-none resize-none min-h-[52px] md:min-h-[64px] leading-snug placeholder:whitespace-nowrap placeholder:text-sm placeholder:font-bold placeholder:tracking-tight placeholder:text-slate-400" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                                        <button onClick={handleSend} disabled={!text.trim() || isSending} className="mr-2 md:mr-3 flex h-11 w-11 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-30 shadow-md transform active:scale-95 transition-all">{isSending ? <div className="w-6 h-6 md:w-7 md:h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6 md:w-7 md:h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>}</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
                                <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 shadow-inner">
                                    <Users className="w-16 h-16" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-400 uppercase tracking-widest leading-tight">{t.selectAdmin}</h2>
                                <p className="text-slate-400 font-bold max-w-xs">{t.assistantHint || ""}</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <style jsx global>{`::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }`}</style>

            {/* 🤖 Tier 3 Ambient Edge Agent */}
            <SwarmAgentHUD lang={lang} />
        </RoleGuard>
    );
}

export default function WorkerChat() {
    return (<Suspense fallback={<div className="min-h-screen bg-white" />}><WorkerChatContent /></Suspense>);
}

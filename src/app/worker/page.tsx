"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const workerUI: Record<string, any> = {
    ko: {
        greeting: (name: string) => `반갑습니다, ${name}님`,
        tbmBadge: "금일 안전 지침 (TBM)",
        tbmDesc: "작업 투입 전, 반드시 확인하고 서명해야 하는 안전 수칙이 도착했습니다.",
        tbmBtn: "확인 및 서명하기",
        newTBM: "🚨 새 안전 지침이 도착했습니다!",
        chatTitle: "실시간 대화",
        chatDesc: "버튼을 눌러 관리자와 대화할 수 있습니다.",
        chatBtn: "채널 열기",
        signOut: "로그아웃",
        safeWork: "오늘도 안전하게!",
        status: "작업 준비 상태",
        newChat: "🚨 관리자가 대화를 요청했습니다!",
        openChat: "대화방 입장",
    },
    en: {
        greeting: (name: string) => `Welcome, ${name}`,
        tbmBadge: "Today's Safety (TBM)",
        tbmDesc: "Safety instructions have arrived. Please review and sign before starting work.",
        tbmBtn: "View & Sign",
        newTBM: "🚨 New Safety Alert!",
        chatTitle: "Live Chat",
        chatDesc: "Tap to chat with admin.",
        chatBtn: "Open Chat",
        signOut: "Sign out",
        safeWork: "Work Safe Today!",
        status: "Status",
        newChat: "🚨 Admin requested a chat!",
        openChat: "Enter Chat",
    },
    zh: {
        greeting: (name: string) => `您好, ${name}`,
        tbmBadge: "今日安全 (TBM)",
        tbmDesc: "安全简报已送达。请在开始工作前阅读并签名。",
        tbmBtn: "确认并签名",
        newTBM: "🚨 收到新的安全警报！",
        chatTitle: "实时聊天",
        chatDesc: "点击即可与管理员（Admin）聊天。",
        chatBtn: "打开频道",
        signOut: "退出",
        safeWork: "祝您今天工作安全！",
        status: "状态",
        newChat: "🚨 管理员请求与您对话！",
        openChat: "进入聊天",
    },
    vi: {
        greeting: (name: string) => `Chào mừng, ${name}`,
        tbmBadge: "Chỉ dẫn an toàn (TBM)",
        tbmDesc: "Đã có chỉ dẫn an toàn. Vui lòng xem và ký trước khi làm việc.",
        tbmBtn: "Xem và Ký",
        newTBM: "🚨 Cảnh báo an toàn mới!",
        chatTitle: "Trò chuyện",
        chatDesc: "Nhấn để trò chuyện với quản trị viên.",
        chatBtn: "Mo ho tro",
        signOut: "Đăng xuất",
        safeWork: "Làm việc an toàn hôm nay!",
        status: "Trạng thái",
        newChat: "🚨 Quản trị viên muốn trò chuyện!",
        openChat: "Vào trò chuyện",
    },
    th: {
        greeting: (name: string) => `ยินดีต้อนรับ, ${name}`,
        tbmBadge: "คำแนะนำความปลอดภัย (TBM)",
        tbmDesc: "มีคำแนะนำความปลอดภัยมาถึงแล้ว โปรดตรวจสอบและลงนามก่อนเริ่มงาน",
        tbmBtn: "ดูและลงนาม",
        newTBM: "🚨 การแจ้งเตือนใหม่!",
        chatTitle: "แชทสด",
        chatDesc: "แตะเพื่อพูดคุยกับผู้ดูแล",
        chatBtn: "เปิดแชท",
        signOut: "ออกจากระบบ",
        safeWork: "ทำงานอย่างปลอดภัยวันนี้!",
        status: "สถานะ",
        newChat: "🚨 ผู้ดูแลระบบขอแชท!",
        openChat: "เข้าสู่แชท",
    },
};
const getUI = (lang: string) => workerUI[lang] || workerUI["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

function WorkerHomeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [profile, setProfile] = useState<any>(null);
    const [hasNewTBM, setHasNewTBM] = useState(false);
    const [newTBMTime, setNewTBMTime] = useState<string>("");

    // 신규 채팅 알림 관련 상태
    const [hasNewChat, setHasNewChat] = useState(false);
    const [newChatTime, setNewChatTime] = useState<string>("");

    const [isLoaded, setIsLoaded] = useState(false);

    const urlLang = searchParams.get("lang");

    const triggerAlert = () => {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch { }
    };

    useEffect(() => {
        const supabase = createClient();
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .single();

                if (urlLang && urlLang !== data?.preferred_lang) {
                    await supabase
                        .from("profiles")
                        .update({ preferred_lang: urlLang })
                        .eq("id", session.user.id);
                    setProfile({ ...data, preferred_lang: urlLang });
                } else {
                    setProfile(data);
                }
                setIsLoaded(true);
            }
        };
        fetchProfile();

        const channel = supabase
            .channel("worker_tbm_realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "tbm_notices" },
                (payload) => {
                    setHasNewTBM(true);
                    setNewTBMTime(new Date().toLocaleTimeString());
                    triggerAlert();
                }
            )
            .subscribe();

        // 관리자가 보낸 1:1 메시지 감지 리스너 추가
        const chatChannel = supabase
            .channel(`worker_home_chat_alert`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                async (payload) => {
                    const msg = payload.new as any;
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session && msg.to_user === session.user.id) {
                        setHasNewChat(true);
                        setNewChatTime(new Date().toLocaleTimeString());
                        triggerAlert();

                        // 자동 활성화 옵션: 알림과 함께 즉각적인 대화창 이동 지원 (선택적)
                        // router.push("/worker/chat"); 
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(chatChannel);
        };
    }, [urlLang]);

    const lang = profile?.preferred_lang || urlLang || "ko";
    const t = getUI(lang);
    const iso = isoMap[lang] || "un";

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-8 pb-12 font-sans selection:bg-red-500/30">

                {/* 💎 Premium Header */}
                <header className="flex justify-between items-start animate-float">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase text-gradient">Safe-Link</h1>
                            <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] text-green-400 font-black tracking-widest leading-none">LIVE</span>
                            </div>
                        </div>
                        <p className="text-slate-400 font-bold text-lg leading-tight uppercase tracking-tight">
                            {profile ? t.greeting(profile.display_name || "Worker") : "Connecting..."}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-3 glass px-4 py-2 rounded-full border-white/5 shadow-xl">
                            <img src={`https://flagcdn.com/w40/${iso}.png`} alt={lang} className="w-8 h-5.5 object-cover rounded-sm shadow-md" />
                            <span className="text-xs text-white font-black">{lang.toUpperCase()}</span>
                        </div>
                        <button onClick={handleSignOut} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest py-1 transition-colors">
                            {t.signOut}
                        </button>
                    </div>
                </header>

                {/* 🚀 New Notification (High Impact) */}
                {hasNewTBM && (
                    <div
                        className="relative overflow-hidden p-8 glass-red rounded-[40px] border-red-500 border-2 shadow-[0_0_60px_-15px_rgba(239,68,68,0.6)] cursor-pointer tap-effect group"
                        onClick={() => { setHasNewTBM(false); router.push("/worker/tbm/today"); }}
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white relative">
                                <div className="absolute inset-0 bg-white rounded-3xl animate-ping opacity-20" />
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-white italic lowercase tracking-tight">{t.newTBM}</h2>
                                <p className="text-red-200/60 font-medium text-sm">Arrived at {newTBMTime}</p>
                            </div>
                            <div className="w-12 h-12 glass rounded-full flex items-center justify-center text-white group-hover:translate-x-1 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
                {/* 💬 신규 채팅 알림 (강제 팝업 형태) */}
                {hasNewChat && (
                    <div
                        className="relative overflow-hidden p-8 bg-blue-600/90 backdrop-blur-md rounded-[40px] border-blue-400 border-2 shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)] cursor-pointer tap-effect animate-float z-50 transform transition-all hover:scale-[1.02]"
                        onClick={() => { setHasNewChat(false); router.push("/worker/chat"); }}
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-white relative shadow-inner">
                                <div className="absolute inset-0 bg-white rounded-3xl animate-ping opacity-30" />
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-1">{t.newChat}</h2>
                                <p className="text-blue-100/80 font-bold text-sm">Requested at {newChatTime}</p>
                            </div>
                            <div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-50 transition-colors">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 3l14 9-14 9V3z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🎯 Daily TBM (The Main Mission) */}
                <section className="glass rounded-[48px] p-10 border-white/10 shadow-3xl relative overflow-hidden flex flex-col gap-10">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none" />

                    <div className="flex flex-col gap-4 relative">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-8 bg-red-500 rounded-full" />
                            <h2 className="text-2xl font-black text-white text-gradient uppercase tracking-tighter">{t.tbmBadge}</h2>
                        </div>
                        <p className="text-xl font-bold text-slate-400 leading-snug">
                            {t.tbmDesc}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.status}</span>
                            <span className="text-xl font-black text-red-400 italic">WAITING</span>
                        </div>
                        <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 flex flex-col gap-2 text-right">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Sign Rate</span>
                            <span className="text-xl font-black text-blue-400 italic">82%</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/worker/tbm/today")}
                        className="w-full py-8 bg-gradient-to-br from-green-400 to-green-600 text-slate-950 text-2xl font-black rounded-[32px] shadow-[0_20px_50px_-15px_rgba(34,197,94,0.4)] transition-all tap-effect hover:scale-[1.02]"
                    >
                        {t.tbmBtn.toUpperCase()}
                    </button>
                </section>

                {/* 💬 Communication Section */}
                <section
                    onClick={() => router.push('/worker/chat')}
                    className="glass rounded-[40px] p-8 border-white/10 hover:border-blue-500/30 relative overflow-hidden group cursor-pointer tap-effect transition-all"
                >
                    <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                    <div className="flex items-center gap-6 mb-8 relative">
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-blue-400 shadow-lg">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-white">{t.chatTitle}</h2>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{t.chatDesc}</p>
                        </div>
                    </div>
                    <button className="w-full py-5 bg-blue-600/20 text-blue-300 font-black flex items-center justify-center gap-3 group-hover:bg-blue-600/30 transition-colors rounded-2xl relative z-10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        {t.chatBtn.toUpperCase()}
                    </button>
                </section>

                {/* 🛡️ Footer Brand */}
                <footer className="mt-auto flex flex-col items-center gap-4 py-6">
                    <div className="flex items-center gap-2 opacity-20">
                        <div className="w-8 h-8 rounded-lg bg-white/20" />
                        <span className="font-black text-xl italic text-white uppercase tracking-tighter">Safe-Link OS</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-700 tracking-[0.4em] uppercase">{t.safeWork}</p>
                </footer>

            </div>
        </RoleGuard>
    );
}

export default function WorkerHome() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <WorkerHomeContent />
        </Suspense>
    );
}

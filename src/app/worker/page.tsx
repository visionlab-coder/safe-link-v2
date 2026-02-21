"use client";
import { useEffect, useState, useRef } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const workerUI: Record<string, any> = {
    ko: {
        greeting: (name: string) => `안녕하세요, ${name}님`,
        tbmBadge: "필수 확인 (TBM)",
        tbmDesc: "금일 작업 전 안전 브리핑이 도착했습니다. 내용을 확인하고 반드시 서명해 주세요.",
        tbmBtn: "내용 확인 및 서명하기",
        newTBM: "🚨 새 TBM이 도착했습니다! 즉시 확인하세요!",
        chatTitle: "1:1 실시간 번역 대화",
        chatDesc: "TBM 서명을 완료해야 관리자와 통신할 수 있습니다.",
        chatBtn: "대기중...",
        signOut: "로그아웃",
    },
    en: {
        greeting: (name: string) => `Hello, ${name}`,
        tbmBadge: "REQUIRED: Safety Briefing (TBM)",
        tbmDesc: "A safety briefing has arrived. Please review and sign before starting work.",
        tbmBtn: "View & Sign",
        newTBM: "🚨 New TBM arrived! Check it now!",
        chatTitle: "1:1 Live Translation Chat",
        chatDesc: "Complete TBM signing to communicate with admin.",
        chatBtn: "Waiting...",
        signOut: "Sign out",
    },
    zh: {
        greeting: (name: string) => `您好，${name}`,
        tbmBadge: "必须确认（TBM）",
        tbmDesc: "今日工作前的安全简报已送达。请确认内容并签名。",
        tbmBtn: "查看内容并签名",
        newTBM: "🚨 收到新的TBM！请立即确认！",
        chatTitle: "1对1实时翻译对话",
        chatDesc: "完成TBM签名后，才能与管理员通信。",
        chatBtn: "等待中...",
        signOut: "退出",
    },
    vi: {
        greeting: (name: string) => `Xin chào, ${name}`,
        tbmBadge: "BẮT BUỘC: Thông báo an toàn (TBM)",
        tbmDesc: "Thông báo an toàn đã đến. Vui lòng xác nhận và ký trước khi làm việc.",
        tbmBtn: "Xem và Ký",
        newTBM: "🚨 TBM mới đã đến! Hãy kiểm tra ngay!",
        chatTitle: "Trò chuyện 1:1",
        chatDesc: "Hoàn tất ký TBM để liên lạc với quản trị viên.",
        chatBtn: "Đang chờ...",
        signOut: "Đăng xuất",
    },
    th: {
        greeting: (name: string) => `สวัสดี, ${name}`,
        tbmBadge: "จำเป็น: TBM",
        tbmDesc: "มีสรุปความปลอดภัยก่อนทำงาน กรุณาตรวจสอบและลงนาม",
        tbmBtn: "ดูและลงนาม",
        newTBM: "🚨 TBM ใหม่มาถึง! ตรวจสอบตอนนี้!",
        chatTitle: "แชท 1:1",
        chatDesc: "ลงนาม TBM ก่อนจึงจะสื่อสารได้",
        chatBtn: "รอ...",
        signOut: "ออกจากระบบ",
    },
};
const getUI = (lang: string) => workerUI[lang] || workerUI["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

export default function WorkerHome() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [hasNewTBM, setHasNewTBM] = useState(false);     // 🔴 실시간 알림
    const [newTBMTime, setNewTBMTime] = useState<string>(""); // 언제 도착했는지
    const audioRef = useRef<AudioContext | null>(null);

    // 진동 + 알림음 (모바일)
    const triggerAlert = () => {
        // 진동
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }
        // 간단한 비프음 (Web Audio API)
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch { }
    };

    useEffect(() => {
        const supabase = createClient();

        // 1. 프로필 로드
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .single();
                setProfile(data);
            }
        };
        fetchProfile();

        // 2. ⚡ Supabase Realtime — tbm_notices INSERT 구독
        const channel = supabase
            .channel("worker_tbm_realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "tbm_notices" },
                (payload) => {
                    console.log("🚨 새 TBM 수신:", payload);
                    setHasNewTBM(true);
                    setNewTBMTime(new Date().toLocaleTimeString());
                    triggerAlert();
                }
            )
            .subscribe((status) => {
                console.log("📡 Realtime 연결 상태:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const lang = profile?.preferred_lang || "ko";
    const t = getUI(lang);
    const iso = isoMap[lang] || "un";

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col gap-6">
                {/* 헤더 */}
                <header className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black tracking-wider text-green-400">SAFE-LINK</h1>
                            {/* 📡 실시간 연결 표시 */}
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[9px] text-green-600 font-black uppercase tracking-widest">LIVE</span>
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-bold">
                            {profile ? t.greeting(profile.display_name || "") : "연결 중..."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {profile?.preferred_lang && (
                            <div className="flex items-center gap-1.5">
                                <img src={`https://flagcdn.com/w40/${iso}.png`} alt={lang} className="w-7 h-5 object-cover rounded-sm" />
                                <span className="text-[10px] text-slate-500 uppercase font-black">{lang}</span>
                            </div>
                        )}
                        <div className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full font-bold text-xs border border-green-500/30">
                            Worker
                        </div>
                        <button onClick={handleSignOut} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full text-xs font-bold transition-colors">
                            {t.signOut}
                        </button>
                    </div>
                </header>

                {/* 🚨 실시간 신규 TBM 알림 배너 */}
                {hasNewTBM && (
                    <div
                        className="relative overflow-hidden p-5 bg-red-500 rounded-[24px] cursor-pointer animate-bounce shadow-[0_0_40px_rgba(239,68,68,0.6)]"
                        onClick={() => { setHasNewTBM(false); router.push("/worker/tbm/today"); }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 opacity-80" />
                        <div className="relative flex items-center gap-4">
                            <div className="w-5 h-5 rounded-full bg-white animate-ping flex-shrink-0" />
                            <div>
                                <p className="font-black text-xl text-white">{t.newTBM}</p>
                                {newTBMTime && <p className="text-red-100 text-sm mt-0.5">{newTBMTime} 수신</p>}
                            </div>
                            <svg className="w-8 h-8 text-white ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* 기존 TBM 카드 */}
                <div className="relative overflow-hidden p-8 bg-slate-800/80 rounded-[32px] border-2 border-red-500/50 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)]">
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500" />
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
                        <h2 className="text-2xl font-extrabold text-red-400">{t.tbmBadge}</h2>
                    </div>
                    <p className="text-lg font-bold mb-8 leading-relaxed text-slate-200">{t.tbmDesc}</p>
                    <button
                        onClick={() => router.push("/worker/tbm/today")}
                        className="w-full py-6 text-xl font-extrabold bg-green-500 hover:bg-green-400 text-slate-950 rounded-2xl shadow-lg transition-transform active:scale-95"
                    >
                        {t.tbmBtn}
                    </button>
                </div>

                {/* 채팅 (비활성) */}
                <div className="p-8 bg-slate-800/40 rounded-[32px] border border-slate-700/50 opacity-50">
                    <h2 className="text-xl font-bold mb-3 text-slate-400">{t.chatTitle}</h2>
                    <p className="text-slate-500 mb-6">{t.chatDesc}</p>
                    <button disabled className="w-full py-4 font-bold bg-slate-700 text-slate-500 rounded-xl cursor-not-allowed">
                        {t.chatBtn}
                    </button>
                </div>
            </div>
        </RoleGuard>
    );
}

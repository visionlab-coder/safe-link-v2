"use client";
import { useEffect, useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// 관리자 모드: 한국어 / 영어 / 중국어 3개 (그 외 언어는 영어 fallback)
const adminUI: Record<string, any> = {
    ko: {
        board: "실시간 관제 보드",
        boardDesc: "현장 TBM 전파 및 근로자 통신 현황을 모니터링합니다.",
        tbmTitle: "TBM 전파",
        tbmDesc: "안전 지침을 작성하고 모든 외국인 근로자에게 모국어로 전송합니다.",
        tbmBtn: "새 브로드캐스트",
        chatTitle: "1:1 AI 대화",
        chatDesc: "근로자와의 통신을 실시간으로 자동 번역합니다.",
        chatBtn: "채널 열기",
        statusTitle: "서명 현황",
        statusDesc: "근로자들의 TBM 확인 및 법적 서명 완료 여부를 실시간으로 파악합니다.",
        signOut: "로그아웃",
        roleLabel: { HQ_ADMIN: "현장 소장", SAFETY_OFFICER: "안전관리자", WORKER: "근로자" },
        greeting: (name: string) => `반갑습니다, ${name}님`,
    },
    en: {
        board: "Live Control Board",
        boardDesc: "Monitor TBM status and worker communication in real-time.",
        tbmTitle: "TBM Broadcast",
        tbmDesc: "Create safety guidelines and push to all workers in native languages.",
        tbmBtn: "New Broadcast",
        chatTitle: "1:1 AI Chat",
        chatDesc: "Real-time auto-translation for communication with foreign workers.",
        chatBtn: "Open Chat",
        statusTitle: "Sign Status",
        statusDesc: "Check TBM acknowledgments and legal signatures in real-time.",
        signOut: "Sign out",
        roleLabel: { HQ_ADMIN: "Site Manager", SAFETY_OFFICER: "Safety Officer", WORKER: "Worker" },
        greeting: (name: string) => `Welcome, ${name}`,
    },
    zh: {
        board: "实时控制台",
        boardDesc: "实时监控TBM发布状态及工人通信情况。",
        tbmTitle: "TBM广播",
        tbmDesc: "撰写安全指示并以各工人母语批量分发。",
        tbmBtn: "新建广播",
        chatTitle: "1对1 AI聊天",
        chatDesc: "与外国工人沟通时的实时自动翻译。",
        chatBtn: "打开频道",
        statusTitle: "签名状态",
        statusDesc: "实时查看工人对TBM的确认及签名完成情况。",
        signOut: "退出",
        roleLabel: { HQ_ADMIN: "现场主管", SAFETY_OFFICER: "安全管理员", WORKER: "工人" },
        greeting: (name: string) => `您好, ${name}`,
    },
};
const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

function AdminDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; prefLang: string } | null>(null);

    // URL 파라미터로 명시적으로 전달된 언어가 있는지 확인 (override)
    const urlLang = searchParams.get("lang");

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, preferred_lang, display_name")
                    .eq("id", session.user.id)
                    .single();

                let finalLang = profile?.preferred_lang || "ko";

                // 🚨 핵심 로직: URL에 lang이 있고, DB 설정과 다르면 DB를 업데이트하고 현재 UI 언어도 바꿈
                if (urlLang && urlLang !== profile?.preferred_lang) {
                    await supabase
                        .from("profiles")
                        .update({ preferred_lang: urlLang })
                        .eq("id", session.user.id);
                    finalLang = urlLang;
                }

                setCurrentUser({
                    name: profile?.display_name || "Manager",
                    email: session.user.email || "",
                    role: profile?.role || "SAFETY_OFFICER",
                    prefLang: finalLang,
                });
            }
        };
        load();
    }, [urlLang]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    const lang = currentUser?.prefLang || urlLang || "ko";
    const t = getUI(lang);
    const roleDisplay = currentUser ? ((t.roleLabel as any)[currentUser.role] || currentUser.role) : "Admin";

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-8 pb-12 font-sans selection:bg-blue-500/30">

                {/* 💎 Premium Header */}
                <header className="flex justify-between items-start animate-float">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase text-gradient">Safe-Link</h1>
                            <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[10px] text-blue-400 font-black tracking-widest leading-none">ADMIN HUB</span>
                            </div>
                        </div>
                        <p className="text-slate-400 font-bold text-lg leading-tight uppercase tracking-tight">
                            {currentUser ? t.greeting(currentUser.name) : "Authenticating..."}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className={`px-4 py-2 glass rounded-full border border-white/5 shadow-xl text-xs font-black tracking-widest uppercase ${currentUser?.role === 'HQ_ADMIN' ? 'text-blue-400 border-blue-500/20' : 'text-amber-400 border-amber-500/20'
                            }`}>
                            {roleDisplay}
                        </div>
                        <button onClick={handleSignOut} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest py-1 transition-colors">
                            {t.signOut}
                        </button>
                    </div>
                </header>

                <div className="flex flex-col gap-2 relative">
                    <h2 className="text-5xl font-black text-white text-gradient tracking-tighter uppercase">{t.board}</h2>
                    <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">{t.boardDesc}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 📡 TBM Broadcast Card */}
                    <section className="glass rounded-[48px] p-10 border-white/10 shadow-3xl relative overflow-hidden flex flex-col gap-10 group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none group-hover:bg-blue-600/20 transition-all duration-1000" />

                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-blue-500 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.tbmTitle}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.tbmDesc}</p>
                        </div>

                        <button
                            onClick={() => router.push('/admin/tbm/create')}
                            className="mt-auto w-full py-6 bg-gradient-to-br from-blue-400 to-blue-600 text-slate-950 text-xl font-black rounded-[28px] shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] transition-all tap-effect hover:scale-[1.02]"
                        >
                            {t.tbmBtn.toUpperCase()}
                        </button>
                    </section>

                    {/* 💬 AI Chat Card */}
                    <section className="glass rounded-[48px] p-10 border-white/5 opacity-40 grayscale-[0.8] relative overflow-hidden flex flex-col gap-10 group">
                        <div className="flex flex-col gap-4">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-slate-500 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.chatTitle}</h3>
                            <p className="text-slate-500 font-bold leading-relaxed">{t.chatDesc}</p>
                        </div>

                        <button disabled className="mt-auto w-full py-6 bg-slate-800 text-slate-600 text-xl font-black rounded-[28px] flex items-center justify-center gap-3">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {t.chatBtn.toUpperCase()}
                        </button>
                    </section>

                    {/* ✅ Big Signature Status Card */}
                    <section
                        onClick={() => router.push('/admin/tbm/status')}
                        className="md:col-span-2 glass rounded-[48px] p-10 border-white/10 hover:border-green-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-green-500/10" />

                        <div className="flex items-center justify-between relative">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-8 bg-green-500 rounded-full" />
                                    <h3 className="text-4xl font-black text-white text-gradient uppercase italic">{t.statusTitle}</h3>
                                </div>
                                <p className="text-slate-400 font-bold max-w-xl text-lg leading-relaxed">
                                    {t.statusDesc}
                                </p>
                            </div>
                            <div className="w-20 h-20 glass rounded-full flex items-center justify-center text-green-500 group-hover:translate-x-3 transition-all duration-500 shadow-green-500/20 shadow-2xl">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                        </div>
                    </section>
                </div>

                {/* 🛡️ Footer Brand */}
                <footer className="mt-auto flex flex-col items-center gap-4 py-8">
                    <div className="flex items-center gap-2 opacity-10">
                        <div className="w-10 h-10 rounded-xl bg-white/20" />
                        <span className="font-black text-2xl italic text-white uppercase tracking-tighter">Safe-Link Console</span>
                    </div>
                </footer>
            </div>
        </RoleGuard>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <AdminDashboardContent />
        </Suspense>
    );
}

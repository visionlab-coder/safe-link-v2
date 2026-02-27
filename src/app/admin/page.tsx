"use client";
import { useEffect, useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import SiteAgentBriefing from "@/components/agents/SiteAgentBriefing";

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
        glossaryTitle: "용어 사전 관리",
        glossaryDesc: "현장 은어를 등록하고 표준어 변환을 관리합니다.",
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
        glossaryTitle: "Glossary Management",
        glossaryDesc: "Manage site slang and standard term translations.",
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
        glossaryTitle: "术语词典管理",
        glossaryDesc: "管理现场行话及标准用语转换。",
        signOut: "退出",
        roleLabel: { HQ_ADMIN: "现场主管", SAFETY_OFFICER: "安全管理员", WORKER: "工人" },
        greeting: (name: string) => `您好, ${name}`,
    },
};
const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

function AdminDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentUser, setCurrentUser] = useState<{
        name: string;
        email: string;
        role: string;
        prefLang: string;
        title?: string;
        site_code?: string;
    } | null>(null);

    // URL 파라미터로 명시적으로 전달된 언어가 있는지 확인 (override)
    const urlLang = searchParams.get("lang");

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, preferred_lang, display_name, title, site_code")
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
                    title: profile?.title,
                    site_code: profile?.site_code,
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
    const siteId = searchParams.get("site_id");
    const siteName = siteId === "1" ? "SITE ALPHA" : siteId === "2" ? "SITE BETA" : siteId === "3" ? "SITE GAMMA" : null;

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
                                <span className="text-[10px] text-blue-400 font-black tracking-widest leading-none">FIELD UNIT</span>
                            </div>
                            {siteName && (
                                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    <MapPin className="w-2.5 h-2.5 text-amber-500" />
                                    <span className="text-[10px] text-amber-500 font-black tracking-widest">{siteName}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-400 font-bold text-lg leading-tight uppercase tracking-tight">
                            {currentUser ? t.greeting(currentUser.name) : "Authenticating..."}
                            {currentUser?.title && <span className="text-slate-600 ml-2">[{currentUser.title}]</span>}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className={`px-4 py-2 glass rounded-full border border-white/5 shadow-xl text-xs font-black tracking-widest uppercase ${currentUser?.role === 'HQ_ADMIN' ? 'text-blue-400 border-blue-500/20' : 'text-amber-400 border-amber-500/20'
                            }`}>
                            {roleDisplay}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => router.push('/auth/setup')} className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest py-1 transition-colors">
                                Profile Edit
                            </button>
                            <button onClick={handleSignOut} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest py-1 transition-colors">
                                {t.signOut}
                            </button>
                        </div>
                        {currentUser?.role === 'ROOT' && (
                            <button onClick={() => router.push('/system')} className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest transition-all mt-1">
                                ← Return to Global HQ
                            </button>
                        )}
                        {currentUser?.role === 'HQ_ADMIN' && (
                            <button onClick={() => router.push('/control')} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-full text-[10px] font-black text-blue-300 uppercase tracking-widest transition-all mt-1 shadow-lg flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                Enterprise Control Center
                            </button>
                        )}
                    </div>
                </header>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col gap-2 relative mt-4"
                >
                    <h2 className="text-5xl font-black text-white text-gradient tracking-tighter uppercase">{t.board}</h2>
                    <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">{t.boardDesc}</p>
                </motion.div>

                {/* 🤖 Tier 2: Site Agent Briefing (Role-specific) */}
                {currentUser && (
                    <SiteAgentBriefing
                        role={currentUser.role}
                        siteId={siteId}
                        lang={currentUser.prefLang}
                    />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    {/* 📡 TBM Broadcast Card */}
                    <motion.section
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="glass rounded-[48px] p-10 border-white/10 shadow-3xl relative overflow-hidden flex flex-col gap-10 group"
                    >
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
                    </motion.section>

                    {/* 💬 AI Chat Card */}
                    <motion.section
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="glass rounded-[48px] p-10 border-white/10 relative overflow-hidden flex flex-col gap-10 group transition-all hover:border-blue-500/30"
                    >
                        <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full -ml-24 -mt-24 pointer-events-none group-hover:bg-blue-500/20 transition-all duration-1000" />
                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-blue-400 mb-2 shadow-lg">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.chatTitle}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.chatDesc}</p>
                        </div>

                        <button
                            onClick={() => router.push('/admin/chat')}
                            className="mt-auto w-full py-6 bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 text-xl font-black rounded-[28px] flex items-center justify-center gap-3 transition-all tap-effect hover:scale-[1.02]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {t.chatBtn.toUpperCase()}
                        </button>
                    </motion.section>

                    {/* ✅ Signature Status Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        onClick={() => router.push('/admin/tbm/status')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-green-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-green-500/10" />

                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-green-500 mb-2 group-hover:scale-110 transition-transform shadow-lg">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white text-gradient uppercase italic">{t.statusTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {t.statusDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-green-400 font-black tracking-widest text-sm uppercase">
                                <span>View Status</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 📚 Glossary Management Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        onClick={() => router.push('/admin/glossary')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-amber-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full -ml-48 -mt-48 transition-all group-hover:bg-amber-500/10" />

                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-amber-500 mb-2 group-hover:scale-110 transition-transform shadow-lg">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white text-gradient uppercase italic">{t.glossaryTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {t.glossaryDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-amber-400 font-black tracking-widest text-sm uppercase">
                                <span>Manage Terms</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 📱 QR Center Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        onClick={() => router.push('/admin/qrcode')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-purple-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full -ml-48 -mt-48 transition-all group-hover:bg-purple-500/10" />

                        <div className="flex flex-col gap-4 relative md:h-full text-left">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-purple-400 mb-2 group-hover:rotate-12 transition-transform shadow-lg">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white text-gradient uppercase italic">Distribution Center</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                Generate QR codes to quickly onboard workers and officers.
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-purple-400 font-black tracking-widest text-sm uppercase">
                                <span>Generate QRs</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>
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

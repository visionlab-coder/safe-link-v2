"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import SiteAgentBriefing from "@/components/agents/SiteAgentBriefing";
import SystemHealthCheck from "@/components/SystemHealthCheck";
import ResponsiveFeatureHero from "@/components/ResponsiveFeatureHero";
import { logoutV3 } from "@/lib/v3-auth";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";

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
    vi: {
        board: "Bảng điều khiển thời gian thực",
        boardDesc: "Theo dõi tình trạng TBM và liên lạc của công nhân.",
        tbmTitle: "Phát sóng TBM",
        tbmDesc: "Viết hướng dẫn an toàn và gửi cho công nhân bằng tiếng mẹ đẻ.",
        tbmBtn: "Phát sóng mới",
        chatTitle: "Trò chuyện AI 1:1",
        chatDesc: "Tự động dịch thời gian thực khi giao tiếp với công nhân.",
        chatBtn: "Mở kênh",
        statusTitle: "Tình trạng ký tên",
        statusDesc: "Kiểm tra việc xác nhận TBM và ký tên pháp lý của công nhân.",
        glossaryTitle: "Quản lý từ điển",
        glossaryDesc: "Quản lý tiếng lóng tại hiện trường và chuyển đổi thuật ngữ.",
        signOut: "Đăng xuất",
        roleLabel: { HQ_ADMIN: "Giám đốc hiện trường", SAFETY_OFFICER: "Cán bộ an toàn", WORKER: "Công nhân" },
        greeting: (name: string) => `Chào mừng, ${name}`,
    },
    th: {
        board: "กระดานควบคุมเรียลไทม์",
        boardDesc: "ตรวจสอบสถานะ TBM และการสื่อสารของคนงาน",
        tbmTitle: "กระจายข่าว TBM",
        tbmDesc: "เขียนคำแนะนำความปลอดภัยและส่งให้คนงานในภาษาแม่",
        tbmBtn: "กระจายข่าวใหม่",
        chatTitle: "แชท AI 1:1",
        chatDesc: "แปลอัตโนมัติแบบเรียลไทม์เพื่อสื่อสารกับคนงาน",
        chatBtn: "เปิดช่องแชท",
        statusTitle: "สถานะการลงนาม",
        statusDesc: "ตรวจสอบการยืนยัน TBM และการลงนามทางกฎหมาย",
        glossaryTitle: "จัดการพจนานุกรม",
        glossaryDesc: "จัดการคำแสลงในไซต์งานและการแปลงคำศัพท์",
        signOut: "ออกจากระบบ",
        roleLabel: { HQ_ADMIN: "ผู้จัดการไซต์", SAFETY_OFFICER: "เจ้าหน้าที่ความปลอดภัย", WORKER: "คนงาน" },
        greeting: (name: string) => `ยินดีต้อนรับ, ${name}`,
    },
    uz: {
        board: "Real vaqt rejimidagi boshqaruv paneli",
        boardDesc: "TBM holatini va ishchilar bilan muloqotni kuzatib boring.",
        tbmTitle: "TBM translyatsiyasi",
        tbmDesc: "Xavfsizlik yo'riqnomalarini yozing va ishchilarga ona tilida yuboring.",
        tbmBtn: "Yangi translyatsiya",
        chatTitle: "1:1 AI chat",
        chatDesc: "Ishchilar bilan muloqotda real vaqtda avtomatik tarjima.",
        chatBtn: "Kanalni ochish",
        statusTitle: "Imzo holati",
        statusDesc: "Ishchilarning TBM tasdiqlashi va imzosini tekshiring.",
        glossaryTitle: "Lug'at boshqaruvi",
        glossaryDesc: "Sayt terminlari va standart so'zlarni boshqarish.",
        signOut: "Chiqish",
        roleLabel: { HQ_ADMIN: "Sayt menejeri", SAFETY_OFFICER: "Xavfsizlik xodimi", WORKER: "Ishchi" },
        greeting: (name: string) => `Xush kelibsiz, ${name}`,
    },
};
const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

function AdminDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentUser, setCurrentUser] = useState<{
        id: string;
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
        let cancelled = false;
        const load = async () => {
            // /api/auth/me — 미들웨어와 동일한 raw 쿠키 파싱 사용 (Workers 안정)
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
                if (!res.ok) return;
                const data = (await res.json()) as {
                    user?: { id: string; email: string | null };
                    profile?: {
                        role?: string;
                        preferred_lang?: string | null;
                        display_name?: string | null;
                        title?: string | null;
                        site_code?: string | null;
                    } | null;
                };
                if (cancelled || !data.user || !data.profile) return;

                let finalLang = data.profile.preferred_lang || "ko";

                // 🚨 URL lang ≠ DB lang 이면 DB 업데이트.
                if (urlLang && urlLang !== data.profile.preferred_lang) {
                    finalLang = urlLang;
                }

                if (cancelled) return;
                setCurrentUser({
                    id: data.user.id,
                    name: data.profile.display_name || "Manager",
                    email: data.user.email || "",
                    role: data.profile.role || "SAFETY_OFFICER",
                    prefLang: finalLang,
                    title: data.profile.title ?? undefined,
                    site_code: data.profile.site_code ?? undefined,
                });
            } catch { /* RoleGuard 가 별도로 처리 */ }
        };
        load();
        return () => { cancelled = true; };
    }, [urlLang]);

    const newChatCount = useUnreadChatCount(currentUser?.id);

    const handleSignOut = async () => {
        try {
            await logoutV3();
            window.location.replace("/auth");
        } catch {
            window.alert("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        }
    };

    const lang = currentUser?.prefLang || urlLang || "ko";
    const t = getUI(lang);
    const roleDisplay = currentUser ? ((t.roleLabel as any)[currentUser.role] || currentUser.role) : "Admin";
    const siteId = searchParams.get("site_id");
    const siteName = siteId === "1" ? "SITE ALPHA" : siteId === "2" ? "SITE BETA" : siteId === "3" ? "SITE GAMMA" : null;

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-[#eef3f8] text-white flex flex-col pb-12 font-sans selection:bg-blue-500/30">

                <header className="w-full border-y border-slate-200 bg-white shadow-sm">
                    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-8">
                        <Image
                            src="/brand/seowon-logo-compact-transparent.png"
                            alt="SEOWON Since 1991"
                            width={208}
                            height={60}
                            priority
                            unoptimized
                            className="h-auto w-[112px] shrink-0 object-contain sm:w-[132px]"
                        />

                        <div className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" />

                        <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:flex-1 sm:basis-auto">
                            <p className="min-w-0 truncate text-xs font-bold text-slate-600 sm:text-sm">
                                {currentUser ? t.greeting(currentUser.name) : "Authenticating..."}
                                {currentUser?.title && <span className="ml-1 text-slate-400">[{currentUser.title}]</span>}
                            </p>
                            <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[8px] font-black tracking-widest text-blue-600">FIELD UNIT</span>
                            </div>
                            {siteName && (
                                <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                                    <MapPin className="h-2.5 w-2.5 text-amber-600" />
                                    <span className="text-[8px] font-black tracking-widest text-amber-600">{siteName}</span>
                                </div>
                            )}
                        </div>

                        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                            <div className={`hidden whitespace-nowrap rounded-full px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest sm:block ${currentUser?.role === 'HQ_ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {roleDisplay}
                            </div>
                            {(currentUser?.role === 'ROOT' || currentUser?.role === 'HQ_OFFICER') && (
                                <button onClick={() => router.push('/system')} className="whitespace-nowrap rounded-lg bg-indigo-50 px-2.5 py-2 text-[9px] font-black text-indigo-600 transition-colors hover:bg-indigo-100">
                                    시스템
                                </button>
                            )}
                            {currentUser?.role === 'HQ_ADMIN' && (
                                <button onClick={() => router.push('/control')} className="whitespace-nowrap rounded-lg bg-blue-50 px-2.5 py-2 text-[9px] font-black text-blue-600 transition-colors hover:bg-blue-100">
                                    통합 관제
                                </button>
                            )}
                            <button onClick={() => router.push('/auth/setup')} className="whitespace-nowrap rounded-lg px-2 py-2 text-[9px] font-black text-blue-600 transition-colors hover:bg-blue-50">
                                프로필
                            </button>
                            <button onClick={handleSignOut} className="whitespace-nowrap rounded-lg px-2 py-2 text-[9px] font-black text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500">
                                {t.signOut}
                            </button>
                            <span className="ml-1 shrink-0 text-base font-black tracking-tight text-[#063789] sm:ml-2 sm:text-xl">SQ-LINK</span>
                        </div>
                    </div>
                </header>

                <div className="w-full">
                    <ResponsiveFeatureHero visual={{
                        image: "dashboard",
                        eyebrow: "CONTROL CENTER",
                        title: "관리자 통합 현황",
                        description: "위험과 미처리 업무를 한 화면에서 확인합니다.",
                        metrics: [{ label: "출입 인원", value: "286명" }, { label: "TBM 완료", value: "94%" }, { label: "조치 필요", value: "7건" }],
                        steps: [{ title: "인원 현황", description: "출입·교육 상태를 집계합니다." }, { title: "위험 확인", description: "미조치 항목을 우선 표시합니다." }, { title: "보고 준비", description: "오늘 문서를 자동으로 정리합니다." }],
                    }} />
                </div>

                {/* 🚨 Pre-flight Health Check (Critical for Monday Demo) */}
                <div className="mx-4 mt-8 sm:mx-8">
                    <SystemHealthCheck />
                </div>

                {/* 🤖 Tier 2: Site Agent Briefing (Role-specific) */}
                {currentUser && (
                    <div className="mx-4 mt-8 sm:mx-8">
                        <SiteAgentBriefing
                            role={currentUser.role}
                            siteId={siteId}
                            lang={currentUser.prefLang}
                        />
                    </div>
                )}

                <div className="admin-light-cards mx-4 mt-8 grid grid-cols-1 gap-6 sm:mx-8 md:grid-cols-2">
                    {/* 📡 TBM Broadcast Card */}
                    <motion.section
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="glass rounded-[48px] p-10 border-white/10 shadow-3xl relative overflow-hidden flex flex-col gap-10 group"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none group-hover:bg-blue-600/20 transition-all duration-1000" />

                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mb-2 border border-blue-100 bg-blue-50 shadow-[0_10px_24px_rgba(37,99,235,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.tbmTitle}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.tbmDesc}</p>
                        </div>

                        <button
                            onClick={() => router.push('/admin/tbm/create')}
                            className="mt-auto w-full py-6 bg-gradient-to-br from-blue-400 to-blue-600 text-slate-950 text-xl font-black rounded-xl shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] transition-all tap-effect hover:scale-[1.02]"
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
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mb-2 border border-blue-100 bg-blue-50 shadow-[0_10px_24px_rgba(37,99,235,.12)] relative">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {newChatCount > 0 && (
                                    <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 bg-red-500 rounded-full border-[3px] border-white text-white text-[10px] font-black flex items-center justify-center shadow-md">
                                        {newChatCount}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.chatTitle}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.chatDesc}</p>
                        </div>

                        <button
                            onClick={() => router.push('/admin/chat')}
                            className="mt-auto w-full py-6 bg-gradient-to-br from-blue-400 to-blue-600 text-slate-950 text-xl font-black rounded-xl flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] transition-all tap-effect hover:scale-[1.02]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h8m-8 4h5m8-2a9 9 0 01-9 9 9.8 9.8 0 01-4.26-.96L3 21l1.4-3.73A8.96 8.96 0 013 12a9 9 0 1118 0z" />
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
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-green-600 mb-2 border border-green-100 bg-green-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(22,163,74,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{t.statusTitle}</h3>
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
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-amber-600 mb-2 border border-amber-100 bg-amber-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(217,119,6,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{t.glossaryTitle}</h3>
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

                    {/* 🔧 AI 엔진·키 설정 Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.42 }}
                        onClick={() => router.push('/lab')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-emerald-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100 bg-emerald-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(5,150,105,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">AI 엔진 · 키 설정</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                통번역 엔진(Google·Papago)과 API 키를 재배포 없이 즉시 교체·테스트합니다.
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-emerald-400 font-black tracking-widest text-sm uppercase">
                                <span>Engine Switch</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 🎙️ Live Interpreter Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                        onClick={() => router.push('/admin/live')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-indigo-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mb-2 border border-indigo-100 bg-indigo-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(79,70,229,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">Live Interpreter</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "실시간 동시통역. 말하면 근로자 폰에서 자동 번역 재생." : lang === "zh" ? "实时同声传译。发言后自动翻译播放。" : "Real-time interpretation. Speak and workers hear it translated."}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-indigo-400 font-black tracking-widest text-sm uppercase">
                                <span>Start Broadcast</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 🧠 Safety Quiz Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.35 }}
                        onClick={() => router.push('/admin/quiz')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-pink-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-pink-500/5 blur-[120px] rounded-full -ml-48 -mt-48 transition-all group-hover:bg-pink-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-pink-600 mb-2 border border-pink-100 bg-pink-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(219,39,119,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">Safety Quiz</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "실시간 안전 퀴즈. 근로자 이해도를 즉시 확인." : lang === "zh" ? "实时安全测验。即时确认工人理解度。" : "Live safety quiz. Check worker comprehension instantly."}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-pink-400 font-black tracking-widest text-sm uppercase">
                                <span>Create Quiz</span>
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
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-purple-600 mb-2 border border-purple-100 bg-purple-50 group-hover:rotate-12 transition-transform shadow-[0_10px_24px_rgba(147,51,234,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">Access Center</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                Issue SQ Link access cards and fallback codes.
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-purple-400 font-black tracking-widest text-sm uppercase">
                                <span>Open Access Center</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 🎁 Safety Incentive Card (청구항 12) */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.45 }}
                        onClick={() => router.push('/admin/incentive')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-orange-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-orange-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-orange-600 mb-2 border border-orange-100 bg-orange-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(234,88,12,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">
                                {lang === "ko" ? "안전 인센티브" : lang === "zh" ? "安全激励" : "Safety Incentive"}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "퀴즈 우수자에게 안전장비를 지급하고 성과를 기록합니다." : lang === "zh" ? "向测验优秀者发放安全装备并记录成果。" : "Grant safety equipment to top quiz performers and track results."}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-orange-400 font-black tracking-widest text-sm uppercase">
                                <span>Manage Grants</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 📡 NFC 근로자 관리 Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.425 }}
                        onClick={() => router.push('/admin/nfc')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-cyan-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-cyan-600 mb-2 border border-cyan-100 bg-cyan-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(8,145,178,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">
                                {lang === "ko" ? "NFC 근로자 관리" : lang === "zh" ? "NFC工人管理" : "NFC Worker Mgmt"}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "NFC 스티커 등록·발급 및 TBM 참석 현황을 관리합니다." : lang === "zh" ? "管理NFC贴纸注册·发放及TBM出勤情况。" : "Register NFC stickers and manage TBM attendance records."}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-cyan-400 font-black tracking-widest text-sm uppercase">
                                <span>Manage NFC</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 📖 Guide Card */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.55 }}
                        onClick={() => router.push('/admin/guide')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-blue-400/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-blue-400/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mb-2 border border-blue-100 bg-blue-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(37,99,235,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">
                                {lang === "ko" ? "기능 사용 가이드" : lang === "zh" ? "功能使用指南" : "Feature Guide"}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "NFC 근로자 관리·인센티브·ESG 리포트 단계별 안내. 처음 담당하는 직원도 바로 시작 가능." : lang === "zh" ? "NFC工人管理·激励·ESG报告分步指南。新担当人员也可立即开始。" : "Step-by-step guide for NFC, incentives, and ESG report."}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-blue-300 font-black tracking-widest text-sm uppercase">
                                <span>Open Guide</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>

                    {/* 📊 ESG Report Card (청구항 24) */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        onClick={() => router.push('/admin/esg')}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer tap-effect group shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full -ml-48 -mt-48 transition-all group-hover:bg-emerald-500/10" />
                        <div className="flex flex-col gap-4 relative md:h-full">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100 bg-emerald-50 group-hover:scale-110 transition-transform shadow-[0_10px_24px_rgba(5,150,105,.12)]">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">
                                {lang === "ko" ? "ESG 안전 리포트" : lang === "zh" ? "ESG安全报告" : "ESG Safety Report"}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {lang === "ko" ? "TBM 인증율·서약·감사체인 기반 ESG 종합 점수를 산출합니다." : lang === "zh" ? "基于TBM认证率、承诺书和审计链计算ESG综合评分。" : "Compute ESG score from TBM certification, pledges, and audit chain."}
                            </p>
                            <div className="flex items-center gap-2 mt-4">
                                <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-black">청구항 24</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-emerald-400 font-black tracking-widest text-sm uppercase">
                                <span>View Report</span>
                                <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </div>
                    </motion.section>
                </div>

            </div>
        </RoleGuard>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f6fa] px-6 text-blue-700">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-xl border border-blue-100 bg-white shadow-[0_16px_40px_rgba(37,99,235,.12)]">
                    <div className="h-10 w-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                </div>
                <p className="font-black tracking-tight text-[#172033]">관리자 화면을 준비하고 있습니다...</p>
                <p className="mt-2 text-xs font-bold tracking-widest text-slate-500">SAFE-LINK FIELD CONSOLE</p>
            </div>
        }>
            <AdminDashboardContent />
        </Suspense>
    );
}

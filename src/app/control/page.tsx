"use client";
import { useEffect, useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import HQCommandSwarm from "@/components/agents/HQCommandSwarm";
import SwarmVisualizer from "@/components/agents/SwarmVisualizer";
import { logoutV3 } from "@/lib/v3-auth";
import Image from "next/image";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { persistDisplayLanguage } from "@/hooks/useDisplayLanguage";

const controlText = {
    ko: { hq: "본사 통합 관제", welcome: (name: string) => `반갑습니다, ${name}님`, loading: "사용자 정보를 확인하고 있습니다…", admin: "본사 관리자", signOut: "로그아웃", profile: "내 정보", adminOverview: "관리자 통합 현황", systemManagement: "시스템 관리", accountMenu: "계정 메뉴", dashboard: "통합 현황", description: "전체 현장 상태를 확인하고 증빙 로그를 내려받습니다.", monitor: "실시간 군집 모니터", monitorDescription: "활성 군집 에이전트 상태", nodes: "활성 노드", pipeline: "데이터 처리", translation: "번역 부하", threat: "위험 이벤트", high: "높음", statistics: "현장 통계", statisticsDescription: "전체 TBM 완료율과 사용 중인 언어 현황을 확인합니다.", export: "로그 내보내기", exportDescription: "감사 및 증빙을 위해 중요 통신·TBM 로그를 내려받습니다.", console: "본사 관제" },
    zh: { hq: "总部综合监控", welcome: (name: string) => `欢迎，${name}`, loading: "正在确认用户信息…", admin: "总部管理员", signOut: "退出登录", profile: "我的资料", adminOverview: "管理员综合概览", systemManagement: "系统管理", accountMenu: "账户菜单", dashboard: "综合概览", description: "查看所有现场状态并下载证据日志。", monitor: "实时集群监控", monitorDescription: "活动集群代理状态", nodes: "活动节点", pipeline: "数据处理", translation: "翻译负载", threat: "风险事件", high: "高", statistics: "现场统计", statisticsDescription: "查看整体 TBM 完成率和正在使用的语言。", export: "导出日志", exportDescription: "下载重要通信和 TBM 日志，用于审计与证据。", console: "总部控制台" },
    vi: { hq: "Điều hành tổng hợp trụ sở", welcome: (name: string) => `Chào mừng, ${name}`, loading: "Đang xác minh người dùng…", admin: "Quản trị trụ sở", signOut: "Đăng xuất", profile: "Hồ sơ của tôi", adminOverview: "Tổng quan quản trị", systemManagement: "Quản lý hệ thống", accountMenu: "Menu tài khoản", dashboard: "Bảng điều khiển tổng hợp", description: "Theo dõi trạng thái toàn bộ công trường và tải nhật ký chứng cứ.", monitor: "Theo dõi cụm trực tiếp", monitorDescription: "Trạng thái tác nhân cụm đang hoạt động", nodes: "Nút đang hoạt động", pipeline: "Xử lý dữ liệu", translation: "Tải dịch thuật", threat: "Sự kiện rủi ro", high: "Cao", statistics: "Thống kê công trường", statisticsDescription: "Xem tỷ lệ hoàn thành TBM và ngôn ngữ đang sử dụng.", export: "Xuất nhật ký", exportDescription: "Tải nhật ký liên lạc và TBM quan trọng cho kiểm toán và chứng cứ.", console: "Bảng điều khiển trụ sở" },
    ru: { hq: "Интегрированный контроль штаба", welcome: (name: string) => `Добро пожаловать, ${name}`, loading: "Проверяем пользователя…", admin: "Администратор штаба", signOut: "Выйти", profile: "Мой профиль", adminOverview: "Обзор администратора", systemManagement: "Управление системой", accountMenu: "Меню аккаунта", dashboard: "Интегрированная панель", description: "Контролируйте состояние всех площадок и загружайте журналы доказательств.", monitor: "Мониторинг кластера", monitorDescription: "Состояние активных кластерных агентов", nodes: "Активные узлы", pipeline: "Обработка данных", translation: "Нагрузка перевода", threat: "Рискованные события", high: "Высокая", statistics: "Статистика площадок", statisticsDescription: "Просматривайте показатели завершения TBM и используемые языки.", export: "Экспорт журналов", exportDescription: "Скачивайте важные журналы связи и TBM для аудита и подтверждений.", console: "Консоль штаба" },
    en: { hq: "HQ Control", welcome: (name: string) => `Welcome, ${name}`, loading: "Authenticating…", admin: "HQ Admin", signOut: "Sign out", profile: "My profile", adminOverview: "Admin overview", systemManagement: "System management", accountMenu: "Account menu", dashboard: "Integrated Dashboard", description: "Monitor overall site status and download evidence logs.", monitor: "Live Swarm Monitor", monitorDescription: "Active Cluster Agent Status", nodes: "Active Nodes", pipeline: "Data Pipeline", translation: "Translation Load", threat: "Threat Events", high: "High", statistics: "Site Statistics", statisticsDescription: "View overall TBM completion rates and active language usage.", export: "Export Logs", exportDescription: "Download critical communication and TBM logs for audit and evidence.", console: "HQ Console" },
} as const;

const CONTROL_LANGUAGE_OPTIONS = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "ru", label: "Русский" },
] as const;

function getControlText(lang: string) {
    return controlText[lang as keyof typeof controlText] || controlText.en;
}

function ControlDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; roles: string[]; prefLang: string } | null>(null);
    const [selectedLang, setSelectedLang] = useState("ko");
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

    useEffect(() => {
        setSelectedLang(localStorage.getItem("safe-link-lang") || searchParams.get("lang") || "ko");
    }, [searchParams]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (res.ok) {
                const data = (await res.json()) as {
                    user?: { email: string | null };
                    profile?: { role?: string; preferred_lang?: string | null; display_name?: string | null } | null;
                    v3?: { roles?: string[] };
                };
                setCurrentUser({
                    name: data.profile?.display_name || "Manager",
                    email: data.user?.email || "",
                    role: data.profile?.role || "HQ_ADMIN",
                    roles: Array.isArray(data.v3?.roles) ? data.v3.roles.map((role) => role.toUpperCase()) : [String(data.profile?.role || "")],
                    prefLang: data.profile?.preferred_lang || "ko",
                });
            }
        };
        load();
    }, []);

    const handleSignOut = async () => {
        await logoutV3().catch(() => undefined);
        router.push("/auth");
    };

    const handleLanguageChange = (nextLang: string) => {
        persistDisplayLanguage(nextLang);
        setSelectedLang(nextLang);
        const params = new URLSearchParams(searchParams.toString());
        params.set("lang", nextLang);
        router.replace(`/control?${params.toString()}`);
    };

    const activeLang = selectedLang || searchParams.get("lang") || currentUser?.prefLang || "ko";
    const t = getControlText(activeLang);
    const isRootAdmin = currentUser?.roles.includes("ROOT") === true;

    return (
        <RoleGuard allowedRole="hq">
            <div className="console-light min-h-screen bg-slate-950 text-white flex flex-col pb-12 font-sans selection:bg-indigo-500/30">

                {/* 💎 Premium Header */}
                <header className="concept-page-header animate-float">
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2 mb-1">
                            <h1 className="shrink-0 whitespace-nowrap text-lg font-black tracking-tight text-[#063789] uppercase sm:text-xl">SQ LINK</h1>
                            <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] text-indigo-400 font-black tracking-widest leading-none">{t.hq}</span>
                            </div>
                        </div>
                        <p className="text-slate-500 font-bold text-xs leading-tight uppercase tracking-tight">
                            {currentUser ? t.welcome(currentUser.name) : t.loading}
                        </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                        <label className="sr-only" htmlFor="control-language">표시 언어</label>
                        <select
                            id="control-language"
                            aria-label="표시 언어"
                            value={activeLang}
                            onChange={(event) => handleLanguageChange(event.target.value)}
                            className="language-dropdown language-dropdown-light"
                        >
                            {CONTROL_LANGUAGE_OPTIONS.map((option) => (
                                <option key={option.code} value={option.code}>{option.label}</option>
                            ))}
                        </select>
                        <div className="relative">
                            <button type="button" aria-label={t.accountMenu} aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen((open) => !open)} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                                <UserRound className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{currentUser?.name || t.profile}</span>
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isAccountMenuOpen && (
                                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_16px_40px_rgba(16,42,67,.16)]">
                                    <button onClick={() => router.push("/auth/setup")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-blue-50 hover:text-blue-700"><UserRound className="h-4 w-4" />{t.profile}</button>
                                    {isRootAdmin && <button onClick={() => router.push("/admin")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-blue-50 hover:text-blue-700"><Settings className="h-4 w-4" />{t.adminOverview}</button>}
                                    {isRootAdmin && <button onClick={() => router.push("/system")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-indigo-50 hover:text-indigo-700"><Settings className="h-4 w-4" />{t.systemManagement}</button>}
                                    <div className="my-1 border-t border-slate-100" />
                                    <button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-red-600 transition-colors hover:bg-red-50"><LogOut className="h-4 w-4" />{t.signOut}</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="admin-concept-hero relative flex min-h-[280px] w-full items-end overflow-hidden px-5 pb-8 sm:px-8 md:min-h-[340px] md:px-12 md:pb-10">
                    <Image src="/images/mobile-v3/website/dashboard.webp" alt={t.dashboard} fill className="object-cover" priority />
                    <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                    <div className="relative z-10 max-w-2xl">
                        <p className="text-[10px] font-black tracking-[.2em] text-indigo-200">{t.hq}</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{t.dashboard}</h2>
                        <p className="mt-2 text-sm font-bold text-slate-100">{t.description}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-8 p-4 md:p-8">

                {/* 🤖 Tier 1: HQ Command Swarm Intelligence */}
                <HQCommandSwarm lang={activeLang} />

                {/* 🌌 Swarm Live Feed (Proof of Scale) */}
                <SwarmVisualizer lang={activeLang} />

                {/* 🌐 Live Swarm Monitor (Cluster Agent Status) */}
                <section className="glass rounded-[48px] p-6 border-white/10 shadow-3xl bg-slate-900/60 flex flex-col gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-1000" />
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 relative">
                        <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-emerald-400">
                            <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight italic">{t.monitor}</h3>
                            <p className="text-emerald-400/80 font-bold text-sm tracking-widest">{t.monitorDescription}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
                        {[
                            { label: t.nodes, val: "2,504", color: "text-emerald-400" },
                            { label: t.pipeline, val: "99.9%", color: "text-blue-400" },
                            { label: t.translation, val: t.high, color: "text-amber-400" },
                            { label: t.threat, val: "0", color: "text-slate-400" },
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-950/50 p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                <span className={`text-3xl font-black ${stat.color} drop-shadow-lg`}>{stat.val}</span>
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Placeholder Cards */}
                    <section className="glass rounded-[48px] p-10 border-white/5 shadow-3xl relative overflow-hidden flex flex-col gap-10 group bg-slate-900/40">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-1000" />
                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-indigo-400 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.statistics}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.statisticsDescription}</p>
                        </div>
                    </section>

                    <section className="glass rounded-[48px] p-10 border-white/5 shadow-3xl relative overflow-hidden flex flex-col gap-10 group bg-slate-900/40">
                        <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full -ml-24 -mt-24 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-1000" />
                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-purple-400 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">{t.export}</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">{t.exportDescription}</p>
                        </div>
                    </section>
                </div>

                </div>
            </div>
        </RoleGuard>
    );
}

export default function ControlDashboard() {
    return (
        <Suspense fallback={<div className="console-light min-h-screen bg-slate-950" />}>
            <ControlDashboardContent />
        </Suspense>
    );
}

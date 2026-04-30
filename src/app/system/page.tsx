"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import SystemHealthCheck from "@/components/SystemHealthCheck";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    Settings,
    MapPin,
    Bell,
    Zap,
    Cpu,
    Activity,
    Plus,
    ArrowRight,
    Edit3,
    Trash2,
    X,
    HardHat,
    AlertTriangle,
    Users,
    ClipboardCheck,
} from "lucide-react";

type Site = {
    id: string;
    name: string;
    address: string;
    created_at: string;
    worker_count: number;
    tbm_today: number;
    alert_count: number;
};

const systemUI: Record<string, any> = {
    ko: {
        title: "통합 시스템",
        rootAccess: "최상위 접근 권한",
        orchestration: "전역 통합 관제",
        intelligence: "시스템 지능 제어",
        openNewSite: "신규 현장 개설",
        stats: {
            sites: "활성 현장",
            workers: "총 근로자",
            tbms: "오늘 TBM",
            alerts: "작업중지 알람",
        },
        sidebar: {
            sites: "전체 현장 관리",
            data: "시스템 상태 점검",
            ai: "AI 에이전트 설정",
            logs: "시스템 보안 로그",
            configs: "전역 환경 설정",
        },
        site: {
            id: "현장 ID",
            tbmToday: "오늘 TBM",
            alertCount: "작업중지",
            workerCount: "근로자",
            status: "상태",
            operational: "정상 가동",
            warning: "알람 발생",
            link: "현장 콘솔로 전환",
            viewAll: "모든 현장 목록",
            addTitle: "신규 현장 개설",
            editTitle: "현장 정보 수정",
            deleteTitle: "현장 삭제",
            deleteConfirm: "정말 이 현장을 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.",
            namePlaceholder: "현장명을 입력하세요",
            addrPlaceholder: "현장 주소를 입력하세요",
            save: "저장하기",
            cancel: "취소"
        },
        ai: {
            tower: "AI 에이전트 커맨드 타워",
            active: "글로벌 모니터링 활성화",
            thinking: "AI가 분석 중입니다...",
            intervention: "수동 개입",
            optimize: "신경망 경로 최적화",
            capabilities: "에이전트 보유 능력",
            response: "신속 대응 시스템",
            responseDesc: "AI 에이전트가 1.2초 내에 사고 징후를 감지하여 본사로 보고합니다.",
            caps: [
                { label: "실시간 감정 분석 (Sentiment)", active: true },
                { label: "위험 키워드 즉각 차단", active: true },
                { label: "작업 보고서 자동 요약", active: true },
                { label: "긴급 상황 사이렌 자동화", active: false },
            ]
        }
    },
    en: {
        title: "SYSTEM",
        rootAccess: "ROOT ACCESS",
        orchestration: "Global Orchestration",
        intelligence: "HQ Intelligence",
        openNewSite: "Open New Site",
        stats: {
            sites: "Active Sites",
            workers: "Total Workers",
            tbms: "Today's TBMs",
            alerts: "Stop-Work Alerts",
        },
        sidebar: {
            sites: "Site Management",
            data: "System Health",
            ai: "AI Agent Config",
            logs: "Security Logs",
            configs: "Global Config",
        },
        site: {
            id: "Site ID",
            tbmToday: "TBM Today",
            alertCount: "Stop Work",
            workerCount: "Workers",
            status: "Status",
            operational: "OPERATIONAL",
            warning: "ALERT",
            link: "Switch to Field Console",
            viewAll: "View all sites",
            addTitle: "Open New Site",
            editTitle: "Edit Site Info",
            deleteTitle: "Delete Site",
            deleteConfirm: "Are you sure you want to delete this site? All related data will be removed.",
            namePlaceholder: "Enter site name",
            addrPlaceholder: "Enter site address",
            save: "Save",
            cancel: "Cancel"
        },
        ai: {
            tower: "AI Agent Command Tower",
            active: "Global Monitoring active",
            thinking: "AI is thinking...",
            intervention: "Manual Intervention",
            optimize: "Optimize Neural Routes",
            capabilities: "Agent Capabilities",
            response: "Rapid Response",
            responseDesc: "AI agent detects accident signs within 1.2s and reports to HQ.",
            caps: [
                { label: "Realtime Sentiment Analysis", active: true },
                { label: "Risk Keyword Blocking", active: true },
                { label: "Auto Report Summary", active: true },
                { label: "Emergency Siren Automation", active: false },
            ]
        }
    }
};

export default function SystemAdminPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("sites");
    const [lang, setLang] = useState("ko");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [siteForm, setSiteForm] = useState({ name: "", address: "" });
    const t = systemUI[lang];

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
                setCurrentUser(profile);
            }
            await fetchSites();
        };
        init();
    }, []);

    const fetchSites = async () => {
        setLoading(true);
        const supabase = createClient();

        const today = new Date().toISOString().split('T')[0];
        const dayStart = `${today}T00:00:00+09:00`;
        const dayEnd = `${today}T23:59:59+09:00`;

        const [
            { data: sitesData },
            { data: workersData },
            { data: tbmData },
            { data: alertsData },
        ] = await Promise.all([
            supabase.from("sites").select("*"),
            supabase.from("profiles").select("site_id").eq("role", "WORKER"),
            supabase.from("tbm_notices").select("site_id").gte("created_at", dayStart).lte("created_at", dayEnd),
            supabase.from("stop_work_alerts").select("site_id").eq("resolved", false),
        ]);

        if (sitesData) {
            const processed: Site[] = sitesData.map(site => ({
                ...site,
                worker_count: workersData?.filter(w => w.site_id === site.id).length ?? 0,
                tbm_today: tbmData?.filter(t => t.site_id === site.id).length ?? 0,
                alert_count: alertsData?.filter(a => a.site_id === site.id).length ?? 0,
            }));
            setSites(processed);
        }
        setLoading(false);
    };

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/auth";
    };

    const handleOpenAddModal = () => {
        setEditingSite(null);
        setSiteForm({ name: "", address: "" });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (site: Site) => {
        setEditingSite(site);
        setSiteForm({ name: site.name, address: site.address });
        setIsModalOpen(true);
    };

    const handleSaveSite = async () => {
        if (!siteForm.name) return;
        const supabase = createClient();
        setLoading(true);

        if (editingSite) {
            const { error } = await supabase
                .from("sites")
                .update({ name: siteForm.name, address: siteForm.address })
                .eq("id", editingSite.id);
            if (error) alert(error.message);
        } else {
            const newCode = `ST-${Date.now().toString().slice(-6)}`;
            const { error } = await supabase
                .from("sites")
                .insert([{ name: siteForm.name, address: siteForm.address, code: newCode }]);
            if (error) alert(error.message);
        }

        setIsModalOpen(false);
        await fetchSites();
    };

    const handleDeleteSite = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(t.site.deleteConfirm)) return;

        const supabase = createClient();
        setLoading(true);
        const { error } = await supabase.from("sites").delete().eq("id", id);
        if (error) alert(error.message);
        await fetchSites();
    };

    const totalWorkers = sites.reduce((acc, s) => acc + s.worker_count, 0);
    const totalTbmToday = sites.reduce((acc, s) => acc + s.tbm_today, 0);
    const totalAlerts = sites.reduce((acc, s) => acc + s.alert_count, 0);

    return (
        <RoleGuard allowedRole="system">
            <div className="min-h-screen bg-[#030308] text-white font-sans overflow-x-hidden relative">
                {/* Animated Background Gradients */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[0%] right-[0%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                {/* Sidebar */}
                <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-950/50 backdrop-blur-xl border-r border-white/5 z-50 flex flex-col p-6">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter italic uppercase text-gradient">{t.title}</h1>
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{t.rootAccess}</p>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-2 flex-1">
                        {[
                            { id: "sites", icon: MapPin, label: t.sidebar.sites },
                            { id: "stats", icon: Activity, label: t.sidebar.data },
                            { id: "ai", icon: Cpu, label: t.sidebar.ai },
                            { id: "logs", icon: Bell, label: t.sidebar.logs },
                            { id: "configs", icon: Settings, label: t.sidebar.configs },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold ${activeTab === item.id
                                    ? "bg-white/10 text-blue-400 shadow-inner border border-white/5"
                                    : "text-slate-500 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-sm tracking-tight">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* 모드 전환 버튼 */}
                    <div className="pt-4 border-t border-white/5">
                        <button
                            onClick={() => window.location.href = "/admin"}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40"
                        >
                            <HardHat className="w-5 h-5 flex-shrink-0" />
                            <div className="flex flex-col items-start">
                                <span className="text-xs font-black tracking-tight">현장 안전관리 모드</span>
                                <span className="text-[9px] text-amber-500/60 font-bold uppercase tracking-widest">Field Safety Console</span>
                            </div>
                        </button>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-black">
                                {currentUser?.display_name?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-black truncate">{currentUser?.display_name || "Loading..."}</p>
                                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{currentUser?.role === 'ROOT' ? 'Master' : 'HQ Officer'}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="w-full py-2.5 rounded-xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all"
                        >
                            Sign Out
                        </button>

                        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Developer Mode</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-slate-300">V2.0.4 - STABLE</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="md:ml-64 p-4 md:p-12 min-h-screen">
                    <header className="flex justify-between items-end mb-12">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <h2 className="text-4xl font-bold tracking-tighter text-white mb-2 uppercase italic">
                                {activeTab === 'sites' ? t.orchestration : t.intelligence}
                            </h2>
                            <div className="flex items-center gap-2 text-slate-400 font-bold">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>{lang === 'ko' ? `${sites.length}개 현장 · ${totalWorkers}명 근로자 실시간 모니터링` : `${sites.length} sites · ${totalWorkers} workers monitored`}</span>
                            </div>
                        </motion.div>

                        <div className="flex items-center gap-4">
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                <button
                                    onClick={() => setLang('ko')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'ko' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    KO
                                </button>
                                <button
                                    onClick={() => setLang('en')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    EN
                                </button>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleOpenAddModal}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-500/20 transition-all text-sm"
                            >
                                <Plus className="w-5 h-5" />
                                {t.openNewSite}
                            </motion.button>
                        </div>
                    </header>

                    {/* Stats Bar — real data */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        {[
                            {
                                label: t.stats.sites,
                                value: loading ? "—" : sites.length.toString(),
                                icon: MapPin,
                                color: "blue",
                                sub: lang === 'ko' ? "활성 현장" : "active",
                            },
                            {
                                label: t.stats.workers,
                                value: loading ? "—" : totalWorkers.toLocaleString(),
                                icon: Users,
                                color: "emerald",
                                sub: lang === 'ko' ? "등록 근로자" : "registered",
                            },
                            {
                                label: t.stats.tbms,
                                value: loading ? "—" : totalTbmToday.toString(),
                                icon: ClipboardCheck,
                                color: "purple",
                                sub: lang === 'ko' ? "오늘 실시" : "today",
                            },
                            {
                                label: t.stats.alerts,
                                value: loading ? "—" : totalAlerts.toString(),
                                icon: AlertTriangle,
                                color: totalAlerts > 0 ? "red" : "slate",
                                sub: totalAlerts > 0 ? (lang === 'ko' ? "미해결" : "unresolved") : (lang === 'ko' ? "이상 없음" : "clear"),
                            },
                        ].map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={`bg-slate-900/40 backdrop-blur-md p-6 rounded-[32px] border flex flex-col gap-2 ${stat.color === 'red' ? 'border-red-500/30 bg-red-950/20' : 'border-white/5'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                                    <stat.icon className={`w-4 h-4 ${stat.color === 'red' ? 'text-red-400' : stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'purple' ? 'text-purple-400' : 'text-blue-400'}`} />
                                </div>
                                <span className="text-3xl font-black">{stat.value}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start ${stat.color === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-400'}`}>
                                    {stat.sub}
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === "sites" && (
                            <motion.div
                                key="site-list"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                            >
                                {loading ? (
                                    <div className="lg:col-span-2 py-24 flex items-center justify-center">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    sites.map((site) => (
                                        <motion.div
                                            key={site.id}
                                            className={`group bg-gradient-to-br from-slate-900/60 to-slate-950/60 hover:from-slate-800/60 hover:to-slate-900/60 backdrop-blur-xl p-8 rounded-[40px] border transition-all duration-500 cursor-pointer relative overflow-hidden ${site.alert_count > 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/5 hover:border-blue-500/30'}`}
                                        >
                                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[40px] rounded-full transition-colors ${site.alert_count > 0 ? 'bg-red-500/10 group-hover:bg-red-500/20' : 'bg-blue-500/5 group-hover:bg-blue-500/10'}`} />

                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
                                                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{t.site.id}: {site.id.slice(0, 8)}</span>
                                                    <h3 className={`text-xl font-black tracking-tight group-hover:text-blue-400 transition-colors uppercase leading-tight ${site.alert_count > 0 ? 'text-red-300' : ''}`}>{site.name}</h3>
                                                    <p className="text-sm text-slate-500 font-bold">{site.address}</p>
                                                </div>
                                                {site.alert_count > 0 && (
                                                    <div className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                                        <span className="text-[10px] font-black text-red-400">{site.alert_count}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(site); }}
                                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-blue-500/20 flex items-center justify-center border border-white/10 text-slate-400 hover:text-blue-400 transition-all"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSite(e, site.id)}
                                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center border border-white/10 text-slate-400 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 mt-8">
                                                <div className="bg-black/20 p-4 rounded-3xl border border-white/5 flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.site.workerCount}</span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Users className="w-3.5 h-3.5 text-blue-400" />
                                                        <span className="text-lg font-black text-blue-400">{site.worker_count}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-black/20 p-4 rounded-3xl border border-white/5 flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.site.tbmToday}</span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span className="text-lg font-black text-emerald-400">{site.tbm_today}</span>
                                                    </div>
                                                </div>
                                                <div className={`bg-black/20 p-4 rounded-3xl border flex flex-col gap-1 ${site.alert_count > 0 ? 'border-red-500/20' : 'border-white/5'}`}>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.site.alertCount}</span>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <AlertTriangle className={`w-3.5 h-3.5 ${site.alert_count > 0 ? 'text-red-400' : 'text-slate-600'}`} />
                                                        <span className={`text-lg font-black ${site.alert_count > 0 ? 'text-red-400' : 'text-slate-600'}`}>{site.alert_count}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex justify-between items-center">
                                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${site.alert_count > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${site.alert_count > 0 ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                                                    {site.alert_count > 0 ? t.site.warning : t.site.operational}
                                                </div>
                                                <button
                                                    onClick={() => window.location.href = `/admin?site_id=${site.id}`}
                                                    className="flex items-center gap-2 text-xs font-black text-slate-400 group-hover:text-blue-400 transition-all uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl"
                                                >
                                                    {t.site.link}
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </motion.div>
                        )}

                        {activeTab === "stats" && (
                            <motion.div
                                key="health-check"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <SystemHealthCheck />
                            </motion.div>
                        )}

                        {activeTab === "ai" && (
                            <motion.div
                                key="ai-tower"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                            >
                                {/* AI Brain Log */}
                                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-3xl rounded-[40px] border border-white/5 p-8 flex flex-col gap-6 shadow-3xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                                                <Cpu className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <h3 className="text-2xl font-black italic tracking-tighter uppercase">{t.ai.tower}</h3>
                                        </div>
                                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">{t.ai.active}</span>
                                        </div>
                                    </div>

                                    <div className="bg-black/40 rounded-3xl p-6 font-mono text-sm text-blue-300 h-96 overflow-y-auto flex flex-col gap-2 border border-white/5">
                                        <p className="opacity-50">[SYSTEM] Initializing Safe-Link Global Agent...</p>
                                        <p className="text-blue-400 font-bold">[AGENT] Scanning {sites.length} sites across South Korea...</p>
                                        <p className="text-white">[AGENT] Total {totalWorkers} workers verified across all sites.</p>
                                        <p className="text-emerald-400">[AGENT] Today&apos;s TBM sessions: {totalTbmToday} completed.</p>
                                        {totalAlerts > 0 ? (
                                            <p className="text-red-400 font-black">[ALERT] {totalAlerts} unresolved stop-work alert(s) detected. Escalating to HQ...</p>
                                        ) : (
                                            <p className="text-emerald-400">[STATUS] No active stop-work alerts. All systems nominal.</p>
                                        )}
                                        <p className="opacity-40 animate-pulse mt-2">_ {t.ai.thinking}</p>
                                    </div>

                                    <div className="flex gap-4">
                                        <button className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">{t.ai.intervention}</button>
                                        <button className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">{t.ai.optimize}</button>
                                    </div>
                                </div>

                                {/* AI Configuration Side */}
                                <div className="flex flex-col gap-6">
                                    <div className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5 flex flex-col gap-6">
                                        <h4 className="text-lg font-black italic uppercase tracking-tight">{t.ai.capabilities}</h4>
                                        <div className="flex flex-col gap-4">
                                            {t.ai.caps.map((cap: any) => (
                                                <div key={cap.label} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl">
                                                    <span className="text-xs font-bold text-slate-300">{cap.label}</span>
                                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${cap.active ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${cap.active ? 'right-1' : 'left-1'}`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 p-8 rounded-[40px] border border-white/10 flex flex-col gap-4">
                                        <Zap className="w-8 h-8 text-amber-400" />
                                        <h4 className="text-xl font-black italic uppercase tracking-tight">{t.ai.response}</h4>
                                        <p className="text-xs text-slate-400 font-bold leading-relaxed">{t.ai.responseDesc}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Site Add/Edit Modal */}
                    <AnimatePresence>
                        {isModalOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsModalOpen(false)}
                                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="relative w-full max-w-lg bg-[#0d0d15] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
                                >
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h3 className="text-2xl font-black italic tracking-tight">{editingSite ? t.site.editTitle : t.site.addTitle}</h3>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">SAFE-LINK FIELD MANAGEMENT</p>
                                        </div>
                                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                            <X className="w-6 h-6 text-slate-500" />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Field Name</label>
                                            <input
                                                type="text"
                                                value={siteForm.name}
                                                onChange={e => setSiteForm({ ...siteForm, name: e.target.value })}
                                                placeholder={t.site.namePlaceholder}
                                                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 focus:bg-slate-900 transition-all outline-none font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Location/Address</label>
                                            <input
                                                type="text"
                                                value={siteForm.address}
                                                onChange={e => setSiteForm({ ...siteForm, address: e.target.value })}
                                                placeholder={t.site.addrPlaceholder}
                                                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 focus:bg-slate-900 transition-all outline-none font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 mt-10">
                                        <button
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                        >
                                            {t.site.cancel}
                                        </button>
                                        <button
                                            onClick={handleSaveSite}
                                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                        >
                                            {t.site.save}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            <style jsx global>{`
        .text-gradient {
          background: linear-gradient(to bottom right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
        </RoleGuard>
    );
}

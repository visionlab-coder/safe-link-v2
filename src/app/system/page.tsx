"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import SystemHealthCheck from "@/components/SystemHealthCheck";
import { createClient } from "@/utils/supabase/client";
import { canAccessSystem, type ProfileRole } from "@/lib/roles";
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
    LayoutDashboard,
    Award,
    TrendingUp,
    FlaskConical,
    Lock,
    LogIn,
    RefreshCw,
    Save,
    Globe,
    Clock,
    CheckCircle2,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// 시뮬레이션 데이터 — 서원토건 전국 30개 현장 기준
// ──────────────────────────────────────────────────────────────
const SIM_SITES: Site[] = [
    { id: "sim-01", name: "서울 강남 테헤란로 오피스 신축", address: "서울 강남구 테헤란로", created_at: "2025-01-05", worker_count: 94, tbm_today: 3, alert_count: 0 },
    { id: "sim-02", name: "부산 해운대 레지던스 골조", address: "부산 해운대구 우동", created_at: "2025-02-10", worker_count: 68, tbm_today: 2, alert_count: 1 },
    { id: "sim-03", name: "인천 송도 물류센터 신축", address: "인천 연수구 송도동", created_at: "2025-01-20", worker_count: 52, tbm_today: 1, alert_count: 0 },
    { id: "sim-04", name: "대구 수성구 주상복합 골조", address: "대구 수성구 범어동", created_at: "2025-03-01", worker_count: 41, tbm_today: 0, alert_count: 0 },
    { id: "sim-05", name: "광주 첨단 연구단지 조성", address: "광주 북구 오룡동", created_at: "2025-02-15", worker_count: 37, tbm_today: 1, alert_count: 0 },
    { id: "sim-06", name: "대전 유성구 아파트 RC골조", address: "대전 유성구 도룡동", created_at: "2025-03-15", worker_count: 58, tbm_today: 2, alert_count: 0 },
    { id: "sim-07", name: "울산 중구 산업단지 공장", address: "울산 중구 성남동", created_at: "2025-04-01", worker_count: 29, tbm_today: 1, alert_count: 0 },
    { id: "sim-08", name: "수원 영통 오피스텔 신축", address: "경기 수원시 영통구", created_at: "2025-01-10", worker_count: 76, tbm_today: 2, alert_count: 0 },
    { id: "sim-09", name: "성남 판교 R&D센터 골조", address: "경기 성남시 분당구 판교", created_at: "2025-02-01", worker_count: 63, tbm_today: 3, alert_count: 0 },
    { id: "sim-10", name: "고양 덕양 공공주택 골조", address: "경기 고양시 덕양구", created_at: "2025-03-10", worker_count: 85, tbm_today: 2, alert_count: 1 },
    { id: "sim-11", name: "창원 마산 아파트 신축", address: "경남 창원시 마산합포구", created_at: "2025-02-20", worker_count: 44, tbm_today: 1, alert_count: 0 },
    { id: "sim-12", name: "전주 효자 공공청사 신축", address: "전북 전주시 완산구", created_at: "2025-04-05", worker_count: 31, tbm_today: 0, alert_count: 0 },
    { id: "sim-13", name: "청주 흥덕 물류허브 골조", address: "충북 청주시 흥덕구", created_at: "2025-03-20", worker_count: 48, tbm_today: 1, alert_count: 0 },
    { id: "sim-14", name: "강릉 주문진 관광호텔 신축", address: "강원 강릉시 주문진읍", created_at: "2025-04-10", worker_count: 22, tbm_today: 1, alert_count: 0 },
    { id: "sim-15", name: "포항 남구 산업단지 골조", address: "경북 포항시 남구", created_at: "2025-02-28", worker_count: 35, tbm_today: 0, alert_count: 0 },
    { id: "sim-16", name: "천안 불당 대규모 아파트", address: "충남 천안시 서북구 불당동", created_at: "2025-01-25", worker_count: 102, tbm_today: 4, alert_count: 0 },
    { id: "sim-17", name: "화성 동탄 복합쇼핑몰 RC", address: "경기 화성시 동탄면", created_at: "2025-02-05", worker_count: 88, tbm_today: 2, alert_count: 0 },
    { id: "sim-18", name: "평택 고덕 반도체 공장 기초", address: "경기 평택시 고덕면", created_at: "2025-03-05", worker_count: 71, tbm_today: 3, alert_count: 0 },
    { id: "sim-19", name: "김해 장유 아파트 골조", address: "경남 김해시 장유면", created_at: "2025-04-15", worker_count: 39, tbm_today: 0, alert_count: 0 },
    { id: "sim-20", name: "제주 서귀포 리조트 신축", address: "제주 서귀포시 중문동", created_at: "2025-03-25", worker_count: 27, tbm_today: 1, alert_count: 0 },
];

const SIM_SAFETY_OFFICER_COUNT = 34;
const SIM_HQ_ADMIN_COUNT = 11;
const SIM_ACCIDENT_FREE_DAYS = 143;

type Site = {
    id: string;
    name: string;
    address: string;
    created_at: string;
    worker_count: number;
    tbm_today: number;
    alert_count: number;
};

type LogEntry = {
    id: string;
    timestamp: string;
    event: string;
    actor: string;
    severity: 'info' | 'warn' | 'critical';
};

type GlobalConfig = {
    systemMode: 'poc' | 'production';
    alertEscalationMinutes: number;
    tbmReminderEnabled: boolean;
    defaultLanguage: 'ko' | 'en';
    emergencyContact: string;
    maintenanceMode: boolean;
};

const systemUI: Record<string, any> = {
    ko: {
        title: "통합 시스템",
        rootAccess: "최상위 접근 권한",
        orchestration: "전역 통합 관제",
        intelligence: "시스템 지능 제어",
        dashboard: "전국 현황 대시보드",
        openNewSite: "신규 현장 개설",
        stats: {
            sites: "활성 현장",
            workers: "총 근로자",
            tbms: "오늘 TBM",
            alerts: "작업중지 알람",
        },
        sidebar: {
            dashboard: "전국 현황",
            sites: "현장 관리",
            data: "시스템 상태",
            ai: "AI 에이전트",
            logs: "보안 로그",
            configs: "전역 설정",
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
        dashboard: "National Overview",
        openNewSite: "Open New Site",
        stats: {
            sites: "Active Sites",
            workers: "Total Workers",
            tbms: "Today's TBMs",
            alerts: "Stop-Work Alerts",
        },
        sidebar: {
            dashboard: "Overview",
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

// ──────────────────────────────────────────────────────────────
// 권한 검증 로딩 화면 (defense-in-depth 가드용)
// ──────────────────────────────────────────────────────────────
function LoadingScreen() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-blue-400">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="animate-pulse tracking-widest font-bold text-sm">권한 확인 중...</p>
        </div>
    );
}

export default function SystemAdminPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [lang, setLang] = useState("ko");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [siteForm, setSiteForm] = useState({ name: "", address: "" });
    const [safetyOfficerCount, setSafetyOfficerCount] = useState(0);
    const [hqAdminCount, setHqAdminCount] = useState(0);
    const [accidentFreeDays, setAccidentFreeDays] = useState<number | null>(null);
    const [isSimulation, setIsSimulation] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [securityLogs, setSecurityLogs] = useState<LogEntry[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
        systemMode: 'poc',
        alertEscalationMinutes: 30,
        tbmReminderEnabled: true,
        defaultLanguage: 'ko',
        emergencyContact: '1544-1350',
        maintenanceMode: false,
    });
    const [configSaved, setConfigSaved] = useState(false);
    const [aiCapsActive, setAiCapsActive] = useState([true, true, true, false]);
    const [aiActionStatus, setAiActionStatus] = useState<string | null>(null);
    const t = systemUI[lang];

    // defense-in-depth: 클라이언트 사이드 권한 2차 검증
    useEffect(() => {
        const verifyAccess = async () => {
            const supabase = createClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                window.location.replace("/auth");
                return;
            }
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();
            if (!profile || !canAccessSystem(profile.role as ProfileRole)) {
                window.location.replace("/");
                return;
            }
            setIsVerified(true);
        };
        verifyAccess();
    }, []);

    // 시뮬레이션 모드일 때 사용할 데이터
    const displaySites = isSimulation ? SIM_SITES : sites;
    const displaySafetyOfficerCount = isSimulation ? SIM_SAFETY_OFFICER_COUNT : safetyOfficerCount;
    const displayHqAdminCount = isSimulation ? SIM_HQ_ADMIN_COUNT : hqAdminCount;
    const displayAccidentFreeDays = isSimulation ? SIM_ACCIDENT_FREE_DAYS : accidentFreeDays;

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
            { data: allProfilesData },
            { data: tbmData },
            { data: alertsData },
            { data: lastAlertData },
        ] = await Promise.all([
            supabase.from("sites").select("*"),
            supabase.from("profiles").select("site_id, role"),
            supabase.from("tbm_notices").select("site_id").gte("created_at", dayStart).lte("created_at", dayEnd),
            supabase.from("stop_work_alerts").select("site_id").eq("resolved", false),
            supabase.from("stop_work_alerts").select("created_at").order("created_at", { ascending: false }).limit(1),
        ]);

        const workersData = allProfilesData?.filter(p => p.role === "WORKER") ?? [];
        const officerData = allProfilesData?.filter(p => p.role === "SAFETY_OFFICER") ?? [];
        const adminData = allProfilesData?.filter(p => p.role === "HQ_ADMIN" || p.role === "HQ_OFFICER") ?? [];

        setSafetyOfficerCount(officerData.length);
        setHqAdminCount(adminData.length);

        const lastAlertTs = lastAlertData?.[0]?.created_at;
        if (lastAlertTs) {
            const diffMs = Date.now() - new Date(lastAlertTs).getTime();
            setAccidentFreeDays(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        } else if (sitesData && sitesData.length > 0) {
            const earliest = sitesData.reduce((a, b) =>
                new Date(a.created_at) < new Date(b.created_at) ? a : b
            );
            const diffMs = Date.now() - new Date(earliest.created_at).getTime();
            setAccidentFreeDays(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        } else {
            setAccidentFreeDays(0);
        }

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

    const fetchSecurityLogs = async () => {
        setLogsLoading(true);
        const supabase = createClient();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [{ data: recentProfiles }, { data: recentAlerts }] = await Promise.all([
            supabase.from('profiles').select('id, display_name, role, updated_at').gte('updated_at', sevenDaysAgo).order('updated_at', { ascending: false }).limit(20),
            supabase.from('stop_work_alerts').select('id, site_id, created_at, resolved').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(10),
        ]);

        const entries: LogEntry[] = [];

        entries.push({
            id: 'session-now',
            timestamp: new Date().toISOString(),
            event: '[SYSTEM] 통합관제 접근 — 세션 시작',
            actor: currentUser?.display_name || 'SUPER_ADMIN',
            severity: 'info',
        });

        recentProfiles?.forEach(p => {
            entries.push({
                id: `profile-${p.id}`,
                timestamp: p.updated_at,
                event: `[AUTH] 권한 변경 → ${p.role}`,
                actor: p.display_name || p.id.slice(0, 8),
                severity: (p.role === 'SUPER_ADMIN' || p.role === 'ROOT') ? 'warn' : 'info',
            });
        });

        recentAlerts?.forEach(a => {
            entries.push({
                id: `alert-${a.id}`,
                timestamp: a.created_at,
                event: a.resolved ? '[SAFETY] 작업중지 해제' : '[SAFETY] 작업중지 알람 발생',
                actor: `현장 ${a.site_id?.slice(0, 8) || '?'}`,
                severity: a.resolved ? 'info' : 'critical',
            });
        });

        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSecurityLogs(entries);
        setLogsLoading(false);
    };

    const handleSaveConfig = () => {
        localStorage.setItem('safe-link-system-config', JSON.stringify(globalConfig));
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
    };

    // load saved config from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('safe-link-system-config');
        if (stored) {
            try { setGlobalConfig(JSON.parse(stored)); } catch { /* ignore */ }
        }
    }, []);

    // fetch logs on first visit to logs tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (activeTab === 'logs' && securityLogs.length === 0) {
            fetchSecurityLogs();
        }
    }, [activeTab]);

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

    const totalWorkers = displaySites.reduce((acc, s) => acc + s.worker_count, 0);
    const totalTbmToday = displaySites.reduce((acc, s) => acc + s.tbm_today, 0);
    const totalAlerts = displaySites.reduce((acc, s) => acc + s.alert_count, 0);
    const sitesWithTbm = displaySites.filter(s => s.tbm_today > 0).length;
    const tbmCoverageRate = displaySites.length > 0 ? Math.round((sitesWithTbm / displaySites.length) * 100) : 0;
    const maxWorkerCount = Math.max(...displaySites.map(s => s.worker_count), 1);
    const totalPersonnel = totalWorkers + displaySafetyOfficerCount + displayHqAdminCount;
    const daysTo1000 = displayAccidentFreeDays !== null ? Math.max(0, 1000 - displayAccidentFreeDays) : null;

    if (!isVerified) return <LoadingScreen />;

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
                            { id: "dashboard", icon: LayoutDashboard, label: t.sidebar.dashboard },
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
                                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">{currentUser?.role === 'ROOT' || currentUser?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : currentUser?.role === 'HQ_OFFICER' ? 'HQ Officer' : 'System Access'}</p>
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
                                {activeTab === 'dashboard' ? t.dashboard : activeTab === 'sites' ? t.orchestration : t.intelligence}
                            </h2>
                            <div className="flex items-center gap-2 text-slate-400 font-bold">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>{lang === 'ko' ? `${displaySites.length}개 현장 · ${totalWorkers}명 근로자 실시간 모니터링` : `${displaySites.length} sites · ${totalWorkers} workers monitored`}</span>
                            </div>
                        </motion.div>

                        <div className="flex items-center gap-4">
                            {/* 시뮬레이션 모드 토글 */}
                            <button
                                onClick={() => setIsSimulation(v => !v)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                                    isSimulation
                                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                        : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                <FlaskConical className="w-3.5 h-3.5" />
                                {isSimulation ? "시뮬레이션 ON" : "시뮬레이션"}
                            </button>

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

                            {activeTab === 'sites' && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleOpenAddModal}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-500/20 transition-all text-sm"
                                >
                                    <Plus className="w-5 h-5" />
                                    {t.openNewSite}
                                </motion.button>
                            )}
                        </div>
                    </header>

                    {/* 시뮬레이션 배너 */}
                    <AnimatePresence>
                        {isSimulation && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 overflow-hidden"
                            >
                                <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/10 border border-violet-500/30 rounded-2xl">
                                    <FlaskConical className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                    <p className="text-xs font-black text-violet-300">
                                        시뮬레이션 모드 — 서원토건 전국 20개 현장 가상 데이터 표시 중 (실제 DB 아님)
                                    </p>
                                    <button onClick={() => setIsSimulation(false)} className="ml-auto text-violet-500 hover:text-violet-300">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Stats Bar — real data */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        {[
                            {
                                label: t.stats.sites,
                                value: (loading && !isSimulation) ? "—" : displaySites.length.toString(),
                                icon: MapPin,
                                color: "blue",
                                sub: lang === 'ko' ? "활성 현장" : "active",
                            },
                            {
                                label: t.stats.workers,
                                value: (loading && !isSimulation) ? "—" : totalWorkers.toLocaleString(),
                                icon: Users,
                                color: "emerald",
                                sub: lang === 'ko' ? "등록 근로자" : "registered",
                            },
                            {
                                label: t.stats.tbms,
                                value: (loading && !isSimulation) ? "—" : totalTbmToday.toString(),
                                icon: ClipboardCheck,
                                color: "purple",
                                sub: lang === 'ko' ? "오늘 실시" : "today",
                            },
                            {
                                label: t.stats.alerts,
                                value: (loading && !isSimulation) ? "—" : totalAlerts.toString(),
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

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 대시보드 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {activeTab === "dashboard" && (
                            <motion.div
                                key="dashboard"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col gap-8"
                            >
                                {/* 무사고 영웅 섹션 */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* 무사고 연속일 */}
                                    <div className={`lg:col-span-1 rounded-[40px] border p-8 flex flex-col items-center justify-center gap-4 relative overflow-hidden ${displayAccidentFreeDays === 0 ? 'bg-red-950/30 border-red-500/30' : 'bg-gradient-to-br from-emerald-950/40 to-slate-950/60 border-emerald-500/20'}`}>
                                        <div className={`absolute inset-0 blur-[60px] rounded-full ${displayAccidentFreeDays === 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`} />
                                        <div className="relative flex flex-col items-center gap-2">
                                            <Award className={`w-8 h-8 ${displayAccidentFreeDays === 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">무사고 연속일</p>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-7xl font-black tracking-tighter ${displayAccidentFreeDays === 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {(loading && !isSimulation) ? "—" : displayAccidentFreeDays ?? "—"}
                                                </span>
                                                <span className="text-2xl font-black text-slate-500 mb-2">일</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold">
                                                {displayAccidentFreeDays === 0 ? "알람 발생 현장 있음" : "마지막 작업중지 알람 기준"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 1000일 카운트다운 + TBM 이행률 */}
                                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* 1000일 카운트다운 */}
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-indigo-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">1000일 무사고 목표</p>
                                            </div>
                                            {(loading && !isSimulation) || daysTo1000 === null ? (
                                                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                                            ) : daysTo1000 === 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-3xl font-black text-amber-400">달성!</span>
                                                    <span className="text-xs text-slate-500 font-bold">1000일 무사고 목표 달성</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-3xl font-black text-indigo-400">{daysTo1000.toLocaleString()}</span>
                                                        <span className="text-sm font-black text-slate-500 mb-1">일 남음</span>
                                                    </div>
                                                    {/* 진행 바 */}
                                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-1000"
                                                            style={{ width: `${Math.min(100, ((displayAccidentFreeDays ?? 0) / 1000) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-bold">{((displayAccidentFreeDays ?? 0) / 10).toFixed(1)}% 달성</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* TBM 이행률 */}
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <ClipboardCheck className="w-5 h-5 text-purple-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">당일 TBM 이행률</p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-end gap-2">
                                                    <span className={`text-3xl font-black ${tbmCoverageRate >= 80 ? 'text-emerald-400' : tbmCoverageRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {loading ? "—" : `${tbmCoverageRate}%`}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-500 mb-1">
                                                        ({sitesWithTbm}/{sites.length}현장)
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${tbmCoverageRate >= 80 ? 'bg-emerald-500' : tbmCoverageRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${tbmCoverageRate}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-600 font-bold">오늘 TBM 총 {totalTbmToday}건 실시</p>
                                            </div>
                                        </div>

                                        {/* 인력 현황 */}
                                        <div className="sm:col-span-2 bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-5 h-5 text-blue-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">전국 인력 구성</p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                {/* 스택 바 */}
                                                <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
                                                    {totalPersonnel > 0 ? (
                                                        <>
                                                            <div
                                                                className="h-full bg-blue-500 transition-all duration-1000"
                                                                style={{ width: `${(totalWorkers / totalPersonnel) * 100}%` }}
                                                                title={`근로자 ${totalWorkers}명`}
                                                            />
                                                            <div
                                                                className="h-full bg-amber-500 transition-all duration-1000"
                                                                style={{ width: `${(displaySafetyOfficerCount / totalPersonnel) * 100}%` }}
                                                                title={`안전관리자 ${displaySafetyOfficerCount}명`}
                                                            />
                                                            <div
                                                                className="h-full bg-purple-500 transition-all duration-1000"
                                                                style={{ width: `${(displayHqAdminCount / totalPersonnel) * 100}%` }}
                                                                title={`본사 관리자 ${displayHqAdminCount}명`}
                                                            />
                                                        </>
                                                    ) : (
                                                        <div className="h-full w-full bg-slate-700 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                        <span className="text-xs font-bold text-slate-400">근로자 <span className="text-white">{totalWorkers}</span>명</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                        <span className="text-xs font-bold text-slate-400">안전관리자 <span className="text-white">{displaySafetyOfficerCount}</span>명</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                                        <span className="text-xs font-bold text-slate-400">본사 관리자 <span className="text-white">{displayHqAdminCount}</span>명</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 전국 현장 현황 바 차트 */}
                                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-8 flex flex-col gap-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-blue-400" />
                                            <h3 className="text-lg font-black uppercase tracking-tight">전국 현장 근로자 현황</h3>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">전체 {displaySites.length}개 현장</span>
                                    </div>

                                    {(loading && !isSimulation) ? (
                                        <div className="flex flex-col gap-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : displaySites.length === 0 ? (
                                        <p className="text-slate-600 font-bold text-sm text-center py-8">등록된 현장이 없습니다</p>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {[...displaySites]
                                                .sort((a, b) => b.worker_count - a.worker_count)
                                                .map((site) => (
                                                    <div key={site.id} className="flex items-center gap-4 group">
                                                        <div className="w-32 flex-shrink-0">
                                                            <p className="text-xs font-black text-slate-300 truncate leading-tight">{site.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-600 truncate">{site.address}</p>
                                                        </div>
                                                        <div className="flex-1 relative h-8 bg-slate-800/60 rounded-2xl overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-2xl transition-all duration-700 flex items-center px-3 ${site.alert_count > 0 ? 'bg-red-500/40' : 'bg-blue-500/30'}`}
                                                                style={{ width: `${Math.max(4, (site.worker_count / maxWorkerCount) * 100)}%` }}
                                                            />
                                                            <div className="absolute inset-0 flex items-center px-3 gap-4">
                                                                <span className="text-xs font-black text-white">{site.worker_count}명</span>
                                                                {site.tbm_today > 0 && (
                                                                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">TBM {site.tbm_today}</span>
                                                                )}
                                                                {site.alert_count > 0 && (
                                                                    <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                                        <AlertTriangle className="w-2.5 h-2.5" />
                                                                        {site.alert_count}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => window.location.href = `/admin?site_id=${site.id}`}
                                                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1"
                                                        >
                                                            입장 <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* 알람 발생 현장 (있을 때만) */}
                                {totalAlerts > 0 && !loading && (
                                    <div className="bg-red-950/20 border border-red-500/20 rounded-[40px] p-8 flex flex-col gap-6">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                                            <h3 className="text-lg font-black uppercase tracking-tight text-red-300">작업중지 알람 현장</h3>
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-black rounded-full">{totalAlerts}건 미해결</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {displaySites.filter(s => s.alert_count > 0).map(site => (
                                                <button
                                                    key={site.id}
                                                    onClick={() => window.location.href = `/admin?site_id=${site.id}`}
                                                    className="flex items-center justify-between p-4 bg-red-900/20 border border-red-500/20 rounded-2xl hover:bg-red-900/30 transition-all text-left group"
                                                >
                                                    <div>
                                                        <p className="text-sm font-black text-red-300">{site.name}</p>
                                                        <p className="text-[10px] font-bold text-red-500 mt-0.5">작업중지 {site.alert_count}건</p>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 현장 관리 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 시스템 상태 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ AI 에이전트 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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
                                        <p className="text-indigo-300">[SAFETY] Accident-free streak: {accidentFreeDays ?? 0} days.</p>
                                        <p className="opacity-40 animate-pulse mt-2">_ {t.ai.thinking}</p>
                                    </div>

                                    {aiActionStatus && (
                                        <div className="px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-xs font-bold text-green-400 text-center">
                                            {aiActionStatus}
                                        </div>
                                    )}
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => { setAiActionStatus('수동 개입 요청 전송됨 — 운영팀 알림 발송'); setTimeout(() => setAiActionStatus(null), 3000); }}
                                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                        >{t.ai.intervention}</button>
                                        <button
                                            onClick={() => { setAiActionStatus('신경망 경로 최적화 완료 — 전 현장 재연결'); setTimeout(() => setAiActionStatus(null), 3000); }}
                                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                        >{t.ai.optimize}</button>
                                    </div>
                                </div>

                                {/* AI Configuration Side */}
                                <div className="flex flex-col gap-6">
                                    <div className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5 flex flex-col gap-6">
                                        <h4 className="text-lg font-black italic uppercase tracking-tight">{t.ai.capabilities}</h4>
                                        <div className="flex flex-col gap-4">
                                            {t.ai.caps.map((cap: any, idx: number) => (
                                                <button
                                                    key={cap.label}
                                                    onClick={() => setAiCapsActive(prev => prev.map((v, i) => i === idx ? !v : v))}
                                                    className="flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 rounded-2xl transition-all w-full text-left"
                                                >
                                                    <span className="text-xs font-bold text-slate-300">{cap.label}</span>
                                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${aiCapsActive[idx] ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${aiCapsActive[idx] ? 'right-1' : 'left-1'}`} />
                                                    </div>
                                                </button>
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
                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 보안 로그 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {activeTab === "logs" && (
                            <motion.div
                                key="security-logs"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col gap-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                                            <Lock className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tight">보안 감사 로그</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">최근 7일 · SUPER_ADMIN 전용</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchSecurityLogs}
                                        disabled={logsLoading}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                                        새로고침
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: '전체 이벤트', value: securityLogs.length, color: 'blue' },
                                        { label: '경고', value: securityLogs.filter(l => l.severity === 'warn').length, color: 'amber' },
                                        { label: '위험', value: securityLogs.filter(l => l.severity === 'critical').length, color: 'red' },
                                    ].map(stat => (
                                        <div key={stat.label} className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                                            <span className={`text-2xl font-black ${stat.color === 'red' ? 'text-red-400' : stat.color === 'amber' ? 'text-amber-400' : 'text-blue-400'}`}>
                                                {stat.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-slate-900/40 border border-white/5 rounded-[32px] overflow-hidden">
                                    <div className="flex gap-4 px-6 py-3 border-b border-white/5 bg-black/20">
                                        <span className="w-28 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />시간</span>
                                        <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-slate-500">이벤트</span>
                                        <span className="w-28 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><LogIn className="w-3 h-3" />행위자</span>
                                        <span className="w-14 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500">등급</span>
                                    </div>
                                    <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
                                        {logsLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : securityLogs.length === 0 ? (
                                            <div className="py-12 text-center text-slate-600 font-bold text-sm">로그 없음</div>
                                        ) : (
                                            securityLogs.map(log => (
                                                <div key={log.id} className={`flex gap-4 px-6 py-3.5 hover:bg-white/5 transition-colors ${log.severity === 'critical' ? 'bg-red-950/10' : log.severity === 'warn' ? 'bg-amber-950/10' : ''}`}>
                                                    <span className="w-28 flex-shrink-0 text-[10px] font-mono text-slate-500 self-center">
                                                        {new Date(log.timestamp).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="flex-1 text-xs font-bold text-slate-300 self-center leading-tight">{log.event}</span>
                                                    <span className="w-28 flex-shrink-0 text-xs font-bold text-slate-400 self-center truncate">{log.actor}</span>
                                                    <span className={`w-14 flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full self-center text-center ${
                                                        log.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                        log.severity === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                        {log.severity === 'critical' ? '위험' : log.severity === 'warn' ? '경고' : '정보'}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 전역 설정 탭 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {activeTab === "configs" && (
                            <motion.div
                                key="global-configs"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col gap-6 max-w-2xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                                        <Settings className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight">전역 시스템 설정</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">브라우저 세션 저장 · SUPER_ADMIN 전용</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {/* 시스템 모드 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">시스템 모드</h4>
                                        <div className="flex gap-3">
                                            {(['poc', 'production'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setGlobalConfig(c => ({ ...c, systemMode: mode }))}
                                                    className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                                                        globalConfig.systemMode === mode
                                                            ? mode === 'production'
                                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                                                : 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                                            : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                                                    }`}
                                                >
                                                    {mode === 'poc' ? '시범운영 (POC)' : '정식운영 (PROD)'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 알람 에스컬레이션 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">알람 에스컬레이션 시간</h4>
                                            <span className="text-sm font-black text-amber-400">{globalConfig.alertEscalationMinutes}분</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={60}
                                            step={5}
                                            value={globalConfig.alertEscalationMinutes}
                                            onChange={e => setGlobalConfig(c => ({ ...c, alertEscalationMinutes: Number(e.target.value) }))}
                                            className="w-full accent-amber-500"
                                        />
                                        <p className="text-[10px] text-slate-600 font-bold">작업중지 발생 후 {globalConfig.alertEscalationMinutes}분 내 미해제 시 본사 자동 보고</p>
                                    </div>

                                    {/* TBM 리마인더 + 기본 언어 */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">TBM 리마인더</h4>
                                            <button
                                                onClick={() => setGlobalConfig(c => ({ ...c, tbmReminderEnabled: !c.tbmReminderEnabled }))}
                                                className="flex items-center justify-between"
                                            >
                                                <span className="text-sm font-bold text-slate-300">{globalConfig.tbmReminderEnabled ? '활성화됨' : '비활성화됨'}</span>
                                                <div className={`w-12 h-6 rounded-full relative transition-colors ${globalConfig.tbmReminderEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalConfig.tbmReminderEnabled ? 'right-1' : 'left-1'}`} />
                                                </div>
                                            </button>
                                            <p className="text-[10px] text-slate-600 font-bold">오전 7:30 TBM 미실시 현장 자동 알림</p>
                                        </div>
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Globe className="w-3.5 h-3.5" />기본 언어</h4>
                                            <div className="flex gap-2">
                                                {(['ko', 'en'] as const).map(l => (
                                                    <button
                                                        key={l}
                                                        onClick={() => setGlobalConfig(c => ({ ...c, defaultLanguage: l }))}
                                                        className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase transition-all border ${
                                                            globalConfig.defaultLanguage === l
                                                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                                                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                                                        }`}
                                                    >
                                                        {l === 'ko' ? '한국어' : 'English'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 긴급 연락처 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">긴급 연락처</h4>
                                        <input
                                            type="text"
                                            value={globalConfig.emergencyContact}
                                            onChange={e => setGlobalConfig(c => ({ ...c, emergencyContact: e.target.value }))}
                                            placeholder="전화번호 입력"
                                            className="w-full bg-black/30 border border-white/5 rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-blue-500 focus:outline-none transition-all"
                                        />
                                        <p className="text-[10px] text-slate-600 font-bold">중대재해 발생 시 최우선 통보 연락처 (고용노동부: 1544-1350)</p>
                                    </div>

                                    {/* 유지보수 모드 */}
                                    <div className={`border rounded-[24px] p-6 flex items-center justify-between transition-all ${globalConfig.maintenanceMode ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-900/40 border-white/5'}`}>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">유지보수 모드</h4>
                                            <p className="text-[10px] text-slate-600 font-bold">활성화 시 SUPER_ADMIN 외 모든 사용자 접근 차단</p>
                                        </div>
                                        <button
                                            onClick={() => setGlobalConfig(c => ({ ...c, maintenanceMode: !c.maintenanceMode }))}
                                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                                                globalConfig.maintenanceMode
                                                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                                    : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {globalConfig.maintenanceMode ? '활성화됨' : '비활성'}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveConfig}
                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        configSaved
                                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    }`}
                                >
                                    {configSaved ? <><CheckCircle2 className="w-4 h-4" />저장됨</> : <><Save className="w-4 h-4" />설정 저장</>}
                                </button>
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

"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import SystemHealthCheck from "@/components/SystemHealthCheck";
import { canAccessSystem, type ProfileRole } from "@/lib/roles";
import { logoutV3 } from "@/lib/v3-auth";
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
    Menu,
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

type PendingAdminRole = "HQ_ADMIN" | "SITE_ADMIN" | "SAFETY_MANAGER" | "VIEWER";

type PendingAdminAccount = {
    id: number;
    email: string | null;
    displayName: string | null;
    preferredLanguage: string | null;
    accountStatus: string;
};

type PendingAdminDraft = {
    role: PendingAdminRole;
    siteId: string;
};

type SiteOption = {
    id: string;
    name: string;
    site_code?: string | null;
};

const ADMIN_APPROVAL_ROLES: PendingAdminRole[] = ["SITE_ADMIN", "SAFETY_MANAGER", "VIEWER", "HQ_ADMIN"];
const SITE_SCOPED_ADMIN_ROLES = new Set<PendingAdminRole>(["SITE_ADMIN", "SAFETY_MANAGER", "VIEWER"]);
const DEFAULT_PENDING_ADMIN_DRAFT: PendingAdminDraft = { role: "SITE_ADMIN", siteId: "" };

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
        pendingAdmins: {
            title: "승인 대기 관리자",
            waiting: "승인 대기",
            refresh: "새로고침",
            empty: "승인 대기 계정이 없습니다",
            role: "역할",
            site: "현장",
            noSite: "현장 선택",
            globalScope: "전역 권한",
            approve: "승인",
            approving: "승인 중",
            loadFailed: "승인 대기 계정을 불러오지 못했습니다",
            approveFailed: "승인 실패",
            siteRequired: "현장 권한 역할은 현장을 먼저 선택해야 합니다",
            pendingLoginBlocked: "승인 전 로그인 불가",
            emailMissing: "email 없음",
            roles: {
                HQ_ADMIN: "본사 관리자",
                SITE_ADMIN: "현장 관리자",
                SAFETY_MANAGER: "안전 관리자",
                VIEWER: "조회 전용",
            },
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
        pendingAdmins: {
            title: "Pending Admins",
            waiting: "Pending",
            refresh: "Refresh",
            empty: "No pending admin accounts",
            role: "Role",
            site: "Site",
            noSite: "Select site",
            globalScope: "Global Scope",
            approve: "Approve",
            approving: "Approving",
            loadFailed: "Failed to load pending accounts",
            approveFailed: "Approval failed",
            siteRequired: "Select a site before approving a site-scoped role",
            pendingLoginBlocked: "Login blocked until approval",
            emailMissing: "No email",
            roles: {
                HQ_ADMIN: "HQ Admin",
                SITE_ADMIN: "Site Admin",
                SAFETY_MANAGER: "Safety Manager",
                VIEWER: "Viewer",
            },
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
        <div className="console-light min-h-screen flex flex-col items-center justify-center bg-slate-950 text-blue-600">
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
    const [pendingAdmins, setPendingAdmins] = useState<PendingAdminAccount[]>([]);
    const [pendingAdminsLoading, setPendingAdminsLoading] = useState(false);
    const [pendingAdminsError, setPendingAdminsError] = useState<string | null>(null);
    const [approvalDrafts, setApprovalDrafts] = useState<Record<number, PendingAdminDraft>>({});
    const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
    const [approvingAdminId, setApprovingAdminId] = useState<number | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const t = systemUI[lang];

    const loadSiteOptions = useCallback(async () => {
        try {
            const res = await fetch("/api/sites/options", { cache: "no-store", credentials: "include" });
            if (!res.ok) {
                setSiteOptions([]);
                return;
            }
            const data = (await res.json()) as { sites?: SiteOption[] };
            setSiteOptions(Array.isArray(data.sites) ? data.sites : []);
        } catch {
            setSiteOptions([]);
        }
    }, []);

    const loadPendingAdmins = useCallback(async () => {
        setPendingAdminsLoading(true);
        setPendingAdminsError(null);
        try {
            const res = await fetch("/api/admin/accounts/pending", { cache: "no-store", credentials: "include" });
            if (!res.ok) {
                throw new Error(`pending_admins_${res.status}`);
            }
            const data = (await res.json()) as { accounts?: PendingAdminAccount[] };
            const accounts = Array.isArray(data.accounts) ? data.accounts : [];
            setPendingAdmins(accounts);
            setApprovalDrafts((current) => {
                const next: Record<number, PendingAdminDraft> = {};
                accounts.forEach((account) => {
                    next[account.id] = current[account.id] ?? { ...DEFAULT_PENDING_ADMIN_DRAFT };
                });
                return next;
            });
        } catch {
            setPendingAdmins([]);
            setPendingAdminsError(systemUI[lang].pendingAdmins.loadFailed);
        } finally {
            setPendingAdminsLoading(false);
        }
    }, [lang]);

    const updateApprovalDraft = (accountId: number, patch: Partial<PendingAdminDraft>) => {
        setApprovalDrafts((current) => ({
            ...current,
            [accountId]: {
                ...(current[accountId] ?? DEFAULT_PENDING_ADMIN_DRAFT),
                ...patch,
            },
        }));
    };

    const approvePendingAdmin = async (account: PendingAdminAccount) => {
        const draft = approvalDrafts[account.id] ?? DEFAULT_PENDING_ADMIN_DRAFT;
        const siteRequired = SITE_SCOPED_ADMIN_ROLES.has(draft.role);
        if (siteRequired && !draft.siteId) {
            alert(t.pendingAdmins.siteRequired);
            return;
        }

        setApprovingAdminId(account.id);
        try {
            const res = await fetch(`/api/admin/accounts/${account.id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    target_role: draft.role,
                    target_site_id: siteRequired ? Number(draft.siteId) : null,
                }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error ?? `admin_approval_failed_${res.status}`);
            }
            await loadPendingAdmins();
        } catch (error) {
            const message = error instanceof Error ? error.message : "admin_approval_failed";
            alert(`${t.pendingAdmins.approveFailed}: ${message}`);
        } finally {
            setApprovingAdminId(null);
        }
    };

    // defense-in-depth: 클라이언트 사이드 권한 2차 검증
    useEffect(() => {
        const verifyAccess = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (!res.ok) {
                window.location.replace("/auth");
                return;
            }
            const data = (await res.json()) as {
                profile?: { role?: string } | null;
                v3?: { roles?: string[] };
            };
            const roles = data.v3?.roles ?? (data.profile?.role ? [data.profile.role] : []);
            if (!roles.some((role) => canAccessSystem(role as ProfileRole))) {
                window.location.replace("/");
                return;
            }
            setIsVerified(true);
        };
        verifyAccess();
    }, []);

    useEffect(() => {
        if (!isVerified) return;
        void loadSiteOptions();
        void loadPendingAdmins();
    }, [isVerified, loadPendingAdmins, loadSiteOptions]);

    // 시뮬레이션 모드일 때 사용할 데이터
    const displaySites = isSimulation ? SIM_SITES : sites;
    const displaySafetyOfficerCount = isSimulation ? SIM_SAFETY_OFFICER_COUNT : safetyOfficerCount;
    const displayHqAdminCount = isSimulation ? SIM_HQ_ADMIN_COUNT : hqAdminCount;
    const displayAccidentFreeDays = isSimulation ? SIM_ACCIDENT_FREE_DAYS : accidentFreeDays;

    useEffect(() => {
        const init = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (res.ok) {
                const data = (await res.json()) as {
                    user?: { id: string; email: string | null };
                    profile?: { role?: string; display_name?: string | null } | null;
                };
                if (data.user && data.profile) {
                    setCurrentUser({
                        id: data.user.id,
                        email: data.user.email,
                        display_name: data.profile.display_name,
                        role: data.profile.role,
                    });
                }
            }
            await fetchSites();
        };
        init();
    }, []);

    const fetchSites = async () => {
        setLoading(true);
        const res = await fetch("/api/system/summary", { cache: "no-store", credentials: "include" });
        if (res.ok) {
            const data = await res.json() as {
                sites?: Site[];
                safetyOfficerCount?: number;
                hqAdminCount?: number;
                accidentFreeDays?: number;
            };
            setSites(data.sites ?? []);
            setSafetyOfficerCount(data.safetyOfficerCount ?? 0);
            setHqAdminCount(data.hqAdminCount ?? 0);
            setAccidentFreeDays(data.accidentFreeDays ?? 0);
        }
        setLoading(false);
    };

    const fetchSecurityLogs = useCallback(async () => {
        setLogsLoading(true);
        const res = await fetch("/api/system/security-logs", { cache: "no-store", credentials: "include" });
        if (res.ok) {
            const data = await res.json() as { logs?: LogEntry[] };
            setSecurityLogs(data.logs ?? []);
        }
        setLogsLoading(false);
    }, []);

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
    useEffect(() => {
        if (activeTab === 'logs' && securityLogs.length === 0) {
            void fetchSecurityLogs();
        }
    }, [activeTab, fetchSecurityLogs, securityLogs.length]);

    const handleSignOut = async () => {
        await logoutV3().catch(() => undefined);
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
        setLoading(true);
        const res = await fetch("/api/system/sites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                id: editingSite?.id ?? null,
                name: siteForm.name,
                address: siteForm.address,
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            alert(err.error ?? "site_save_failed");
        }

        setIsModalOpen(false);
        await fetchSites();
    };

    const handleDeleteSite = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(t.site.deleteConfirm)) return;

        setLoading(true);
        const res = await fetch(`/api/system/sites/${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "include",
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            alert(err.error ?? "site_delete_failed");
        }
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
            <div className="console-light min-h-screen bg-[#030308] text-white font-sans overflow-x-hidden relative">
                {/* Animated Background Gradients */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[0%] right-[0%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                {isSidebarOpen && (
                    <button
                        type="button"
                        aria-label="시스템 메뉴 닫기"
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    />
                )}

                {/* Sidebar */}
                <aside className={`safe-area-fixed-rail fixed left-0 top-0 bottom-0 w-64 bg-slate-950/90 md:bg-slate-950/50 backdrop-blur-xl border-r border-white/5 z-50 flex flex-col p-6 transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} ${isSidebarCollapsed ? "md:-translate-x-full" : "md:translate-x-0"}`}>
                    <div className="flex items-center gap-2 mb-10 px-1">
                        <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="whitespace-nowrap text-lg font-black tracking-tighter italic uppercase text-gradient">{t.title}</h1>
                            <p className="truncate whitespace-nowrap text-[9px] text-slate-500 font-bold tracking-wider uppercase">{t.rootAccess}</p>
                        </div>
                        <button
                            type="button"
                            aria-label="시스템 메뉴 닫기"
                            onClick={() => setIsSidebarOpen(false)}
                            className="ml-auto md:hidden w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="시스템 메뉴 접기"
                            onClick={() => setIsSidebarCollapsed(true)}
                            className="ml-auto hidden md:flex w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 items-center justify-center transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
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
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsSidebarOpen(false);
                                }}
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
                <main className={`min-h-screen transition-[margin] duration-300 ${isSidebarCollapsed ? "md:ml-0" : "md:ml-64"}`}>
                    <header className="concept-page-header">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                aria-label="시스템 메뉴 열기"
                                onClick={() => setIsSidebarOpen(true)}
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:bg-slate-100 md:hidden ${isSidebarOpen ? "invisible pointer-events-none" : "visible"}`}
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            {isSidebarCollapsed && (
                                <button
                                    type="button"
                                    aria-label="시스템 메뉴 열기"
                                    onClick={() => setIsSidebarCollapsed(false)}
                                    className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:bg-slate-100 md:grid"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                            )}
                            <Image
                                src="/brand/seowon-logo-compact-transparent.png"
                                alt="SEOWON Since 1991"
                                width={208}
                                height={60}
                                priority
                                unoptimized
                                className="h-auto w-[104px] shrink-0 object-contain sm:w-[124px]"
                            />
                            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                            <div className="hidden min-w-0 sm:block">
                                <p className="truncate text-sm font-black tracking-tight text-[#172033]">{t.title}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{t.rootAccess}</p>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <button
                                onClick={() => setIsSimulation(v => !v)}
                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-black uppercase tracking-widest transition-all sm:px-3 ${
                                    isSimulation
                                        ? 'border-violet-200 bg-violet-50 text-violet-600'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-blue-600'
                                }`}
                            >
                                <FlaskConical className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{isSimulation ? "시뮬레이션 ON" : "시뮬레이션"}</span>
                            </button>

                            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                <button
                                    onClick={() => setLang('ko')}
                                    className={`rounded-md px-2.5 py-1.5 text-[9px] font-black transition-all ${lang === 'ko' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
                                >
                                    KO
                                </button>
                                <button
                                    onClick={() => setLang('en')}
                                    className={`rounded-md px-2.5 py-1.5 text-[9px] font-black transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
                                >
                                    EN
                                </button>
                            </div>

                            {activeTab === 'sites' && (
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleOpenAddModal}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[9px] font-black text-white shadow-sm transition-all hover:bg-blue-500"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t.openNewSite}</span>
                                </motion.button>
                            )}
                        </div>
                    </header>

                    <section className="admin-concept-hero relative flex min-h-[280px] w-full items-end justify-between overflow-hidden px-5 pb-7 pt-20 sm:px-8 md:min-h-[340px] md:px-12 md:pb-10">
                        <Image src="/images/safelink-pages/system-security-center.png" alt="SQ Link system security center" fill className="object-cover" priority />
                        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="relative z-10 max-w-2xl"
                        >
                            <p className="mb-2 text-[10px] font-black tracking-[.2em] text-blue-200">SQ-LINK SYSTEM CONTROL</p>
                            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                                {activeTab === 'dashboard' ? t.dashboard : activeTab === 'sites' ? t.orchestration : t.intelligence}
                            </h2>
                            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-100 sm:text-base">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>{lang === 'ko' ? `${displaySites.length}개 현장 · ${totalWorkers}명 근로자 실시간 모니터링` : `${displaySites.length} sites · ${totalWorkers} workers monitored`}</span>
                            </div>
                        </motion.div>

                    </section>

                    <div className="p-4 md:p-12">

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

                                {/* 관리자 승인 대기 */}
                                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-6 sm:p-8 flex flex-col gap-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                                <Shield className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-black tracking-tight">{t.pendingAdmins.title}</h3>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    {pendingAdmins.length} {t.pendingAdmins.waiting} · {t.pendingAdmins.pendingLoginBlocked}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={loadPendingAdmins}
                                            disabled={pendingAdminsLoading}
                                            className="self-start sm:self-auto h-10 px-4 rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${pendingAdminsLoading ? "animate-spin" : ""}`} />
                                            {t.pendingAdmins.refresh}
                                        </button>
                                    </div>

                                    {pendingAdminsError && (
                                        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-xs font-bold text-red-300">
                                            {pendingAdminsError}
                                        </div>
                                    )}

                                    {pendingAdminsLoading ? (
                                        <div className="flex flex-col gap-3">
                                            {[1, 2].map((item) => (
                                                <div key={item} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
                                            ))}
                                        </div>
                                    ) : pendingAdmins.length === 0 ? (
                                        <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-6 text-center text-sm font-bold text-slate-500">
                                            {t.pendingAdmins.empty}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {pendingAdmins.map((account) => {
                                                const draft = approvalDrafts[account.id] ?? DEFAULT_PENDING_ADMIN_DRAFT;
                                                const siteRequired = SITE_SCOPED_ADMIN_ROLES.has(draft.role);
                                                return (
                                                    <div key={account.id} className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-black text-white truncate">
                                                                    {account.displayName || account.email || `#${account.id}`}
                                                                </p>
                                                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                                                                    {account.accountStatus}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-xs font-bold text-slate-500 truncate">{account.email || t.pendingAdmins.emailMissing}</p>
                                                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                                ID {account.id} · {account.preferredLanguage || "ko"}
                                                            </p>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,180px)_minmax(180px,240px)_auto] gap-2 lg:flex lg:items-center">
                                                            <label className="sr-only" htmlFor={`pending-role-${account.id}`}>{t.pendingAdmins.role}</label>
                                                            <select
                                                                id={`pending-role-${account.id}`}
                                                                value={draft.role}
                                                                onChange={(event) => updateApprovalDraft(account.id, { role: event.target.value as PendingAdminRole })}
                                                                className="h-11 rounded-2xl border border-white/10 bg-slate-950 px-3 text-xs font-bold text-slate-200 outline-none focus:border-blue-500"
                                                            >
                                                                {ADMIN_APPROVAL_ROLES.map((role) => (
                                                                    <option key={role} value={role}>{t.pendingAdmins.roles[role]}</option>
                                                                ))}
                                                            </select>

                                                            <label className="sr-only" htmlFor={`pending-site-${account.id}`}>{t.pendingAdmins.site}</label>
                                                            <select
                                                                id={`pending-site-${account.id}`}
                                                                value={siteRequired ? draft.siteId : ""}
                                                                onChange={(event) => updateApprovalDraft(account.id, { siteId: event.target.value })}
                                                                disabled={!siteRequired}
                                                                className="h-11 rounded-2xl border border-white/10 bg-slate-950 px-3 text-xs font-bold text-slate-200 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                <option value="">{siteRequired ? t.pendingAdmins.noSite : t.pendingAdmins.globalScope}</option>
                                                                {siteOptions.map((site) => (
                                                                    <option key={site.id} value={site.id}>
                                                                        {site.name}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <button
                                                                type="button"
                                                                onClick={() => approvePendingAdmin(account)}
                                                                disabled={approvingAdminId === account.id || (siteRequired && !draft.siteId)}
                                                                className="h-11 rounded-2xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                {approvingAdminId === account.id ? t.pendingAdmins.approving : t.pendingAdmins.approve}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 전국 현장 현황 바 차트 */}
                                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-5 sm:p-8 flex flex-col gap-6">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-blue-400" />
                                            <h3 className="text-base font-black uppercase tracking-tight sm:text-lg">전국 현장 근로자 현황</h3>
                                        </div>
                                        <span className="shrink-0 text-right text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:text-[10px]">전체 {displaySites.length}개 현장</span>
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
                                                    <div key={site.id} className="group flex min-w-0 items-center gap-2 sm:gap-4">
                                                        <div className="w-24 flex-shrink-0 sm:w-32">
                                                            <p className="text-xs font-black text-slate-300 truncate leading-tight">{site.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-600 truncate">{site.address}</p>
                                                        </div>
                                                        <div className="relative min-w-0 flex-1 h-8 bg-slate-800/60 rounded-2xl overflow-hidden">
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
                                                            className="hidden flex-shrink-0 items-center gap-1 text-[9px] font-black text-blue-400 uppercase tracking-wider opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
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
                                        <p className="opacity-50">[SYSTEM] Initializing SQ Link Global Agent...</p>
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
                            <div className="safe-area-overlay fixed inset-0 z-[100] flex items-center justify-center">
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
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">SQ Link FIELD MANAGEMENT</p>
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
                    </div>
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

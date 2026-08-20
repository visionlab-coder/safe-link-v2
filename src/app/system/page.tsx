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
import { persistDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

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
    defaultLanguage: 'ko' | 'en' | 'zh' | 'vi' | 'ru';
    emergencyContact: string;
    maintenanceMode: boolean;
};

const SYSTEM_LANGUAGE_OPTIONS = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'ru', label: 'Русский' },
] as const;

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
        },
        common: {
            fieldSafetyMode: "현장 안전관리 모드", fieldSafetyConsole: "현장 안전관리 콘솔", signOut: "로그아웃", developerMode: "개발자 모드", stable: "안정",
            simulation: "시뮬레이션", simulationOn: "시뮬레이션 켜짐", systemControl: "SQ-LINK 시스템 관제",
            monitoring: (sites: number, workers: number) => `${sites}개 현장 · ${workers}명 근로자 실시간 모니터링`,
            simulationNotice: "시뮬레이션 모드 — 서원토건 전국 20개 현장 가상 데이터 표시 중 (실제 DB 아님)",
            active: "활성 현장", registered: "등록 근로자", today: "오늘 실시", unresolved: "미해결", clear: "이상 없음",
            accidentFreeDays: "무사고 연속일", days: "일", alertSiteExists: "알람 발생 현장 있음", stopWorkBased: "마지막 작업중지 알람 기준",
            goal: "1000일 무사고 목표", achieved: "달성!", goalAchieved: "1000일 무사고 목표 달성", daysRemaining: "일 남음", progress: "달성",
            tbmCompliance: "당일 TBM 이행률", totalTbmToday: (count: number) => `오늘 TBM 총 ${count}건 실시`,
            personnel: "전국 인력 구성", worker: "근로자", safetyManager: "안전관리자", hqAdmin: "본사 관리자",
            workforceBySite: "전국 현장 근로자 현황", allSites: (count: number) => `전체 ${count}개 현장`, noSites: "등록된 현장이 없습니다", enter: "입장",
            alertSites: "작업중지 알람 현장", alertCount: (count: number) => `${count}건 미해결`, stopWorkCount: (count: number) => `작업중지 ${count}건`, languageSaveFailed: "언어 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
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
        },
        common: {
            fieldSafetyMode: "Field Safety Mode", fieldSafetyConsole: "Field Safety Console", signOut: "Sign Out", developerMode: "Developer Mode", stable: "Stable",
            simulation: "Simulation", simulationOn: "Simulation On", systemControl: "SQ-LINK SYSTEM CONTROL",
            monitoring: (sites: number, workers: number) => `${sites} sites · ${workers} workers monitored in real time`,
            simulationNotice: "Simulation mode — showing virtual data for 20 Seowon Engineering sites (not live DB data)",
            active: "active", registered: "registered", today: "today", unresolved: "unresolved", clear: "clear",
            accidentFreeDays: "Accident-free days", days: "days", alertSiteExists: "Sites with active alerts", stopWorkBased: "Based on last stop-work alert",
            goal: "1,000-day accident-free goal", achieved: "Achieved!", goalAchieved: "1,000-day accident-free goal achieved", daysRemaining: "days remaining", progress: "complete",
            tbmCompliance: "Today's TBM completion", totalTbmToday: (count: number) => `${count} TBMs completed today`,
            personnel: "Workforce overview", worker: "Workers", safetyManager: "Safety managers", hqAdmin: "HQ admins",
            workforceBySite: "Workforce by site", allSites: (count: number) => `${count} sites total`, noSites: "No registered sites", enter: "Open",
            alertSites: "Sites with stop-work alerts", alertCount: (count: number) => `${count} unresolved`, stopWorkCount: (count: number) => `${count} stop-work alerts`, languageSaveFailed: "We could not save your language preference. Please try again.",
        }
    }
};

systemUI.zh = {
    ...systemUI.en,
    title: "综合系统", rootAccess: "最高访问权限", orchestration: "全局综合管控", intelligence: "系统智能控制", dashboard: "全国概览",
    openNewSite: "新建工地", stats: { sites: "活跃工地", workers: "工人总数", tbms: "今日 TBM", alerts: "停工警报" },
    sidebar: { dashboard: "全国概览", sites: "工地管理", data: "系统状态", ai: "AI 智能体", logs: "安全日志", configs: "全局设置" },
    common: { ...systemUI.en.common, fieldSafetyMode: "工地安全管理模式", fieldSafetyConsole: "工地安全控制台", signOut: "退出登录", developerMode: "开发者模式", stable: "稳定", simulation: "模拟", simulationOn: "模拟已开启", systemControl: "SQ-LINK 系统控制", monitoring: (sites: number, workers: number) => `实时监控 ${sites} 个工地 · ${workers} 名工人`, simulationNotice: "模拟模式 — 正在显示 20 个工地的虚拟数据（非实际数据库）", active: "活跃", registered: "已登记", today: "今日执行", unresolved: "未处理", clear: "正常", accidentFreeDays: "连续无事故天数", days: "天", alertSiteExists: "存在警报工地", stopWorkBased: "以最后一次停工警报为准", goal: "1,000 天无事故目标", achieved: "已完成！", goalAchieved: "已达成 1,000 天无事故目标", daysRemaining: "天剩余", progress: "完成", tbmCompliance: "当日 TBM 执行率", totalTbmToday: (count: number) => `今日已执行 ${count} 次 TBM`, personnel: "全国人员构成", worker: "工人", safetyManager: "安全管理员", hqAdmin: "总部管理员", workforceBySite: "各工地工人现状", allSites: (count: number) => `共 ${count} 个工地`, noSites: "没有已登记的工地", enter: "进入", alertSites: "停工警报工地", alertCount: (count: number) => `${count} 项未处理`, stopWorkCount: (count: number) => `${count} 次停工`, languageSaveFailed: "无法保存语言设置，请稍后重试。" },
};

systemUI.vi = {
    ...systemUI.en,
    title: "HỆ THỐNG TÍCH HỢP", rootAccess: "QUYỀN TRUY CẬP CAO NHẤT", orchestration: "Điều phối toàn cục", intelligence: "Điều khiển thông minh", dashboard: "Tổng quan toàn quốc",
    openNewSite: "Tạo công trường", stats: { sites: "Công trường hoạt động", workers: "Tổng công nhân", tbms: "TBM hôm nay", alerts: "Cảnh báo dừng việc" },
    sidebar: { dashboard: "Tổng quan", sites: "Quản lý công trường", data: "Trạng thái hệ thống", ai: "Tác nhân AI", logs: "Nhật ký bảo mật", configs: "Cài đặt chung" },
    common: { ...systemUI.en.common, fieldSafetyMode: "Chế độ an toàn công trường", fieldSafetyConsole: "Bảng điều khiển an toàn", signOut: "Đăng xuất", developerMode: "Chế độ nhà phát triển", stable: "Ổn định", simulation: "Mô phỏng", simulationOn: "Đang mô phỏng", systemControl: "ĐIỀU KHIỂN HỆ THỐNG SQ-LINK", monitoring: (sites: number, workers: number) => `Theo dõi thời gian thực ${sites} công trường · ${workers} công nhân`, simulationNotice: "Chế độ mô phỏng — đang hiển thị dữ liệu ảo của 20 công trường (không phải dữ liệu thực)", active: "hoạt động", registered: "đã đăng ký", today: "hôm nay", unresolved: "chưa xử lý", clear: "bình thường", accidentFreeDays: "Số ngày không tai nạn", days: "ngày", alertSiteExists: "Có công trường đang cảnh báo", stopWorkBased: "Dựa trên cảnh báo dừng việc gần nhất", goal: "Mục tiêu 1.000 ngày không tai nạn", achieved: "Đã đạt!", goalAchieved: "Đã đạt mục tiêu 1.000 ngày không tai nạn", daysRemaining: "ngày còn lại", progress: "hoàn thành", tbmCompliance: "Tỷ lệ TBM hôm nay", totalTbmToday: (count: number) => `Đã thực hiện ${count} TBM hôm nay`, personnel: "Cơ cấu nhân sự", worker: "Công nhân", safetyManager: "Quản lý an toàn", hqAdmin: "Quản trị viên trụ sở", workforceBySite: "Nhân sự theo công trường", allSites: (count: number) => `Tổng cộng ${count} công trường`, noSites: "Chưa có công trường được đăng ký", enter: "Mở", alertSites: "Công trường có cảnh báo dừng việc", alertCount: (count: number) => `${count} chưa xử lý`, stopWorkCount: (count: number) => `${count} cảnh báo dừng việc`, languageSaveFailed: "Không thể lưu cài đặt ngôn ngữ. Vui lòng thử lại." },
};

systemUI.ru = {
    ...systemUI.en,
    title: "ЕДИНАЯ СИСТЕМА", rootAccess: "МАКСИМАЛЬНЫЙ ДОСТУП", orchestration: "Глобальное управление", intelligence: "Интеллектуальное управление", dashboard: "Общий обзор",
    openNewSite: "Создать объект", stats: { sites: "Активные объекты", workers: "Всего работников", tbms: "TBM сегодня", alerts: "Оповещения о приостановке" },
    sidebar: { dashboard: "Обзор", sites: "Управление объектами", data: "Состояние системы", ai: "AI-агенты", logs: "Журнал безопасности", configs: "Общие настройки" },
    common: { ...systemUI.en.common, fieldSafetyMode: "Режим безопасности объекта", fieldSafetyConsole: "Панель безопасности объекта", signOut: "Выйти", developerMode: "Режим разработчика", stable: "Стабильно", simulation: "Симуляция", simulationOn: "Симуляция включена", systemControl: "УПРАВЛЕНИЕ СИСТЕМОЙ SQ-LINK", monitoring: (sites: number, workers: number) => `Мониторинг в реальном времени: ${sites} объектов · ${workers} работников`, simulationNotice: "Режим симуляции — показ виртуальных данных 20 объектов (не реальные данные БД)", active: "активно", registered: "зарегистрировано", today: "сегодня", unresolved: "не решено", clear: "без замечаний", accidentFreeDays: "Дней без происшествий", days: "дней", alertSiteExists: "Есть объекты с оповещениями", stopWorkBased: "По последнему оповещению о приостановке", goal: "Цель: 1 000 дней без происшествий", achieved: "Достигнуто!", goalAchieved: "Цель 1 000 дней без происшествий достигнута", daysRemaining: "дней осталось", progress: "выполнено", tbmCompliance: "Выполнение TBM сегодня", totalTbmToday: (count: number) => `Сегодня выполнено TBM: ${count}`, personnel: "Состав персонала", worker: "Работники", safetyManager: "Специалисты по безопасности", hqAdmin: "Администраторы HQ", workforceBySite: "Работники по объектам", allSites: (count: number) => `Всего объектов: ${count}`, noSites: "Нет зарегистрированных объектов", enter: "Открыть", alertSites: "Объекты с остановкой работ", alertCount: (count: number) => `Не решено: ${count}`, stopWorkCount: (count: number) => `Приостановок: ${count}`, languageSaveFailed: "Не удалось сохранить настройку языка. Повторите попытку." },
};

const SYSTEM_SECTION_COPY = {
    zh: {
        pendingAdmins: { title: "待审批管理员", waiting: "待审批", refresh: "刷新", empty: "没有待审批的管理员账户", role: "角色", site: "工地", noSite: "选择工地", globalScope: "全局权限", approve: "批准", approving: "正在批准", loadFailed: "无法加载待审批账户", approveFailed: "审批失败", siteRequired: "工地权限角色必须先选择工地", pendingLoginBlocked: "审批前无法登录", emailMissing: "没有电子邮箱", roles: { HQ_ADMIN: "总部管理员", SITE_ADMIN: "工地管理员", SAFETY_MANAGER: "安全管理员", VIEWER: "只读" } },
        site: { id: "工地 ID", tbmToday: "今日 TBM", alertCount: "停工", workerCount: "工人", status: "状态", operational: "正常运行", warning: "发生警报", link: "切换至工地控制台", viewAll: "查看所有工地", addTitle: "新建工地", editTitle: "修改工地信息", deleteTitle: "删除工地", deleteConfirm: "确定要删除此工地吗？相关数据也将被删除。", namePlaceholder: "输入工地名称", addrPlaceholder: "输入工地地址", save: "保存", cancel: "取消" },
        ai: { tower: "AI 智能体指挥中心", active: "全局监控已启用", thinking: "AI 正在分析…", intervention: "手动介入", optimize: "优化神经网络路径", capabilities: "智能体能力", response: "快速响应系统", responseDesc: "AI 智能体会在 1.2 秒内检测事故征兆并报告总部。", caps: [{ label: "实时情绪分析", active: true }, { label: "即时拦截风险关键词", active: true }, { label: "自动汇总工作报告", active: true }, { label: "紧急警报自动化", active: false }] },
    },
    vi: {
        pendingAdmins: { title: "Quản trị viên chờ phê duyệt", waiting: "Chờ phê duyệt", refresh: "Làm mới", empty: "Không có tài khoản quản trị viên chờ phê duyệt", role: "Vai trò", site: "Công trường", noSite: "Chọn công trường", globalScope: "Quyền toàn cục", approve: "Phê duyệt", approving: "Đang phê duyệt", loadFailed: "Không thể tải tài khoản chờ phê duyệt", approveFailed: "Phê duyệt thất bại", siteRequired: "Phải chọn công trường trước khi phê duyệt vai trò theo công trường", pendingLoginBlocked: "Không thể đăng nhập trước khi được phê duyệt", emailMissing: "Không có email", roles: { HQ_ADMIN: "Quản trị viên trụ sở", SITE_ADMIN: "Quản trị viên công trường", SAFETY_MANAGER: "Quản lý an toàn", VIEWER: "Chỉ xem" } },
        site: { id: "ID công trường", tbmToday: "TBM hôm nay", alertCount: "Dừng việc", workerCount: "Công nhân", status: "Trạng thái", operational: "Hoạt động bình thường", warning: "Có cảnh báo", link: "Chuyển đến bảng điều khiển công trường", viewAll: "Xem tất cả công trường", addTitle: "Tạo công trường", editTitle: "Sửa thông tin công trường", deleteTitle: "Xóa công trường", deleteConfirm: "Bạn có chắc muốn xóa công trường này? Dữ liệu liên quan cũng sẽ bị xóa.", namePlaceholder: "Nhập tên công trường", addrPlaceholder: "Nhập địa chỉ công trường", save: "Lưu", cancel: "Hủy" },
        ai: { tower: "Trung tâm chỉ huy tác nhân AI", active: "Đã bật giám sát toàn cục", thinking: "AI đang phân tích…", intervention: "Can thiệp thủ công", optimize: "Tối ưu đường dẫn mạng nơ-ron", capabilities: "Khả năng của tác nhân", response: "Hệ thống phản ứng nhanh", responseDesc: "Tác nhân AI phát hiện dấu hiệu tai nạn trong 1,2 giây và báo cáo về trụ sở.", caps: [{ label: "Phân tích cảm xúc thời gian thực", active: true }, { label: "Chặn từ khóa rủi ro tức thì", active: true }, { label: "Tự động tóm tắt báo cáo", active: true }, { label: "Tự động hóa còi báo khẩn cấp", active: false }] },
    },
    ru: {
        pendingAdmins: { title: "Ожидающие одобрения администраторы", waiting: "Ожидает", refresh: "Обновить", empty: "Нет ожидающих одобрения учётных записей", role: "Роль", site: "Объект", noSite: "Выберите объект", globalScope: "Глобальные права", approve: "Одобрить", approving: "Одобрение", loadFailed: "Не удалось загрузить ожидающие учётные записи", approveFailed: "Не удалось одобрить", siteRequired: "Для роли объекта сначала выберите объект", pendingLoginBlocked: "Вход невозможен до одобрения", emailMissing: "Нет email", roles: { HQ_ADMIN: "Администратор HQ", SITE_ADMIN: "Администратор объекта", SAFETY_MANAGER: "Менеджер безопасности", VIEWER: "Только просмотр" } },
        site: { id: "ID объекта", tbmToday: "TBM сегодня", alertCount: "Приостановка", workerCount: "Работники", status: "Статус", operational: "Работает штатно", warning: "Есть оповещение", link: "Перейти к консоли объекта", viewAll: "Все объекты", addTitle: "Создать объект", editTitle: "Изменить данные объекта", deleteTitle: "Удалить объект", deleteConfirm: "Удалить этот объект? Все связанные данные также будут удалены.", namePlaceholder: "Введите название объекта", addrPlaceholder: "Введите адрес объекта", save: "Сохранить", cancel: "Отмена" },
        ai: { tower: "Командный центр AI-агентов", active: "Глобальный мониторинг включён", thinking: "AI анализирует…", intervention: "Ручное вмешательство", optimize: "Оптимизировать нейронные маршруты", capabilities: "Возможности агента", response: "Система быстрого реагирования", responseDesc: "AI-агент обнаруживает признаки происшествия за 1,2 секунды и сообщает в штаб.", caps: [{ label: "Анализ настроений в реальном времени", active: true }, { label: "Немедленная блокировка рискованных ключевых слов", active: true }, { label: "Автоматическое резюме отчёта", active: true }, { label: "Автоматизация экстренной сирены", active: false }] },
    },
} as const;

for (const [language, copy] of Object.entries(SYSTEM_SECTION_COPY)) {
    systemUI[language] = { ...systemUI[language], ...copy };
}

// ──────────────────────────────────────────────────────────────
// 권한 검증 로딩 화면 (defense-in-depth 가드용)
// ──────────────────────────────────────────────────────────────
const SYSTEM_EXTRA = {
    ko: { loading: "권한 확인 중…", menuOpen: "시스템 메뉴 열기", menuClose: "시스템 메뉴 닫기", menuCollapse: "시스템 메뉴 접기", displayLanguage: "표시 언어", audit: "보안 감사 로그", recentOnly: "최근 7일 · 최고 관리자 전용", refresh: "새로고침", allEvents: "전체 이벤트", warning: "경고", critical: "위험", time: "시간", event: "이벤트", actor: "행위자", level: "등급", noLogs: "로그 없음", info: "정보", settings: "전역 시스템 설정", sessionOnly: "브라우저 세션 저장 · 최고 관리자 전용", systemMode: "시스템 모드", pilot: "시범 운영 (POC)", production: "정식 운영 (PROD)", escalation: "알람 에스컬레이션 시간", minutes: "분", people: "명", escalationDesc: (minutes: number) => `작업중지 발생 후 ${minutes}분 내 미해제 시 본사에 자동 보고`, reminder: "TBM 리마인더", enabled: "활성화됨", disabled: "비활성화됨", reminderDesc: "오전 7:30 TBM 미실시 현장에 자동 알림", defaultLanguage: "기본 언어", emergencyContact: "긴급 연락처", phonePlaceholder: "전화번호 입력", emergencyDesc: "중대재해 발생 시 최우선 통보 연락처 (고용노동부: 1544-1350)", maintenance: "유지보수 모드", maintenanceDesc: "활성화 시 최고 관리자 외 모든 사용자 접근 차단", save: "설정 저장", saved: "저장됨" },
    en: { loading: "Checking access…", menuOpen: "Open system menu", menuClose: "Close system menu", menuCollapse: "Collapse system menu", displayLanguage: "Display language", audit: "Security audit logs", recentOnly: "Last 7 days · super admin only", refresh: "Refresh", allEvents: "All events", warning: "Warning", critical: "Critical", time: "Time", event: "Event", actor: "Actor", level: "Level", noLogs: "No logs", info: "Info", settings: "Global system settings", sessionOnly: "Stored in this browser session · super admin only", systemMode: "System mode", pilot: "Pilot (POC)", production: "Production (PROD)", escalation: "Alert escalation time", minutes: "min", people: " people", escalationDesc: (minutes: number) => `Automatically report to HQ if unresolved after ${minutes} minutes`, reminder: "TBM reminder", enabled: "Enabled", disabled: "Disabled", reminderDesc: "Automatically notify sites without a TBM at 7:30 AM", defaultLanguage: "Default language", emergencyContact: "Emergency contact", phonePlaceholder: "Enter phone number", emergencyDesc: "Primary contact for serious incidents (Ministry of Employment and Labor: 1544-1350)", maintenance: "Maintenance mode", maintenanceDesc: "When enabled, only super administrators can access the service", save: "Save settings", saved: "Saved" },
    zh: { loading: "正在确认权限…", menuOpen: "打开系统菜单", menuClose: "关闭系统菜单", menuCollapse: "收起系统菜单", displayLanguage: "显示语言", audit: "安全审计日志", recentOnly: "最近 7 天 · 仅限最高管理员", refresh: "刷新", allEvents: "全部事件", warning: "警告", critical: "严重", time: "时间", event: "事件", actor: "操作者", level: "等级", noLogs: "没有日志", info: "信息", settings: "全局系统设置", sessionOnly: "保存于浏览器会话 · 仅限最高管理员", systemMode: "系统模式", pilot: "试运行 (POC)", production: "正式运行 (PROD)", escalation: "警报升级时间", minutes: "分钟", escalationDesc: (minutes: number) => `停工后 ${minutes} 分钟仍未解除时自动报告总部`, reminder: "TBM 提醒", enabled: "已启用", disabled: "已禁用", reminderDesc: "上午 7:30 自动通知未执行 TBM 的工地", defaultLanguage: "默认语言", emergencyContact: "紧急联系人", phonePlaceholder: "输入电话号码", emergencyDesc: "发生重大事故时的优先通知联系人（雇佣劳动部：1544-1350）", maintenance: "维护模式", maintenanceDesc: "启用后仅最高管理员可以访问服务", save: "保存设置", saved: "已保存" },
    vi: { loading: "Đang kiểm tra quyền truy cập…", menuOpen: "Mở menu hệ thống", menuClose: "Đóng menu hệ thống", menuCollapse: "Thu gọn menu hệ thống", displayLanguage: "Ngôn ngữ hiển thị", audit: "Nhật ký kiểm toán bảo mật", recentOnly: "7 ngày gần đây · chỉ quản trị viên cấp cao", refresh: "Làm mới", allEvents: "Tất cả sự kiện", warning: "Cảnh báo", critical: "Nghiêm trọng", time: "Thời gian", event: "Sự kiện", actor: "Người thực hiện", level: "Mức độ", noLogs: "Không có nhật ký", info: "Thông tin", settings: "Cài đặt hệ thống chung", sessionOnly: "Lưu trong phiên trình duyệt · chỉ quản trị viên cấp cao", systemMode: "Chế độ hệ thống", pilot: "Thử nghiệm (POC)", production: "Vận hành chính thức (PROD)", escalation: "Thời gian nâng mức cảnh báo", minutes: "phút", escalationDesc: (minutes: number) => `Tự động báo cáo trụ sở nếu chưa giải quyết sau ${minutes} phút`, reminder: "Nhắc TBM", enabled: "Đã bật", disabled: "Đã tắt", reminderDesc: "Tự động thông báo lúc 7:30 sáng cho công trường chưa thực hiện TBM", defaultLanguage: "Ngôn ngữ mặc định", emergencyContact: "Liên hệ khẩn cấp", phonePlaceholder: "Nhập số điện thoại", emergencyDesc: "Liên hệ ưu tiên khi xảy ra tai nạn nghiêm trọng (Bộ Việc làm và Lao động: 1544-1350)", maintenance: "Chế độ bảo trì", maintenanceDesc: "Khi bật, chỉ quản trị viên cấp cao được truy cập dịch vụ", save: "Lưu cài đặt", saved: "Đã lưu" },
    ru: { loading: "Проверка доступа…", menuOpen: "Открыть системное меню", menuClose: "Закрыть системное меню", menuCollapse: "Свернуть системное меню", displayLanguage: "Язык интерфейса", audit: "Журнал аудита безопасности", recentOnly: "Последние 7 дней · только для главного администратора", refresh: "Обновить", allEvents: "Все события", warning: "Предупреждение", critical: "Критический", time: "Время", event: "Событие", actor: "Исполнитель", level: "Уровень", noLogs: "Нет журналов", info: "Информация", settings: "Глобальные настройки системы", sessionOnly: "Сохранено в сессии браузера · только для главного администратора", systemMode: "Режим системы", pilot: "Пилотный режим (POC)", production: "Рабочий режим (PROD)", escalation: "Время эскалации тревоги", minutes: "мин", escalationDesc: (minutes: number) => `Автоматически сообщить в штаб, если не устранено за ${minutes} мин.`, reminder: "Напоминание TBM", enabled: "Включено", disabled: "Выключено", reminderDesc: "Автоматически уведомлять объекты без TBM в 7:30", defaultLanguage: "Язык по умолчанию", emergencyContact: "Экстренный контакт", phonePlaceholder: "Введите номер телефона", emergencyDesc: "Приоритетный контакт при серьёзном происшествии (Министерство труда: 1544-1350)", maintenance: "Режим обслуживания", maintenanceDesc: "После включения доступ остаётся только у главного администратора", save: "Сохранить настройки", saved: "Сохранено" },
} as const;

function LoadingScreen({ label }: { label: string }) {
    return (
        <div className="console-light min-h-screen flex flex-col items-center justify-center bg-slate-950 text-blue-600">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="animate-pulse tracking-widest font-bold text-sm">{label}</p>
        </div>
    );
}

export default function SystemAdminPage() {
    const displayLanguage = useDisplayLanguage();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [lang, setLang] = useState("ko");
    const [languageSaving, setLanguageSaving] = useState(false);
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
    const t = systemUI[lang] || systemUI.en;
    const extra = SYSTEM_EXTRA[lang as keyof typeof SYSTEM_EXTRA] || SYSTEM_EXTRA.en;

    useEffect(() => {
        if (SYSTEM_LANGUAGE_OPTIONS.some((option) => option.code === displayLanguage)) {
            setLang(displayLanguage);
        }
    }, [displayLanguage]);

    const changeMyLanguage = async (nextLang: string) => {
        if (!SYSTEM_LANGUAGE_OPTIONS.some((option) => option.code === nextLang)) return;
        const previousLang = lang;
        setLang(nextLang);
        persistDisplayLanguage(nextLang);

        if (!currentUser?.display_name) return;
        setLanguageSaving(true);
        try {
            const response = await fetch("/api/auth/setup-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ display_name: currentUser.display_name, preferred_lang: nextLang }),
            });
            if (!response.ok) throw new Error("language_update_failed");
            setCurrentUser((user: any) => user ? { ...user, preferred_lang: nextLang } : user);
        } catch {
            // 화면 언어는 즉시 반영하되, 저장 실패 시 이전 사용자 설정으로 되돌린다.
            setLang(previousLang);
            persistDisplayLanguage(previousLang);
            window.alert((systemUI[nextLang] || systemUI.en).common.languageSaveFailed);
        } finally {
            setLanguageSaving(false);
        }
    };

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
                    profile?: { role?: string; display_name?: string | null; preferred_lang?: string | null } | null;
                };
                if (data.user && data.profile) {
                    setCurrentUser({
                        id: data.user.id,
                        email: data.user.email,
                        display_name: data.profile.display_name,
                        role: data.profile.role,
                        preferred_lang: data.profile.preferred_lang || "ko",
                    });
                    const savedLang = localStorage.getItem("safe-link-lang");
                    if (!savedLang && SYSTEM_LANGUAGE_OPTIONS.some((option) => option.code === data.profile?.preferred_lang)) {
                        setLang(data.profile.preferred_lang!);
                    }
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

    if (!isVerified) return <LoadingScreen label={extra.loading} />;

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
                        aria-label={extra.menuClose}
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
                            aria-label={extra.menuClose}
                            onClick={() => setIsSidebarOpen(false)}
                            className="ml-auto md:hidden w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={extra.menuCollapse}
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
                                <span className="text-xs font-black tracking-tight">{t.common.fieldSafetyMode}</span>
                                <span className="text-[9px] text-amber-500/60 font-bold uppercase tracking-widest">{t.common.fieldSafetyConsole}</span>
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
                            {t.common.signOut}
                        </button>

                        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{t.common.developerMode}</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-slate-300">V2.0.4 - {t.common.stable}</span>
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
                                aria-label={extra.menuOpen}
                                onClick={() => setIsSidebarOpen(true)}
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:bg-slate-100 md:hidden ${isSidebarOpen ? "invisible pointer-events-none" : "visible"}`}
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            {isSidebarCollapsed && (
                                <button
                                    type="button"
                                    aria-label={extra.menuOpen}
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
                                <span className="hidden sm:inline">{isSimulation ? t.common.simulationOn : t.common.simulation}</span>
                            </button>

                            <label className="sr-only" htmlFor="system-language">{extra.displayLanguage}</label>
                            <select
                                id="system-language"
                                value={lang}
                                onChange={(event) => void changeMyLanguage(event.target.value)}
                                disabled={languageSaving || !currentUser}
                                className="language-dropdown disabled:cursor-wait disabled:opacity-60"
                            >
                                {SYSTEM_LANGUAGE_OPTIONS.map((option) => (
                                    <option key={option.code} value={option.code}>{option.label}</option>
                                ))}
                            </select>

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
                            <p className="mb-2 text-[10px] font-black tracking-[.2em] text-blue-200">{t.common.systemControl}</p>
                            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                                {activeTab === 'dashboard' ? t.dashboard : activeTab === 'sites' ? t.orchestration : t.intelligence}
                            </h2>
                            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-100 sm:text-base">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>{t.common.monitoring(displaySites.length, totalWorkers)}</span>
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
                                        {t.common.simulationNotice}
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
                                sub: t.common.active,
                            },
                            {
                                label: t.stats.workers,
                                value: (loading && !isSimulation) ? "—" : totalWorkers.toLocaleString(),
                                icon: Users,
                                color: "emerald",
                                sub: t.common.registered,
                            },
                            {
                                label: t.stats.tbms,
                                value: (loading && !isSimulation) ? "—" : totalTbmToday.toString(),
                                icon: ClipboardCheck,
                                color: "purple",
                                sub: t.common.today,
                            },
                            {
                                label: t.stats.alerts,
                                value: (loading && !isSimulation) ? "—" : totalAlerts.toString(),
                                icon: AlertTriangle,
                                color: totalAlerts > 0 ? "red" : "slate",
                                sub: totalAlerts > 0 ? t.common.unresolved : t.common.clear,
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
                                    <div className={`lg:col-span-1 rounded-[40px] border p-8 flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-sm ${displayAccidentFreeDays === 0 ? 'bg-red-50 border-red-200' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-200'}`}>
                                        <div className={`absolute inset-0 blur-[60px] rounded-full ${displayAccidentFreeDays === 0 ? 'bg-red-200/50' : 'bg-emerald-200/50'}`} />
                                        <div className="relative flex flex-col items-center gap-2">
                                            <Award className={`w-8 h-8 ${displayAccidentFreeDays === 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{t.common.accidentFreeDays}</p>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-7xl font-black tracking-tighter ${displayAccidentFreeDays === 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {(loading && !isSimulation) ? "—" : displayAccidentFreeDays ?? "—"}
                                                </span>
                                                <span className="text-2xl font-black text-slate-500 mb-2">{t.common.days}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-bold">
                                                {displayAccidentFreeDays === 0 ? t.common.alertSiteExists : t.common.stopWorkBased}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 1000일 카운트다운 + TBM 이행률 */}
                                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* 1000일 카운트다운 */}
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-indigo-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.common.goal}</p>
                                            </div>
                                            {(loading && !isSimulation) || daysTo1000 === null ? (
                                                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                                            ) : daysTo1000 === 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-3xl font-black text-amber-400">{t.common.achieved}</span>
                                                    <span className="text-xs text-slate-500 font-bold">{t.common.goalAchieved}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-3xl font-black text-indigo-400">{daysTo1000.toLocaleString()}</span>
                                                        <span className="text-sm font-black text-slate-500 mb-1">{t.common.daysRemaining}</span>
                                                    </div>
                                                    {/* 진행 바 */}
                                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-1000"
                                                            style={{ width: `${Math.min(100, ((displayAccidentFreeDays ?? 0) / 1000) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-bold">{((displayAccidentFreeDays ?? 0) / 10).toFixed(1)}% {t.common.progress}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* TBM 이행률 */}
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <ClipboardCheck className="w-5 h-5 text-purple-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.common.tbmCompliance}</p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-end gap-2">
                                                    <span className={`text-3xl font-black ${tbmCoverageRate >= 80 ? 'text-emerald-400' : tbmCoverageRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                        {loading ? "—" : `${tbmCoverageRate}%`}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-500 mb-1">
                                                        ({sitesWithTbm}/{sites.length} {t.stats.sites})
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${tbmCoverageRate >= 80 ? 'bg-emerald-500' : tbmCoverageRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${tbmCoverageRate}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-600 font-bold">{t.common.totalTbmToday(totalTbmToday)}</p>
                                            </div>
                                        </div>

                                        {/* 인력 현황 */}
                                        <div className="sm:col-span-2 bg-slate-900/40 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-5 h-5 text-blue-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.common.personnel}</p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                {/* 스택 바 */}
                                                <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
                                                    {totalPersonnel > 0 ? (
                                                        <>
                                                            <div
                                                                className="h-full bg-blue-500 transition-all duration-1000"
                                                                style={{ width: `${(totalWorkers / totalPersonnel) * 100}%` }}
                                                                title={`${t.common.worker} ${totalWorkers}`}
                                                            />
                                                            <div
                                                                className="h-full bg-amber-500 transition-all duration-1000"
                                                                style={{ width: `${(displaySafetyOfficerCount / totalPersonnel) * 100}%` }}
                                                                title={`${t.common.safetyManager} ${displaySafetyOfficerCount}`}
                                                            />
                                                            <div
                                                                className="h-full bg-purple-500 transition-all duration-1000"
                                                                style={{ width: `${(displayHqAdminCount / totalPersonnel) * 100}%` }}
                                                                title={`${t.common.hqAdmin} ${displayHqAdminCount}`}
                                                            />
                                                        </>
                                                    ) : (
                                                        <div className="h-full w-full bg-slate-700 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                        <span className="text-xs font-bold text-slate-400">{t.common.worker} <span className="text-white">{totalWorkers}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                        <span className="text-xs font-bold text-slate-400">{t.common.safetyManager} <span className="text-white">{displaySafetyOfficerCount}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                                        <span className="text-xs font-bold text-slate-400">{t.common.hqAdmin} <span className="text-white">{displayHqAdminCount}</span></span>
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
                                            <h3 className="text-base font-black uppercase tracking-tight sm:text-lg">{t.common.workforceBySite}</h3>
                                        </div>
                                        <span className="shrink-0 text-right text-[9px] font-bold text-slate-500 uppercase tracking-widest sm:text-[10px]">{t.common.allSites(displaySites.length)}</span>
                                    </div>

                                    {(loading && !isSimulation) ? (
                                        <div className="flex flex-col gap-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : displaySites.length === 0 ? (
                                        <p className="text-slate-600 font-bold text-sm text-center py-8">{t.common.noSites}</p>
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
                                                                <span className="text-xs font-black text-white">{site.worker_count}{lang === "ko" ? "명" : lang === "zh" ? "人" : lang === "vi" ? " người" : lang === "ru" ? " чел." : " people"}</span>
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
                                                            {t.common.enter} <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* 알람 발생 현장 (있을 때만) */}
                                {totalAlerts > 0 && !loading && (
                                    <div className="rounded-[40px] border border-red-200 bg-gradient-to-br from-red-50 via-white to-amber-50 p-8 shadow-sm flex flex-col gap-6">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                                            <h3 className="text-lg font-black uppercase tracking-tight text-red-800">{t.common.alertSites}</h3>
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">{t.common.alertCount(totalAlerts)}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {displaySites.filter(s => s.alert_count > 0).map(site => (
                                                <button
                                                    key={site.id}
                                                    onClick={() => window.location.href = `/admin?site_id=${site.id}`}
                                                    className="group flex items-center justify-between rounded-2xl border border-red-200 bg-white p-4 text-left shadow-sm transition-all hover:border-red-300 hover:bg-red-50"
                                                >
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{site.name}</p>
                                                        <p className="mt-0.5 text-[10px] font-bold text-red-600">{t.common.stopWorkCount(site.alert_count)}</p>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-red-600 transition-transform group-hover:translate-x-1" />
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
                                <SystemHealthCheck lang={lang} />
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
                                            <h3 className="text-xl font-black uppercase tracking-tight">{extra.audit}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{extra.recentOnly}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchSecurityLogs}
                                        disabled={logsLoading}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                                        {extra.refresh}
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: extra.allEvents, value: securityLogs.length, color: 'blue' },
                                        { label: extra.warning, value: securityLogs.filter(l => l.severity === 'warn').length, color: 'amber' },
                                        { label: extra.critical, value: securityLogs.filter(l => l.severity === 'critical').length, color: 'red' },
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
                                        <span className="w-28 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{extra.time}</span>
                                        <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{extra.event}</span>
                                        <span className="w-28 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><LogIn className="w-3 h-3" />{extra.actor}</span>
                                        <span className="w-14 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500">{extra.level}</span>
                                    </div>
                                    <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
                                        {logsLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : securityLogs.length === 0 ? (
                                            <div className="py-12 text-center text-slate-600 font-bold text-sm">{extra.noLogs}</div>
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
                                                        {log.severity === 'critical' ? extra.critical : log.severity === 'warn' ? extra.warning : extra.info}
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
                                        <h3 className="text-xl font-black uppercase tracking-tight">{extra.settings}</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{extra.sessionOnly}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {/* 시스템 모드 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{extra.systemMode}</h4>
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
                                                    {mode === 'poc' ? extra.pilot : extra.production}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 알람 에스컬레이션 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{extra.escalation}</h4>
                                            <span className="text-sm font-black text-amber-400">{globalConfig.alertEscalationMinutes}{extra.minutes}</span>
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
                                        <p className="text-[10px] text-slate-600 font-bold">{extra.escalationDesc(globalConfig.alertEscalationMinutes)}</p>
                                    </div>

                                    {/* TBM 리마인더 + 기본 언어 */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{extra.reminder}</h4>
                                            <button
                                                onClick={() => setGlobalConfig(c => ({ ...c, tbmReminderEnabled: !c.tbmReminderEnabled }))}
                                                className="flex items-center justify-between"
                                            >
                                                <span className="text-sm font-bold text-slate-300">{globalConfig.tbmReminderEnabled ? extra.enabled : extra.disabled}</span>
                                                <div className={`w-12 h-6 rounded-full relative transition-colors ${globalConfig.tbmReminderEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalConfig.tbmReminderEnabled ? 'right-1' : 'left-1'}`} />
                                                </div>
                                            </button>
                                            <p className="text-[10px] text-slate-600 font-bold">{extra.reminderDesc}</p>
                                        </div>
                                        <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm flex flex-col gap-4">
                                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700"><Globe className="w-3.5 h-3.5 text-blue-600" />{extra.defaultLanguage}</h4>
                                            <select
                                                aria-label={extra.defaultLanguage}
                                                value={globalConfig.defaultLanguage}
                                                onChange={(event) => {
                                                    const nextLang = event.target.value as GlobalConfig['defaultLanguage'];
                                                    setGlobalConfig(c => ({ ...c, defaultLanguage: nextLang }));
                                                }}
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            >
                                                {SYSTEM_LANGUAGE_OPTIONS.map((option) => (
                                                    <option key={option.code} value={option.code}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 긴급 연락처 */}
                                    <div className="bg-slate-900/40 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{extra.emergencyContact}</h4>
                                        <input
                                            type="text"
                                            value={globalConfig.emergencyContact}
                                            onChange={e => setGlobalConfig(c => ({ ...c, emergencyContact: e.target.value }))}
                                            placeholder={extra.phonePlaceholder}
                                            className="w-full bg-black/30 border border-white/5 rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-blue-500 focus:outline-none transition-all"
                                        />
                                        <p className="text-[10px] text-slate-600 font-bold">{extra.emergencyDesc}</p>
                                    </div>

                                    {/* 유지보수 모드 */}
                                    <div className={`border rounded-[24px] p-6 flex items-center justify-between transition-all ${globalConfig.maintenanceMode ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-900/40 border-white/5'}`}>
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{extra.maintenance}</h4>
                                            <p className="text-[10px] text-slate-600 font-bold">{extra.maintenanceDesc}</p>
                                        </div>
                                        <button
                                            onClick={() => setGlobalConfig(c => ({ ...c, maintenanceMode: !c.maintenanceMode }))}
                                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                                                globalConfig.maintenanceMode
                                                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                                    : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {globalConfig.maintenanceMode ? extra.enabled : extra.disabled}
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
                                    {configSaved ? <><CheckCircle2 className="w-4 h-4" />{extra.saved}</> : <><Save className="w-4 h-4" />{extra.save}</>}
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

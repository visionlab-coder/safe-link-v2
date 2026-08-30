"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, LogOut, MapPin, Settings, UserRound } from "lucide-react";
import SiteAgentBriefing from "@/components/agents/SiteAgentBriefing";
import SystemHealthCheck from "@/components/SystemHealthCheck";
import ResponsiveFeatureHero from "@/components/ResponsiveFeatureHero";
import { logoutV3 } from "@/lib/v3-auth";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { persistDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { languages } from "@/constants";
import { getT as getAuthT } from "@/app/auth/translations";

// 관리자 문구는 선택 언어별 사전을 우선 사용하고, 누락된 화면 문구도 영어가 아닌
// 공통 20개 언어 로그인 사전으로 구성한다.
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
        profile: "내 정보",
        systemManagement: "시스템 관리",
        integratedControl: "통합 관제",
        accountMenu: "계정 메뉴",
        fieldUnit: "현장 운영",
        hero: { eyebrow: "CONTROL CENTER", title: "관리자 통합 현황", description: "위험과 미처리 업무를 한 화면에서 확인합니다.", metrics: ["출입 인원", "TBM 완료", "조치 필요"], steps: [["인원 현황", "출입·교육 상태를 집계합니다."], ["위험 확인", "미조치 항목을 우선 표시합니다."], ["보고 준비", "오늘 문서를 자동으로 정리합니다."]] },
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
        profile: "My profile",
        systemManagement: "System management",
        integratedControl: "Integrated control",
        accountMenu: "Account menu",
        fieldUnit: "Field operations",
        hero: { eyebrow: "CONTROL CENTER", title: "Integrated Admin Overview", description: "Review risks and pending work from one screen.", metrics: ["People on site", "TBM complete", "Action needed"], steps: [["Workforce status", "Summarize entry and training status."], ["Risk review", "Show unaddressed items first."], ["Prepare reports", "Organize today’s documents automatically."]] },
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
        profile: "我的资料",
        systemManagement: "系统管理",
        integratedControl: "综合管控",
        accountMenu: "账户菜单",
        fieldUnit: "现场运营",
        hero: { eyebrow: "控制中心", title: "管理员综合概览", description: "在一个页面查看风险和待处理工作。", metrics: ["现场人数", "TBM 完成", "需要处理"], steps: [["人员现状", "汇总出入与培训状态。"], ["风险确认", "优先显示未处理事项。"], ["报告准备", "自动整理今日文档。"]] },
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
        profile: "Thông tin của tôi",
        systemManagement: "Quản lý hệ thống",
        integratedControl: "Điều hành tích hợp",
        accountMenu: "Menu tài khoản",
        fieldUnit: "Vận hành công trường",
        hero: { eyebrow: "TRUNG TÂM ĐIỀU HÀNH", title: "Tổng quan quản trị", description: "Theo dõi rủi ro và công việc chưa xử lý trên một màn hình.", metrics: ["Người tại công trường", "TBM hoàn thành", "Cần xử lý"], steps: [["Tình hình nhân sự", "Tổng hợp trạng thái vào cổng và đào tạo."], ["Kiểm tra rủi ro", "Ưu tiên hiển thị các mục chưa xử lý."], ["Chuẩn bị báo cáo", "Tự động sắp xếp tài liệu hôm nay."]] },
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
    ru: {
        board: "Панель управления в реальном времени",
        boardDesc: "Контролируйте TBM и связь с работниками в реальном времени.",
        tbmTitle: "Рассылка TBM",
        tbmDesc: "Создавайте инструкции по безопасности и отправляйте их работникам на родном языке.",
        tbmBtn: "Новая рассылка",
        chatTitle: "AI-чат 1:1",
        chatDesc: "Автоматический перевод в реальном времени для общения с работниками.",
        chatBtn: "Открыть чат",
        statusTitle: "Статус подписей",
        statusDesc: "Проверяйте подтверждения TBM и юридические подписи в реальном времени.",
        glossaryTitle: "Управление словарём",
        glossaryDesc: "Управляйте терминами площадки и стандартными переводами.",
        signOut: "Выйти",
        profile: "Мой профиль",
        systemManagement: "Управление системой",
        integratedControl: "Интегрированный контроль",
        accountMenu: "Меню аккаунта",
        fieldUnit: "Работа объекта",
        hero: { eyebrow: "ЦЕНТР УПРАВЛЕНИЯ", title: "Общий обзор администратора", description: "Просматривайте риски и незавершённые задачи на одном экране.", metrics: ["На объекте", "TBM выполнено", "Требует действий"], steps: [["Статус персонала", "Сводка прохода и обучения."], ["Проверка рисков", "Сначала показываются нерешённые пункты."], ["Подготовка отчёта", "Автоматически формируются документы за сегодня."]] },
        roleLabel: { HQ_ADMIN: "Руководитель площадки", SAFETY_OFFICER: "Специалист по безопасности", WORKER: "Работник" },
        greeting: (name: string) => `Добро пожаловать, ${name}`,
    },
};
function getLocalizedAdminFallback(lang: string) {
    const auth = getAuthT(lang);
    return {
        board: auth.adminTitle,
        boardDesc: auth.adminDesc,
        tbmTitle: "TBM",
        tbmDesc: auth.adminDesc,
        tbmBtn: auth.doEnter,
        chatTitle: "AI",
        chatDesc: auth.chooseRoleDesc,
        chatBtn: auth.doEnter,
        statusTitle: auth.chooseRole,
        statusDesc: auth.chooseRoleDesc,
        glossaryTitle: auth.changeLang,
        glossaryDesc: auth.adminDesc,
        signOut: auth.back,
        profile: auth.name,
        systemManagement: auth.adminRole,
        integratedControl: auth.adminTitle,
        accountMenu: auth.adminRole,
        fieldUnit: "SQ LINK",
        authenticating: "SQ LINK",
        hero: { eyebrow: "SQ LINK", title: auth.adminTitle, description: auth.adminDesc, metrics: [auth.workerRole, "TBM", auth.adminRole], steps: [[auth.workerRole, auth.workerRoleDesc], ["TBM", auth.adminDesc], [auth.adminRole, auth.chooseRoleDesc]] },
        roleLabel: { HQ_ADMIN: auth.adminRole, SAFETY_OFFICER: auth.adminRole, WORKER: auth.workerRole },
        greeting: (name: string) => `${name}`,
    };
}

const getUI = (lang: string) => {
    const fallback = getLocalizedAdminFallback(lang);
    const current = adminUI[lang];
    if (!current) return fallback;
    return {
        ...fallback,
        ...current,
        hero: current.hero ?? fallback.hero,
        roleLabel: { ...fallback.roleLabel, ...(current.roleLabel ?? {}) },
    };
};

const adminFeatureUI: Record<string, Record<string, string>> = {
    ko: { termsAction: "용어 관리", aiTitle: "AI 엔진 · 키 설정", aiDesc: "통번역 엔진(Google·Papago)과 API 키를 재배포 없이 즉시 교체·테스트합니다.", aiAction: "엔진 전환", liveTitle: "실시간 통역", liveDesc: "실시간 동시통역. 말하면 근로자 폰에서 자동 번역 재생.", liveAction: "방송 시작", quizTitle: "안전 퀴즈", quizDesc: "실시간 안전 퀴즈. 근로자 이해도를 즉시 확인.", quizAction: "퀴즈 만들기", accessTitle: "출입 관리", accessDesc: "SQ Link 출입카드와 대체 확인 코드를 발급합니다.", accessAction: "출입 관리 열기", incentiveTitle: "안전 인센티브", incentiveDesc: "퀴즈 우수자에게 안전장비를 지급하고 성과를 기록합니다.", incentiveAction: "지급 관리", nfcTitle: "NFC 근로자 관리", nfcDesc: "NFC 스티커 등록·발급 및 TBM 참석 현황을 관리합니다.", nfcAction: "NFC 관리", guideTitle: "기능 사용 가이드", guideDesc: "NFC 근로자 관리·인센티브·ESG 리포트 단계별 안내. 처음 담당하는 직원도 바로 시작 가능.", guideAction: "가이드 열기", esgTitle: "ESG 안전 리포트", esgDesc: "TBM 인증율·서약·감사체인 기반 ESG 종합 점수를 산출합니다.", esgAction: "리포트 보기", statusAction: "현황 보기" },
    en: { termsAction: "Manage terms", aiTitle: "AI Engine & Key Settings", aiDesc: "Switch and test translation engines and API keys without redeploying.", aiAction: "Switch engine", liveTitle: "Live Interpreter", liveDesc: "Real-time interpretation. Speak and workers hear it translated.", liveAction: "Start broadcast", quizTitle: "Safety Quiz", quizDesc: "Live safety quiz. Check worker comprehension instantly.", quizAction: "Create quiz", accessTitle: "Access Center", accessDesc: "Issue SQ Link access cards and fallback codes.", accessAction: "Open access center", incentiveTitle: "Safety Incentive", incentiveDesc: "Grant safety equipment to top quiz performers and track results.", incentiveAction: "Manage grants", nfcTitle: "NFC Worker Management", nfcDesc: "Register NFC stickers and manage TBM attendance records.", nfcAction: "Manage NFC", guideTitle: "Feature Guide", guideDesc: "Step-by-step guidance for NFC, incentives, and ESG reporting.", guideAction: "Open guide", esgTitle: "ESG Safety Report", esgDesc: "Calculate an ESG score from TBM certification, pledges, and audit records.", esgAction: "View report", statusAction: "View status" },
    zh: { termsAction: "管理术语", aiTitle: "AI 引擎与密钥设置", aiDesc: "无需重新部署即可更换和测试翻译引擎及 API 密钥。", aiAction: "切换引擎", liveTitle: "实时口译", liveDesc: "实时同声传译。发言后自动翻译播放。", liveAction: "开始广播", quizTitle: "安全测验", quizDesc: "实时安全测验。即时确认工人理解度。", quizAction: "创建测验", accessTitle: "出入管理中心", accessDesc: "发放 SQ Link 出入卡和备用确认代码。", accessAction: "打开出入管理", incentiveTitle: "安全激励", incentiveDesc: "向测验优秀者发放安全装备并记录成果。", incentiveAction: "管理发放", nfcTitle: "NFC 工人管理", nfcDesc: "管理 NFC 贴纸登记、发放及 TBM 出勤情况。", nfcAction: "管理 NFC", guideTitle: "功能使用指南", guideDesc: "NFC、激励和 ESG 报告的分步指南。", guideAction: "打开指南", esgTitle: "ESG 安全报告", esgDesc: "基于 TBM 认证、承诺书和审计记录计算 ESG 综合评分。", esgAction: "查看报告", statusAction: "查看状态" },
    vi: { termsAction: "Quản lý thuật ngữ", aiTitle: "Cài đặt AI & khóa", aiDesc: "Thay đổi và kiểm tra công cụ dịch cùng khóa API mà không cần triển khai lại.", aiAction: "Đổi công cụ", liveTitle: "Phiên dịch trực tiếp", liveDesc: "Phiên dịch thời gian thực. Công nhân nghe bản dịch tự động.", liveAction: "Bắt đầu phát", quizTitle: "Câu đố an toàn", quizDesc: "Câu đố an toàn trực tiếp để kiểm tra mức độ hiểu của công nhân.", quizAction: "Tạo câu đố", accessTitle: "Trung tâm ra vào", accessDesc: "Cấp thẻ ra vào SQ Link và mã xác nhận dự phòng.", accessAction: "Mở quản lý ra vào", incentiveTitle: "Khuyến khích an toàn", incentiveDesc: "Cấp thiết bị an toàn cho người đạt kết quả tốt và lưu thành tích.", incentiveAction: "Quản lý cấp phát", nfcTitle: "Quản lý công nhân NFC", nfcDesc: "Đăng ký NFC, cấp thẻ và quản lý tình hình tham gia TBM.", nfcAction: "Quản lý NFC", guideTitle: "Hướng dẫn sử dụng", guideDesc: "Hướng dẫn từng bước về NFC, khuyến khích và báo cáo ESG.", guideAction: "Mở hướng dẫn", esgTitle: "Báo cáo an toàn ESG", esgDesc: "Tính điểm ESG từ xác nhận TBM, cam kết và hồ sơ kiểm toán.", esgAction: "Xem báo cáo", statusAction: "Xem trạng thái" },
    ru: { termsAction: "Управление терминами", aiTitle: "Настройки AI и ключей", aiDesc: "Меняйте и тестируйте движки перевода и API-ключи без повторного развёртывания.", aiAction: "Сменить движок", liveTitle: "Онлайн-перевод", liveDesc: "Синхронный перевод в реальном времени для работников.", liveAction: "Начать трансляцию", quizTitle: "Тест по безопасности", quizDesc: "Проверяйте понимание требований безопасности работниками в реальном времени.", quizAction: "Создать тест", accessTitle: "Центр доступа", accessDesc: "Выдавайте карты доступа SQ Link и резервные коды.", accessAction: "Открыть доступ", incentiveTitle: "Поощрения за безопасность", incentiveDesc: "Выдавайте средства защиты лучшим участникам тестов и фиксируйте результаты.", incentiveAction: "Управление выдачей", nfcTitle: "Управление NFC-работниками", nfcDesc: "Регистрируйте NFC-метки и управляйте посещением TBM.", nfcAction: "Управление NFC", guideTitle: "Руководство", guideDesc: "Пошаговое руководство по NFC, поощрениям и ESG-отчётам.", guideAction: "Открыть руководство", esgTitle: "Отчёт ESG по безопасности", esgDesc: "Рассчитывайте оценку ESG по TBM, обязательствам и журналам аудита.", esgAction: "Открыть отчёт", statusAction: "Открыть статус" },
};
function getFeatureUI(lang: string) {
    const auth = getAuthT(lang);
    const fallback = {
        termsAction: auth.doEnter, aiTitle: "AI", aiDesc: auth.adminDesc, aiAction: auth.doEnter,
        liveTitle: auth.workerRole, liveDesc: auth.workerRoleDesc, liveAction: auth.doEnter,
        quizTitle: auth.chooseRole, quizDesc: auth.chooseRoleDesc, quizAction: auth.doEnter,
        accessTitle: "QR / NFC", accessDesc: auth.workerRoleDesc, accessAction: auth.doEnter,
        incentiveTitle: auth.adminRole, incentiveDesc: auth.adminDesc, incentiveAction: auth.doEnter,
        nfcTitle: "NFC", nfcDesc: auth.workerRoleDesc, nfcAction: auth.doEnter,
        guideTitle: auth.changeLang, guideDesc: auth.chooseRoleDesc, guideAction: auth.doEnter,
        esgTitle: "ESG", esgDesc: auth.adminDesc, esgAction: auth.doEnter, statusAction: auth.doEnter,
    };
    return { ...fallback, ...(adminFeatureUI[lang] ?? {}) };
}

const ADMIN_ESG_CLAIM_NUMBER = 24;
const ADMIN_LANGUAGE_OPTIONS = languages.map((language) => ({ code: language.code, label: language.name }));

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
    const [selectedLang, setSelectedLang] = useState<string | null>(null);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

    // URL 파라미터로 명시적으로 전달된 언어가 있는지 확인 (override)
    const urlLang = searchParams.get("lang");

    useEffect(() => {
        setSelectedLang(localStorage.getItem("safe-link-lang"));
    }, []);

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
            window.alert(getAuthT(selectedLang || "ko").adminDesc);
        }
    };

    const handleLanguageChange = (nextLang: string) => {
        persistDisplayLanguage(nextLang);
        setSelectedLang(nextLang);
        const params = new URLSearchParams(searchParams.toString());
        params.set("lang", nextLang);
        router.replace(`/admin?${params.toString()}`);
    };

    const requestedLang = urlLang || selectedLang || currentUser?.prefLang || "ko";
    const lang = ADMIN_LANGUAGE_OPTIONS.some((option) => option.code === requestedLang) ? requestedLang : "ko";
    const t = getUI(lang);
    const feature = getFeatureUI(lang);
    const roleDisplay = currentUser ? ((t.roleLabel as any)[currentUser.role] || currentUser.role) : "Admin";
    const siteId = searchParams.get("site_id");
    const siteName = null;

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-[#eef3f8] text-white flex flex-col pb-12 font-sans selection:bg-blue-500/30">

                <header className="relative z-[70] w-full border-b border-slate-200 bg-white shadow-sm">
                    <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-8">
                        <div className="flex shrink-0 items-center gap-3">
                            <Image
                                src="/brand/seowon-logo-compact-transparent.png"
                                alt="SEOWON Since 1991"
                                width={208}
                                height={60}
                                priority
                                unoptimized
                                className="h-auto w-[112px] object-contain sm:w-[132px]"
                            />
                            <div className="hidden h-8 w-px bg-slate-200 lg:block" />
                            <span className="hidden whitespace-nowrap text-sm font-black tracking-tight text-[#063789] lg:block">SQ LINK</span>
                        </div>

                        <div className="order-3 col-span-2 flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-3 lg:order-none lg:col-span-1 lg:border-0 lg:pt-0">
                            <p className="min-w-0 truncate text-xs font-bold text-slate-600 sm:text-sm">
                                {currentUser ? t.greeting(currentUser.name) : t.authenticating}
                                {currentUser?.title && <span className="ml-1 text-slate-400">[{currentUser.title}]</span>}
                            </p>
                            <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[8px] font-black tracking-widest text-blue-600">{t.fieldUnit}</span>
                            </div>
                            {siteName && (
                                <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                                    <MapPin className="h-2.5 w-2.5 text-amber-600" />
                                    <span className="text-[8px] font-black tracking-widest text-amber-600">{siteName}</span>
                                </div>
                            )}
                        </div>

                        <div className="order-2 flex shrink-0 items-center gap-1 sm:gap-2">
                            <label className="sr-only" htmlFor="admin-language">{t.changeLang}</label>
                            <div className="relative">
                                <select
                                    id="admin-language"
                                    aria-label={t.changeLang}
                                    value={lang}
                                    onChange={(event) => handleLanguageChange(event.target.value)}
                                    className="language-dropdown admin-language-select pr-8"
                                >
                                    {ADMIN_LANGUAGE_OPTIONS.map((option) => (
                                        <option key={option.code} value={option.code}>{option.label}</option>
                                    ))}
                                </select>
                                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                            </div>
                            <div className={`hidden whitespace-nowrap rounded-full px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest sm:block ${currentUser?.role === 'HQ_ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {roleDisplay}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    aria-label={t.accountMenu}
                                    aria-expanded={isAccountMenuOpen}
                                    onClick={() => setIsAccountMenuOpen((open) => !open)}
                                    className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    <UserRound className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{currentUser?.name || t.profile}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
                                </button>
                                {isAccountMenuOpen && (
                                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(16,42,67,.16)]">
                                        <button onClick={() => router.push('/auth/setup')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700">
                                            <UserRound className="h-4 w-4" />{t.profile}
                                        </button>
                                        {(currentUser?.role === 'ROOT' || currentUser?.role === 'HQ_OFFICER') && (
                                            <button onClick={() => router.push('/system')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700">
                                                <Settings className="h-4 w-4" />{t.systemManagement}
                                            </button>
                                        )}
                                        {currentUser?.role === 'HQ_ADMIN' && (
                                            <button onClick={() => router.push('/control')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700">
                                                <Settings className="h-4 w-4" />{t.integratedControl}
                                            </button>
                                        )}
                                        <div className="my-1 border-t border-slate-100" />
                                        <button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-red-600 transition-colors hover:bg-red-50">
                                            <LogOut className="h-4 w-4" />{t.signOut}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="w-full">
                    <ResponsiveFeatureHero visual={{
                        image: "dashboard",
                        eyebrow: t.hero.eyebrow,
                        title: t.hero.title,
                        description: t.hero.description,
                        metrics: [{ label: t.hero.metrics[0], value: "286" }, { label: t.hero.metrics[1], value: "94%" }, { label: t.hero.metrics[2], value: "7" }],
                        steps: t.hero.steps.map(([title, description]: [string, string]) => ({ title, description })),
                    }} />
                </div>

                {/* 🚨 Pre-flight Health Check (Critical for Monday Demo) */}
                <div className="mx-4 mt-8 sm:mx-8">
                    <SystemHealthCheck lang={lang} />
                </div>

                {/* 🤖 Tier 2: Site Agent Briefing (Role-specific) */}
                {currentUser && (
                    <div className="mx-4 mt-8 sm:mx-8">
                            <SiteAgentBriefing
                                role={currentUser.role}
                                siteId={siteId}
                                lang={lang}
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
                                <span>{feature.statusAction}</span>
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
                                <span>{feature.termsAction}</span>
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
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{feature.aiTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.aiDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-emerald-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.aiAction}</span>
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
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{feature.liveTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.liveDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-indigo-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.liveAction}</span>
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
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{feature.quizTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.quizDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-pink-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.quizAction}</span>
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
                            <h3 className="text-3xl font-black text-[#172033] uppercase italic">{feature.accessTitle}</h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.accessDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-purple-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.accessAction}</span>
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
                                {feature.incentiveTitle}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.incentiveDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-orange-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.incentiveAction}</span>
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
                                {feature.nfcTitle}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.nfcDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-cyan-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.nfcAction}</span>
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
                                {feature.guideTitle}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.guideDesc}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-blue-300 font-black tracking-widest text-sm uppercase">
                                <span>{feature.guideAction}</span>
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
                                {feature.esgTitle}
                            </h3>
                            <p className="text-slate-400 font-bold text-lg leading-relaxed flex-grow">
                                {feature.esgDesc}
                            </p>
                            <div className="flex items-center gap-2 mt-4">
                                <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-black">{ADMIN_ESG_CLAIM_NUMBER}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-emerald-400 font-black tracking-widest text-sm uppercase">
                                <span>{feature.esgAction}</span>
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
                <p className="mt-2 text-xs font-bold tracking-widest text-slate-500">SQ LINK FIELD CONSOLE</p>
            </div>
        }>
            <AdminDashboardContent />
        </Suspense>
    );
}

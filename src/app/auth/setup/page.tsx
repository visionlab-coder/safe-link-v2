"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { languages } from "@/constants";
import {
  getDefaultRouteForProfileRole,
  getProfileRoleFromSetupRole,
  type ProfileRole,
  type SetupRoleKey,
} from "@/lib/roles";
import { getV3CurrentUser, setupProfileV3 } from "@/lib/v3-auth";
import type { V3Role } from "@/lib/v3-role-contract";

type RoleKey = SetupRoleKey | "";
type ColorKey = "blue" | "amber" | "green" | "purple" | "indigo";
type Step = 1 | 2 | 3;
type SiteOption = { id: string; name: string; site_code?: string | null };

const T: Record<string, Record<string, string>> = {
  ko: {
    pgTitle: "기본 정보 등록", editTitle: "프로필 설정",
    step1Title: "역할 & 기본정보", step2Title: "현장 정보", step3Title: "자동 로그인",
    step1Desc: "이름과 현장 역할을 선택해주세요.", step2Desc: "투입될 현장과 공종을 입력해주세요.",
    step3Desc: "자동 로그인 설정 후 시작합니다.",
    nameTitle: "이름 (Full Name)", langTitle: "모국어 (Native Language)",
    tradeTitle: "투입 공종 (예: 형틀, 철근)", posTitle: "직책 (예: 대리, 과장)",
    siteTitle: "현장 코드 또는 현장명", roleTitle: "현장 역할",
    site_manager: "현장 소장", site_manager_desc: "TBM 작성 및 전파, 근로자 관리 (1명만)",
    safety_officer: "안전관리자", safety_officer_desc: "현장 안전 점검 및 TBM 모니터링",
    gongmu: "공무 담당", gongmu_desc: "현장 계약·기성·서류 관리",
    worker: "현장 근로자", worker_desc: "TBM 수신 및 서명, 관리자와 실시간 소통",
    hq_officer: "본사 안전관리실", hq_officer_desc: "본사 전역 통합 관제 및 전 현장 모니터링",
    save: "완료하고 시작하기",
    err: "모든 정보를 정확하게 입력해주세요!",
    adminLimit: "현장 소장은 이미 등록되어 있습니다. 다른 역할을 선택해 주세요.",
    alreadySet: "이미 등록됨",
    next: "다음 →", prev: "← 이전",
    rememberMe: "이 기기에서 자동 로그인",
    rememberDesc: "다음부터 앱 실행 시 자동으로 로그인됩니다",
    completeTitle: "등록 완료!", completeDesc: "이제 SAFE-LINK를 사용할 준비가 되었습니다.",
    startBtn: "SAFE-LINK 시작하기",
  },
  en: {
    pgTitle: "Profile Setup", editTitle: "Profile Settings",
    step1Title: "Role & Basic Info", step2Title: "Site Information", step3Title: "Auto-Login",
    step1Desc: "Enter your name and select your site role.", step2Desc: "Enter your site and work type.",
    step3Desc: "Configure auto-login, then start.",
    nameTitle: "Full Name", langTitle: "Native Language",
    tradeTitle: "Trade (e.g., Carpentry, Rebar)", posTitle: "Position (e.g., Lead, Officer)",
    siteTitle: "Site Code or Name", roleTitle: "Site Role",
    site_manager: "Site Manager", site_manager_desc: "Write & broadcast TBM, manage workers (1 only)",
    safety_officer: "Safety Officer", safety_officer_desc: "Safety inspection & TBM monitoring",
    gongmu: "Construction Admin", gongmu_desc: "Contract, billing & document management",
    worker: "Field Worker", worker_desc: "Receive TBM, sign, and communicate with management",
    hq_officer: "HQ Safety Office", hq_officer_desc: "Global HQ control and monitoring",
    save: "Complete & Start",
    err: "Please fill in all fields correctly!",
    adminLimit: "A Site Manager is already registered. Please choose another role.",
    alreadySet: "Already registered",
    next: "Next →", prev: "← Back",
    rememberMe: "Auto-login on this device",
    rememberDesc: "Will log in automatically next time you open the app",
    completeTitle: "Setup Complete!", completeDesc: "You are ready to use SAFE-LINK.",
    startBtn: "Start SAFE-LINK",
  },
  vi: {
    pgTitle: "Đăng ký thông tin", editTitle: "Cài đặt hồ sơ",
    step1Title: "Vai trò & Thông tin cơ bản", step2Title: "Thông tin công trường", step3Title: "Đăng nhập tự động",
    step1Desc: "Nhập tên và chọn vai trò của bạn.", step2Desc: "Nhập thông tin công trường và loại công việc.",
    step3Desc: "Cài đặt đăng nhập tự động, sau đó bắt đầu.",
    nameTitle: "Họ và tên", langTitle: "Ngôn ngữ gốc",
    tradeTitle: "Loại công việc (VD: Cốp pha, Cốt thép)", posTitle: "Chức vụ",
    siteTitle: "Mã hoặc tên công trường", roleTitle: "Vai trò",
    site_manager: "Quản lý công trường", site_manager_desc: "Viết & phát TBM, quản lý công nhân (chỉ 1 người)",
    safety_officer: "Cán bộ an toàn", safety_officer_desc: "Kiểm tra an toàn & theo dõi TBM",
    gongmu: "Hành chính công trình", gongmu_desc: "Quản lý hợp đồng, nghiệm thu và tài liệu",
    worker: "Công nhân", worker_desc: "Nhận TBM, ký và giao tiếp với quản lý",
    hq_officer: "Văn phòng HQ", hq_officer_desc: "Kiểm soát HQ toàn cầu",
    save: "Hoàn tất & Bắt đầu",
    err: "Vui lòng điền đầy đủ thông tin!",
    adminLimit: "Quản lý đã được đăng ký. Chọn vai trò khác.",
    alreadySet: "Đã đăng ký",
    next: "Tiếp theo →", prev: "← Quay lại",
    rememberMe: "Tự động đăng nhập trên thiết bị này",
    rememberDesc: "Lần sau sẽ tự động đăng nhập khi mở ứng dụng",
    completeTitle: "Hoàn thành!", completeDesc: "Bạn đã sẵn sàng sử dụng SAFE-LINK.",
    startBtn: "Bắt đầu SAFE-LINK",
  },
  zh: {
    pgTitle: "注册基本信息", editTitle: "个人资料设置",
    step1Title: "角色与基本信息", step2Title: "工地信息", step3Title: "自动登录",
    step1Desc: "请输入您的姓名并选择角色。", step2Desc: "请输入工地和工种信息。",
    step3Desc: "配置自动登录，然后开始。",
    nameTitle: "姓名", langTitle: "母语",
    tradeTitle: "工种（例：模板、钢筋）", posTitle: "职位",
    siteTitle: "工地代码或名称", roleTitle: "现场角色",
    site_manager: "现场主管", site_manager_desc: "编写/发送TBM，管理工人（仅限1人）",
    safety_officer: "安全管理员", safety_officer_desc: "现场安全检查及TBM监控",
    gongmu: "工务管理", gongmu_desc: "合同、进度款及文件管理",
    worker: "现场工人", worker_desc: "接收TBM，签名并实时沟通",
    hq_officer: "总部安全管理室", hq_officer_desc: "总部全域综合管控",
    save: "完成并开始",
    err: "请填写所有字段！",
    adminLimit: "现场主管已有人注册。请选择其他角色。",
    alreadySet: "已注册",
    next: "下一步 →", prev: "← 返回",
    rememberMe: "在此设备上自动登录",
    rememberDesc: "下次打开应用时将自动登录",
    completeTitle: "注册完成！", completeDesc: "您已准备好使用SAFE-LINK。",
    startBtn: "开始使用SAFE-LINK",
  },
  th: {
    pgTitle: "ลงทะเบียนข้อมูล", editTitle: "ตั้งค่าโปรไฟล์",
    step1Title: "บทบาทและข้อมูลพื้นฐาน", step2Title: "ข้อมูลไซต์งาน", step3Title: "เข้าสู่ระบบอัตโนมัติ",
    step1Desc: "กรอกชื่อและเลือกบทบาทของคุณ", step2Desc: "กรอกข้อมูลไซต์และประเภทงาน",
    step3Desc: "ตั้งค่าเข้าสู่ระบบอัตโนมัติแล้วเริ่มต้น",
    nameTitle: "ชื่อ-นามสกุล", langTitle: "ภาษาหลัก",
    tradeTitle: "ประเภทงาน (เช่น ช่างไม้ เหล็ก)", posTitle: "ตำแหน่ง",
    siteTitle: "รหัสหรือชื่อไซต์งาน", roleTitle: "บทบาท",
    site_manager: "ผู้จัดการไซต์", site_manager_desc: "เขียน/กระจาย TBM (1 คนเท่านั้น)",
    safety_officer: "เจ้าหน้าที่ความปลอดภัย", safety_officer_desc: "ตรวจสอบความปลอดภัย",
    gongmu: "ผู้ดูแลงานก่อสร้าง", gongmu_desc: "จัดการสัญญา งวดงาน และเอกสาร",
    worker: "คนงาน", worker_desc: "รับ TBM ลงนาม สื่อสาร",
    hq_officer: "สำนักงานใหญ่", hq_officer_desc: "ควบคุมและตรวจสอบทั่วโลก",
    save: "เสร็จสิ้นและเริ่ม",
    err: "กรุณากรอกข้อมูลให้ครบ!",
    adminLimit: "มีผู้จัดการไซต์แล้ว กรุณาเลือกบทบาทอื่น",
    alreadySet: "ลงทะเบียนแล้ว",
    next: "ถัดไป →", prev: "← ย้อนกลับ",
    rememberMe: "เข้าสู่ระบบอัตโนมัติ",
    rememberDesc: "ครั้งถัดไปจะเข้าสู่ระบบโดยอัตโนมัติ",
    completeTitle: "ลงทะเบียนเสร็จสิ้น!", completeDesc: "คุณพร้อมใช้งาน SAFE-LINK แล้ว",
    startBtn: "เริ่มใช้งาน SAFE-LINK",
  },
};
const getT = (lang: string) => T[lang] || T.en;

const TRADES: { ko: string; label: Record<string, string> }[] = [
  { ko: "형틀목공", label: { ko:"형틀목공", en:"Formwork", vi:"Cốp pha", zh:"模板工", th:"ช่างแบบ", uz:"Qolip ustasi", tl:"Formwork", km:"ជ័រជ", id:"Bekisting", mn:"Хэвлэгч", my:"ကြမ်းငွေ့", ne:"ढाँचा", bn:"ফর্মওয়ার্ক", kk:"Қалып", ru:"Опалубщик", ja:"型枠大工", fr:"Coffrage", es:"Encofrado", ar:"قوالب", hi:"फॉर्मवर्क" }},
  { ko: "철근", label: { ko:"철근", en:"Rebar", vi:"Cốt thép", zh:"钢筋", th:"เหล็กเส้น", uz:"Armatura", tl:"Rebar", km:"ដែក", id:"Besi Beton", mn:"Арматур", my:"သံချောင်း", ne:"छड", bn:"রড", kk:"Арматура", ru:"Арматурщик", ja:"鉄筋", fr:"Ferrailleur", es:"Ferralla", ar:"حديد", hi:"सरिया" }},
  { ko: "콘크리트", label: { ko:"콘크리트", en:"Concrete", vi:"Bê tông", zh:"混凝土", th:"คอนกรีต", uz:"Beton", tl:"Kongkreto", km:"បេតុង", id:"Beton", mn:"Бетон", my:"ကွန်ကရစ်", ne:"कंक्रिट", bn:"কংক্রিট", kk:"Бетон", ru:"Бетонщик", ja:"コンクリート", fr:"Béton", es:"Hormigón", ar:"خرسانة", hi:"कंक्रीट" }},
  { ko: "비계", label: { ko:"비계", en:"Scaffolding", vi:"Giàn giáo", zh:"脚手架", th:"นั่งร้าน", uz:"Iskana", tl:"Scaffolding", km:"ជន្រោង", id:"Perancah", mn:"Тулгуур", my:"တိုင်ကူး", ne:"मचान", bn:"ভারাম", kk:"Леса", ru:"Леса", ja:"足場", fr:"Échafaudage", es:"Andamio", ar:"سقالة", hi:"मचान" }},
  { ko: "용접", label: { ko:"용접", en:"Welding", vi:"Hàn", zh:"焊接", th:"เชื่อม", uz:"Payvandlash", tl:"Welding", km:"ហ្វូ", id:"Las", mn:"Гагнуур", my:"ဂဟေဆော်", ne:"वेल्डिङ", bn:"ওয়েল্ডিং", kk:"Дәнекерлеу", ru:"Сварщик", ja:"溶接", fr:"Soudure", es:"Soldadura", ar:"لحام", hi:"वेल्डिंग" }},
  { ko: "전기", label: { ko:"전기", en:"Electrical", vi:"Điện", zh:"电气", th:"ไฟฟ้า", uz:"Elektr", tl:"Kuryente", km:"អគ្គិសនី", id:"Listrik", mn:"Цахилгаан", my:"လျှပ်စစ်", ne:"विद्युत", bn:"বৈদ্যুতিক", kk:"Электр", ru:"Электрик", ja:"電気", fr:"Électricité", es:"Eléctrico", ar:"كهرباء", hi:"बिजली" }},
  { ko: "설비", label: { ko:"설비", en:"Mechanical", vi:"Cơ điện", zh:"机电", th:"งานระบบ", uz:"Jihozlar", tl:"Mekaniko", km:"ប្រព័ន្ធ", id:"Mekanikal", mn:"Сантехник", my:"စက်ပစ္စည်း", ne:"मेकानिकल", bn:"মেকানিক্যাল", kk:"Жабдық", ru:"Слесарь", ja:"設備", fr:"Équipement", es:"Instalaciones", ar:"أنظمة", hi:"मैकेनिकल" }},
];

const V3_ROLE_PRIORITY: V3Role[] = ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER", "WORKER", "VIEWER"];

function pickDefaultV3Role(roles: V3Role[]): V3Role | null {
  return V3_ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}

function isSetupRoleKey(value: string | null): value is SetupRoleKey {
  return value === "site_manager" ||
    value === "safety_officer" ||
    value === "team_leader" ||
    value === "gongmu" ||
    value === "worker" ||
    value === "root" ||
    value === "hq_officer";
}

function getInitialSetupRole(value: string | null): RoleKey {
  if (value === "admin") return "safety_officer";
  return isSetupRoleKey(value) ? value : "worker";
}

function BgOrbs() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes setupOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(35px,-25px) scale(1.07)}}
        @keyframes setupOrb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-28px,32px) scale(0.94)}}
        @keyframes setupOrb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,24px) scale(1.04)}}
      `}} />
      <div style={{
        position:"absolute",width:500,height:500,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 68%)",
        top:"-15%",left:"-5%",pointerEvents:"none",
        animation:"setupOrb1 11s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:360,height:360,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 68%)",
        bottom:"-5%",right:"-5%",pointerEvents:"none",
        animation:"setupOrb2 13s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:240,height:240,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 68%)",
        top:"45%",right:"12%",pointerEvents:"none",
        animation:"setupOrb3 8s ease-in-out infinite",
      }} />
    </>
  );
}

const glassCard: React.CSSProperties = {
  background:"rgba(12,13,22,0.88)",
  border:"1px solid rgba(255,255,255,0.07)",
  backdropFilter:"blur(24px)",
  WebkitBackdropFilter:"blur(24px)",
  borderRadius:20,
};
const accentLine: React.CSSProperties = {
  height:1,
  background:"linear-gradient(90deg,transparent,rgba(59,130,246,0.45),transparent)",
};
const fieldBox: React.CSSProperties = {
  background:"rgba(255,255,255,0.04)",
  border:"1px solid rgba(255,255,255,0.08)",
  borderRadius:10,
};

function StepIndicator({ step, t }: { step: Step; t: Record<string, string> }) {
  const steps = [
    { num: 1 as Step, label: t.step1Title },
    { num: 2 as Step, label: t.step2Title },
    { num: 3 as Step, label: t.step3Title },
  ];
  return (
    <div className="mb-6 flex items-center gap-0">
      {steps.map((s, idx) => (
        <div key={s.num} className={`flex items-center ${idx < 2 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex flex-shrink-0 items-center justify-center text-xs font-black transition-all duration-300"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: step > s.num ? "#10B981" : step === s.num ? "#3B82F6" : "rgba(255,255,255,0.05)",
                border: `1px solid ${step > s.num ? "#10B981" : step === s.num ? "#3B82F6" : "rgba(255,255,255,0.1)"}`,
                color: step >= s.num ? "#fff" : "#475569",
                boxShadow: step === s.num ? "0 0 14px rgba(59,130,246,0.45)" : "none",
              }}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className="max-w-[60px] truncate text-center text-[8px] font-bold leading-tight transition-colors"
              style={{ color: step === s.num ? "#93C5FD" : step > s.num ? "#10B981" : "#334155" }}
            >
              {s.label}
            </span>
          </div>
          {idx < 2 && (
            <div
              className="mb-3.5 mx-1.5 h-px flex-1 transition-all duration-300"
              style={{ background: step > s.num ? "#10B981" : "rgba(255,255,255,0.06)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlLang = searchParams.get("lang") || "ko";
  const t = getT(urlLang);
  const initSiteId = searchParams.get("site_id") || "";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleKey>(getInitialSetupRole(searchParams.get("role")));
  const [language, setLanguage] = useState(urlLang);
  const [name, setName] = useState("");
  const [romanizing, setRomanizing] = useState(false);
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [title, setTitle] = useState("");
  const [siteCode, setSiteCode] = useState(initSiteId);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteList, setSiteList] = useState<SiteOption[]>([]);
  const [adminExists] = useState(false);
  const [isEditMode] = useState(false);
  const [isMasterEmail, setIsMasterEmail] = useState(false);
  const [isHQAuthorized, setIsHQAuthorized] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const init = async () => {
      const user = await getV3CurrentUser().catch(() => null);
      if (!user) {
        router.push("/auth");
        return;
      }

      if (user.displayName) setName((current) => current || user.displayName);
      const hasRoot = user.roles.includes("ROOT");
      const hasHq = user.roles.includes("HQ_ADMIN");
      setIsMasterEmail(hasRoot);
      setIsHQAuthorized(hasHq);

      if (hasRoot) setRole("root");
      else if (hasHq) setRole("hq_officer");
      else setRole(getInitialSetupRole(searchParams.get("role")));
    };
    init();
  }, [router, searchParams]);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetch("/api/sites/options", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { sites?: SiteOption[] };
        if (Array.isArray(data.sites)) setSiteList(data.sites);
      } catch {
        setSiteList([]);
      }
    };
    loadSites();
  }, []);

  const isNonLatin = useCallback((value: string) =>
    !/^[a-zA-Z\s\-'.]+$/.test(value.trim()) && !/\(.+\)/.test(value.trim()), []);

  const fetchRomanized = useCallback(async (value: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/romanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim(), lang: language }),
      });
      const data = await res.json() as { romanized: string | null };
      return data.romanized && data.romanized !== value.trim() ? data.romanized : null;
    } catch {
      return null;
    }
  }, [language]);

  const handleNameBlur = async () => {
    const trimmed = name.trim();
    if (!trimmed || !isNonLatin(trimmed)) return;
    setRomanizing(true);
    try {
      const romanized = await fetchRomanized(trimmed);
      if (romanized) setName(`${trimmed} (${romanized})`);
    } finally {
      setRomanizing(false);
    }
  };

  const isAdminSiteRole = role === "site_manager" || role === "safety_officer" || role === "gongmu";
  const canProceedStep1 = () => Boolean(name.trim() && role);
  const canProceedStep2 = () => {
    if (role === "worker" && (!trade || !siteCode)) return false;
    if (isAdminSiteRole) {
      if (!title) return false;
      return siteList.length > 0 ? Boolean(selectedSiteId) : Boolean(siteCode);
    }
    if ((role === "root" || role === "hq_officer") && !title) return false;
    return true;
  };

  const handleSave = useCallback(async () => {
    if (!role || !name.trim()) {
      alert(t.err);
      return;
    }

    let finalName = name.trim();
    if (isNonLatin(finalName)) {
      setRomanizing(true);
      const romanized = await fetchRomanized(finalName);
      setRomanizing(false);
      if (romanized) {
        finalName = `${finalName} (${romanized})`;
        setName(finalName);
      }
    }

    if ((isMasterEmail || isHQAuthorized) && role === "worker") {
      alert("관리자 권한 계정은 근로자 역할을 선택할 수 없습니다.");
      setRole(isMasterEmail ? "root" : "hq_officer");
      return;
    }
    if (role === "site_manager" && adminExists && !isEditMode) {
      alert(t.adminLimit);
      return;
    }
    if (role === "worker" && (!trade || !phone)) {
      alert(t.err);
      return;
    }
    if ((isAdminSiteRole || role === "root" || role === "hq_officer") && !title) {
      alert(t.err);
      return;
    }

    setLoading(true);
    try {
      const resolvedSiteId = selectedSiteId || (/^\d+$/.test(initSiteId) ? initSiteId : "");
      const user = await setupProfileV3({
        setupRole: role,
        displayName: finalName,
        preferredLang: language,
        phoneNumber: phone.trim() || undefined,
        trade: trade.trim() || undefined,
        title: title.trim() || undefined,
        siteCode: siteCode.trim() || undefined,
        siteId: resolvedSiteId || undefined,
      });

      if (rememberMe) {
        localStorage.setItem("safe-link-remember", "true");
        localStorage.setItem("safe-link-lang", language);
      } else {
        localStorage.setItem("safe-link-remember", "false");
      }
      sessionStorage.setItem("safe-link-session-active", "true");

      const serverRole = pickDefaultV3Role(user.roles);
      const redirectPath = serverRole
        ? getDefaultRouteForProfileRole(serverRole as ProfileRole)
        : getDefaultRouteForProfileRole(getProfileRoleFromSetupRole(role));
      window.location.href = `${redirectPath}?lang=${language}`;
    } catch {
      alert("프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  }, [
    adminExists,
    fetchRomanized,
    initSiteId,
    isAdminSiteRole,
    isEditMode,
    isHQAuthorized,
    isMasterEmail,
    isNonLatin,
    language,
    name,
    phone,
    rememberMe,
    role,
    selectedSiteId,
    siteCode,
    t.adminLimit,
    t.err,
    title,
    trade,
  ]);

  const roles: { key: RoleKey; emoji: string; color: ColorKey; glow: string }[] = [
    ...(isMasterEmail ? [{ key: "root" as RoleKey, emoji: "💎", color: "purple" as ColorKey, glow: "rgba(168,85,247,0.35)" }] : []),
    ...(isHQAuthorized ? [{ key: "hq_officer" as RoleKey, emoji: "🏢", color: "indigo" as ColorKey, glow: "rgba(99,102,241,0.35)" }] : []),
    { key: "site_manager", emoji: "🏗️", color: "blue", glow: "rgba(59,130,246,0.35)" },
    { key: "safety_officer", emoji: "🦺", color: "amber", glow: "rgba(245,158,11,0.35)" },
    { key: "gongmu", emoji: "📋", color: "indigo", glow: "rgba(99,102,241,0.35)" },
    { key: "worker", emoji: "👷", color: "green", glow: "rgba(34,197,94,0.35)" },
  ];

  const colorMap: Record<ColorKey, { border: string; bg: string; text: string; activeBg: string }> = {
    blue:   { border:"rgba(59,130,246,0.5)",  bg:"rgba(59,130,246,0.08)",  activeBg:"rgba(59,130,246,0.15)",  text:"#93C5FD" },
    amber:  { border:"rgba(245,158,11,0.5)",  bg:"rgba(245,158,11,0.08)",  activeBg:"rgba(245,158,11,0.15)",  text:"#FCD34D" },
    green:  { border:"rgba(34,197,94,0.5)",   bg:"rgba(34,197,94,0.08)",   activeBg:"rgba(34,197,94,0.15)",   text:"#6EE7B7" },
    purple: { border:"rgba(168,85,247,0.5)",  bg:"rgba(168,85,247,0.08)",  activeBg:"rgba(168,85,247,0.15)",  text:"#D8B4FE" },
    indigo: { border:"rgba(99,102,241,0.5)",  bg:"rgba(99,102,241,0.08)",  activeBg:"rgba(99,102,241,0.15)",  text:"#A5B4FC" },
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-5" style={{ background:"#050508" }}>
      <BgOrbs />
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-5 text-center">
          <h1 className="text-[28px] font-black leading-none tracking-tighter text-white">
            SAFE<span style={{ color:"#60A5FA" }}>-LINK</span>
          </h1>
          <p className="mt-1 text-[9px] uppercase tracking-[0.4em] text-slate-700">
            {isEditMode ? t.editTitle : t.pgTitle}
          </p>
        </div>

        <div style={glassCard} className="overflow-hidden">
          <div style={accentLine} />
          <div className="p-6">
            <StepIndicator step={step} t={t} />

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity:0, x:20 }}
                  animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }}
                  transition={{ duration:0.22 }}
                  className="flex flex-col gap-4"
                >
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                    {t.roleTitle}
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {roles.map(({ key, emoji, color, glow }) => {
                      const isLocked = key === "site_manager" && adminExists && role !== "site_manager";
                      const isSelected = role === key;
                      const isForbidden = key === "worker" && (isMasterEmail || isHQAuthorized);
                      const isDisabled = isLocked || (isEditMode && !isSelected && key !== "root") || isForbidden;
                      const c = colorMap[color];
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (isLocked) {
                              alert(t.adminLimit);
                              return;
                            }
                            if (isEditMode && key !== "root") return;
                            setRole(key);
                          }}
                          disabled={isDisabled}
                          className="rounded-xl p-3 text-left font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-20"
                          style={{
                            background: isSelected ? c.activeBg : c.bg,
                            border:`1px solid ${isSelected ? c.border : "rgba(255,255,255,0.06)"}`,
                            boxShadow: isSelected ? `0 0 18px ${glow}` : "none",
                          }}
                        >
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="text-base">{emoji}</span>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[8px] font-black uppercase" style={{ color: c.text }}>
                                <span className="h-1 w-1 animate-pulse rounded-full bg-current" />ON
                              </span>
                            )}
                            {isLocked && <span className="text-[8px] font-black uppercase" style={{ color:"#334155" }}>{t.alreadySet}</span>}
                          </div>
                          <span className="block text-[11px] font-black" style={{ color: isSelected ? c.text : "#64748B" }}>
                            {t[key as string] || key}
                          </span>
                          <p className="mt-0.5 text-[9px] leading-tight" style={{ color:"#334155" }}>
                            {t[`${key as string}_desc`]}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                      {t.nameTitle}
                    </label>
                    <div style={fieldBox}>
                      <input
                        type="text"
                        placeholder={t.nameTitle}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onBlur={handleNameBlur}
                        className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700"
                      />
                    </div>
                    {romanizing && (
                      <p className="ml-1 mt-1.5 flex animate-pulse items-center gap-1 text-[10px]" style={{ color:"#60A5FA" }}>
                        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-blue-400" />
                        영문 이름 자동 변환 중...
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                      {t.langTitle}
                    </label>
                    <div style={fieldBox}>
                      <select
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                        className="w-full appearance-none bg-transparent px-4 py-3.5 text-sm text-white outline-none"
                        style={{ color:"#F1F5F9" }}
                      >
                        {languages.map((lang) => (
                          <option key={lang.code} value={lang.code} style={{ background:"#0d0e18" }}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!canProceedStep1()) {
                        alert(t.err);
                        return;
                      }
                      setStep(2);
                    }}
                    disabled={!canProceedStep1()}
                    className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
                    style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 20px rgba(59,130,246,0.22)" }}
                  >
                    {t.next}
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity:0, x:20 }}
                  animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }}
                  transition={{ duration:0.22 }}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                      {isAdminSiteRole && siteList.length > 0
                        ? (language === "ko" ? "현장 선택 *" : "Select Site *")
                        : t.siteTitle}
                    </label>
                    {isAdminSiteRole && siteList.length > 0 ? (
                      <>
                        <div style={fieldBox}>
                          <select
                            value={selectedSiteId}
                            onChange={(event) => {
                              const id = event.target.value;
                              setSelectedSiteId(id);
                              const found = siteList.find((site) => site.id === id);
                              setSiteCode(found?.name ?? "");
                            }}
                            className="w-full appearance-none bg-transparent px-4 py-3.5 text-sm text-white outline-none"
                            style={{ color: selectedSiteId ? "#F1F5F9" : "#475569" }}
                          >
                            <option value="" style={{ background:"#0d0e18" }}>
                              {language === "ko" ? "현장을 선택하세요" : "Select a site"}
                            </option>
                            {siteList.map((site) => (
                              <option key={site.id} value={site.id} style={{ background:"#0d0e18" }}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedSiteId && (
                          <p className="ml-1 mt-1.5 text-[10px]" style={{ color:"#22C55E" }}>
                            ✓ {language === "ko" ? "현장이 선택되었습니다" : "Site selected"}
                          </p>
                        )}
                      </>
                    ) : (
                      <div style={fieldBox}>
                        <input
                          type="text"
                          placeholder={t.siteTitle}
                          value={siteCode}
                          onChange={(event) => setSiteCode(event.target.value)}
                          className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  {role === "worker" ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                          {language === "ko" ? "휴대폰 번호" : "Phone Number"}
                        </label>
                        <div style={fieldBox}>
                          <input
                            type="tel"
                            placeholder="010-0000-0000"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                          {t.tradeTitle}
                        </label>
                        <div style={fieldBox}>
                          <input
                            type="text"
                            placeholder={t.tradeTitle}
                            value={trade}
                            onChange={(event) => setTrade(event.target.value)}
                            className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700"
                          />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {TRADES.map(({ ko, label }) => {
                            const displayLabel = label[language] || label.en || ko;
                            const chipValue = language !== "ko" ? `${displayLabel} (${ko})` : ko;
                            const isSelected = trade === chipValue || trade === ko || trade.endsWith(`(${ko})`);
                            return (
                              <button
                                key={ko}
                                onClick={() => setTrade(chipValue)}
                                className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all duration-200"
                                style={{
                                  background: isSelected ? "#2563EB" : "rgba(255,255,255,0.04)",
                                  border:`1px solid ${isSelected ? "#3B82F6" : "rgba(255,255,255,0.07)"}`,
                                  color: isSelected ? "#fff" : "#64748B",
                                }}
                              >
                                {displayLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                        {t.posTitle}
                      </label>
                      <div style={fieldBox}>
                        <input
                          type="text"
                          placeholder={t.posTitle}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-1 flex gap-2.5">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl px-5 py-3.5 text-sm font-black transition-all active:scale-95"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#94A3B8" }}
                    >
                      {t.prev}
                    </button>
                    <button
                      onClick={() => {
                        if (!canProceedStep2()) {
                          alert(t.err);
                          return;
                        }
                        setStep(3);
                      }}
                      disabled={!canProceedStep2()}
                      className="flex-1 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
                      style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 20px rgba(59,130,246,0.22)" }}
                    >
                      {t.next}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity:0, x:20 }}
                  animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }}
                  transition={{ duration:0.22 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3 rounded-xl p-4" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)" }}>
                      {role === "worker" ? "👷" : role === "safety_officer" ? "🦺" : role === "site_manager" ? "🏗️" : role === "root" ? "💎" : "🏢"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{name || "—"}</p>
                      <p className="mt-0.5 truncate text-[11px]" style={{ color:"#64748B" }}>
                        {t[role as string] || role} · {siteCode || "—"}
                      </p>
                      {role === "worker" && trade && (
                        <span className="mt-1 inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold" style={{ background:"rgba(59,130,246,0.12)", color:"#93C5FD", border:"1px solid rgba(59,130,246,0.2)" }}>
                          {trade}
                        </span>
                      )}
                    </div>
                  </div>

                  <label
                    className="flex cursor-pointer select-none items-center gap-3.5 rounded-xl p-4 transition-all duration-200"
                    style={{ background:"rgba(59,130,246,0.06)", border:`2px solid ${rememberMe ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.07)"}` }}
                    onClick={() => setRememberMe((value) => !value)}
                  >
                    <div className="relative flex-shrink-0" style={{ width:48, height:26 }}>
                      <div className="h-full w-full rounded-full transition-all duration-300" style={{ background: rememberMe ? "#3B82F6" : "rgba(255,255,255,0.1)" }} />
                      <div className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-lg transition-all duration-300" style={{ left: rememberMe ? 24 : 2 }} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-black text-white">{t.rememberMe}</span>
                      <span className="mt-0.5 block text-[10px]" style={{ color:"#475569" }}>{t.rememberDesc}</span>
                    </div>
                    {rememberMe && (
                      <motion.span initial={{ scale:0 }} animate={{ scale:1 }} className="flex-shrink-0 text-lg" style={{ color:"#10B981" }}>
                        ✓
                      </motion.span>
                    )}
                  </label>

                  {rememberMe && (
                    <motion.p
                      initial={{ opacity:0, y:-4 }}
                      animate={{ opacity:1, y:0 }}
                      className="-mt-1 ml-1 flex items-center gap-1.5 text-[10px]"
                      style={{ color:"#059669" }}
                    >
                      <span>✓</span>
                      {language === "ko" ? "자동 로그인이 활성화되었습니다." :
                       language === "vi" ? "Đăng nhập tự động đã được kích hoạt." :
                       language === "zh" ? "自动登录已启用。" :
                       "Auto-login is enabled."}
                    </motion.p>
                  )}

                  <div className="mt-1 flex gap-2.5">
                    <button
                      onClick={() => setStep(2)}
                      className="rounded-xl px-5 py-3.5 text-sm font-black transition-all active:scale-95"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#94A3B8" }}
                    >
                      {t.prev}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
                      style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 24px rgba(59,130,246,0.28)" }}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        </span>
                      ) : t.save}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {!isMasterEmail && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => router.push("/account/delete")}
              className="min-h-11 px-3 text-xs font-bold text-slate-600 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-red-400"
            >
              계정 탈퇴
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SetupProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background:"#050508" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}

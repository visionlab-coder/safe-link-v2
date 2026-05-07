"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { languages } from "@/constants";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDefaultRouteForProfileRole,
  getProfileRoleFromSetupRole,
  type SetupRoleKey,
} from "@/lib/roles";

type RoleKey = SetupRoleKey | "";
type ColorKey = "blue" | "amber" | "green" | "purple" | "indigo";
type Step = 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
// Translation Dictionary
// ─────────────────────────────────────────────────────────────────────────────
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
const getT = (lang: string) => T[lang] || T["en"];

// ─────────────────────────────────────────────────────────────────────────────
// Trade Quick-Select — Korean canonical + per-language labels
// ─────────────────────────────────────────────────────────────────────────────
const TRADES: { ko: string; label: Record<string, string> }[] = [
  { ko: "형틀목공", label: { ko:"형틀목공", en:"Formwork", vi:"Cốp pha", zh:"模板工", th:"ช่างแบบ", uz:"Qolip ustasi", tl:"Formwork", km:"ជ័រជ", id:"Bekisting", mn:"Хэвлэгч", my:"ကြမ်းငွေ့", ne:"ढाँचा", bn:"ফর্মওয়ার্ক", kk:"Қалып", ru:"Опалубщик", ja:"型枠大工", fr:"Coffrage", es:"Encofrado", ar:"قوالب", hi:"फॉर्मवर्क" }},
  { ko: "철근", label: { ko:"철근", en:"Rebar", vi:"Cốt thép", zh:"钢筋", th:"เหล็กเส้น", uz:"Armatura", tl:"Rebar", km:"ដែក", id:"Besi Beton", mn:"Арматур", my:"သံချောင်း", ne:"छड", bn:"রড", kk:"Арматура", ru:"Арматурщик", ja:"鉄筋", fr:"Ferrailleur", es:"Ferralla", ar:"حديد", hi:"सरिया" }},
  { ko: "콘크리트", label: { ko:"콘크리트", en:"Concrete", vi:"Bê tông", zh:"混凝土", th:"คอนกรีต", uz:"Beton", tl:"Kongkreto", km:"បេតុង", id:"Beton", mn:"Бетон", my:"ကွန်ကရစ်", ne:"कंक्रिट", bn:"কংক্রিট", kk:"Бетон", ru:"Бетонщик", ja:"コンクリート", fr:"Béton", es:"Hormigón", ar:"خرسانة", hi:"कंक्रीट" }},
  { ko: "비계", label: { ko:"비계", en:"Scaffolding", vi:"Giàn giáo", zh:"脚手架", th:"นั่งร้าน", uz:"Iskana", tl:"Scaffolding", km:"ជន្រោង", id:"Perancah", mn:"Тулгуур", my:"တိုင်ကူး", ne:"मचान", bn:"ভারাম", kk:"Леса", ru:"Леса", ja:"足場", fr:"Échafaudage", es:"Andamio", ar:"سقالة", hi:"मचान" }},
  { ko: "용접", label: { ko:"용접", en:"Welding", vi:"Hàn", zh:"焊接", th:"เชื่อม", uz:"Payvandlash", tl:"Welding", km:"ហ្វូ", id:"Las", mn:"Гагнуур", my:"ဂဟေဆော်", ne:"वेल्डिङ", bn:"ওয়েল্ডিং", kk:"Дәнекерлеу", ru:"Сварщик", ja:"溶接", fr:"Soudure", es:"Soldadura", ar:"لحام", hi:"वेल्डिंग" }},
  { ko: "전기", label: { ko:"전기", en:"Electrical", vi:"Điện", zh:"电气", th:"ไฟฟ้า", uz:"Elektr", tl:"Kuryente", km:"អគ្គិសនី", id:"Listrik", mn:"Цахилгаан", my:"လျှပ်စစ်", ne:"विद्युत", bn:"বৈদ্যুতিক", kk:"Электр", ru:"Электрик", ja:"電気", fr:"Électricité", es:"Eléctrico", ar:"كهرباء", hi:"बिजली" }},
  { ko: "설비", label: { ko:"설비", en:"Mechanical", vi:"Cơ điện", zh:"机电", th:"งานระบบ", uz:"Jihozlar", tl:"Mekaniko", km:"ប្រព័ន្ធ", id:"Mekanikal", mn:"Сантехник", my:"စက်ပစ္စည်း", ne:"मेकानिकल", bn:"মেকানিক্যাল", kk:"Жабдық", ru:"Слесарь", ja:"設備", fr:"Équipement", es:"Instalaciones", ar:"أنظمة", hi:"मैकेनिकल" }},
];

// ─────────────────────────────────────────────────────────────────────────────
// Background orbs (same design as auth page)
// ─────────────────────────────────────────────────────────────────────────────
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

// Shared panel styles
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

// ─────────────────────────────────────────────────────────────────────────────
// Compact step indicator
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ step, t }: { step: Step; t: Record<string, string> }) {
  const steps = [
    { num: 1 as Step, label: t.step1Title },
    { num: 2 as Step, label: t.step2Title },
    { num: 3 as Step, label: t.step3Title },
  ];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, idx) => (
        <div key={s.num} className={`flex items-center ${idx < 2 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center justify-center font-black text-xs flex-shrink-0 transition-all duration-300"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step > s.num ? "#10B981" : step === s.num ? "#3B82F6" : "rgba(255,255,255,0.05)",
                border: `1px solid ${step > s.num ? "#10B981" : step === s.num ? "#3B82F6" : "rgba(255,255,255,0.1)"}`,
                color: step >= s.num ? "#fff" : "#475569",
                boxShadow: step === s.num ? "0 0 14px rgba(59,130,246,0.45)" : "none",
              }}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span className="text-[8px] font-bold text-center leading-tight max-w-[60px] truncate transition-colors"
              style={{ color: step === s.num ? "#93C5FD" : step > s.num ? "#10B981" : "#334155" }}>
              {s.label}
            </span>
          </div>
          {idx < 2 && (
            <div className="flex-1 h-px mx-1.5 mb-3.5 transition-all duration-300"
              style={{ background: step > s.num ? "#10B981" : "rgba(255,255,255,0.06)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Setup Content
// ─────────────────────────────────────────────────────────────────────────────
function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const urlLang = searchParams.get("lang") || "ko";
  const t = getT(urlLang);

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleKey>("");
  const [language, setLanguage] = useState(urlLang);
  const [name, setName] = useState("");
  const [romanizing, setRomanizing] = useState(false);
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [title, setTitle] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [initSiteId] = useState(searchParams.get("site_id") || "");
  const [userId, setUserId] = useState<string | null>(null);
  const [adminExists, setAdminExists] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMasterEmail, setIsMasterEmail] = useState(false);
  const [isHQAuthorized, setIsHQAuthorized] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 마스터/HQ 이메일 목록은 환경변수에서 로드 (클라이언트 코드에 하드코딩 금지)
  const masterEmails = useMemo(() =>
    (process.env.NEXT_PUBLIC_MASTER_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean),
  []);
  const hqOfficerEmails = useMemo(() =>
    (process.env.NEXT_PUBLIC_HQ_OFFICER_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean),
  []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      const isMaster = masterEmails.includes(user.email || "");
      const isHQ = hqOfficerEmails.includes(user.email || "");
      setIsMasterEmail(isMaster);
      setIsHQAuthorized(isHQ);

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profile) {
        setIsEditMode(true);
        setName(profile.display_name || "");
        setLanguage(profile.preferred_lang || "ko");
        setPhone(profile.phone_number || "");
        setTrade(profile.trade || "");
        setTitle(profile.title || "");
        setSiteCode(profile.site_code || "");
        const dbToRole: Record<string, RoleKey> = {
          HQ_ADMIN: "site_manager", SAFETY_OFFICER: "safety_officer",
          WORKER: "worker", ROOT: "root", HQ_OFFICER: "hq_officer",
        };
        if (isMaster) setRole("root");
        else if (isHQ) setRole("hq_officer");
        else setRole(dbToRole[profile.role] || "");
      } else {
        if (isMaster) setRole("root");
        else if (isHQ) setRole("hq_officer");
        else {
          const urlRole = searchParams.get("role");
          if (urlRole === "admin") setRole("safety_officer");
          else setRole("worker");
        }
      }

      const { count } = await supabase
        .from("profiles").select("id", { count: "exact", head: true })
        .eq("role", "HQ_ADMIN").neq("id", user.id);
      setAdminExists((count ?? 0) > 0);
    };
    init();
  }, [hqOfficerEmails, masterEmails, router, searchParams]);

  const isNonLatin = (n: string) =>
    !/^[a-zA-Z\s\-'.]+$/.test(n.trim()) && !/\(.+\)/.test(n.trim());

  const fetchRomanized = async (n: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/romanize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n.trim(), lang: language }),
      });
      const data = await res.json() as { romanized: string | null };
      return data.romanized && data.romanized !== n.trim() ? data.romanized : null;
    } catch { return null; }
  };

  const handleNameBlur = async () => {
    const trimmed = name.trim();
    if (!trimmed || !isNonLatin(trimmed)) return;
    setRomanizing(true);
    try {
      const romanized = await fetchRomanized(trimmed);
      if (romanized) {
        // 자동 적용 — 관리자가 이름을 읽을 수 있도록 필수
        setName(`${trimmed} (${romanized})`);
      }
    } finally { setRomanizing(false); }
  };

  const canProceedStep1 = () => !!(name.trim() && role);
  const canProceedStep2 = () => {
    if (role === "worker" && (!trade || !siteCode)) return false;
    if ((role === "site_manager" || role === "safety_officer" || role === "root" || role === "hq_officer") && !title) return false;
    return true;
  };

  const handleSave = async () => {
    if (!role || !name.trim()) { alert(t.err); return; }

    // 비라틴 이름에 영문 표기 없으면 저장 전 강제 변환
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
    if (role === "site_manager" && adminExists && !isEditMode) { alert(t.adminLimit); return; }
    if (role === "worker" && (!trade || !phone)) { alert(t.err); return; }
    if ((role === "site_manager" || role === "safety_officer" || role === "root" || role === "hq_officer") && !title) { alert(t.err); return; }

    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: finalName,
      role: getProfileRoleFromSetupRole(role as SetupRoleKey),
      system_role: (role === "root" || role === "hq_officer") ? "ROOT" : null,
      preferred_lang: language,
      phone_number: phone.trim(),
      trade: trade.trim(),
      title: title.trim(),
      site_code: siteCode.trim(),
      site_id: initSiteId || null,
    });
    setLoading(false);
    if (error) { alert(error.message); return; }

    if (rememberMe) {
      localStorage.setItem("safe-link-remember", "true");
      localStorage.setItem("safe-link-lang", language);
    } else {
      localStorage.setItem("safe-link-remember", "false");
    }
    sessionStorage.setItem("safe-link-session-active", "true");
    const redirectPath = getDefaultRouteForProfileRole(getProfileRoleFromSetupRole(role as SetupRoleKey));
    window.location.href = `${redirectPath}?lang=${language}`;
  };

  const roles: { key: RoleKey; emoji: string; color: ColorKey; glow: string }[] = [
    ...(isMasterEmail ? [{ key: "root" as RoleKey, emoji: "💎", color: "purple" as ColorKey, glow: "rgba(168,85,247,0.35)" }] : []),
    ...(isHQAuthorized ? [{ key: "hq_officer" as RoleKey, emoji: "🏢", color: "indigo" as ColorKey, glow: "rgba(99,102,241,0.35)" }] : []),
    { key: "site_manager" as RoleKey, emoji: "🏗️", color: "blue" as ColorKey, glow: "rgba(59,130,246,0.35)" },
    { key: "safety_officer" as RoleKey, emoji: "🦺", color: "amber" as ColorKey, glow: "rgba(245,158,11,0.35)" },
    { key: "worker" as RoleKey, emoji: "👷", color: "green" as ColorKey, glow: "rgba(34,197,94,0.35)" },
  ];

  const colorMap: Record<ColorKey, { border: string; bg: string; text: string; activeBg: string }> = {
    blue:   { border:"rgba(59,130,246,0.5)",  bg:"rgba(59,130,246,0.08)",  activeBg:"rgba(59,130,246,0.15)",  text:"#93C5FD" },
    amber:  { border:"rgba(245,158,11,0.5)",  bg:"rgba(245,158,11,0.08)",  activeBg:"rgba(245,158,11,0.15)",  text:"#FCD34D" },
    green:  { border:"rgba(34,197,94,0.5)",   bg:"rgba(34,197,94,0.08)",   activeBg:"rgba(34,197,94,0.15)",   text:"#6EE7B7" },
    purple: { border:"rgba(168,85,247,0.5)",  bg:"rgba(168,85,247,0.08)",  activeBg:"rgba(168,85,247,0.15)",  text:"#D8B4FE" },
    indigo: { border:"rgba(99,102,241,0.5)",  bg:"rgba(99,102,241,0.08)",  activeBg:"rgba(99,102,241,0.15)",  text:"#A5B4FC" },
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden relative" style={{ background:"#050508" }}>
      <BgOrbs />
      <div className="w-full max-w-[380px] relative z-10">

        {/* Brand */}
        <div className="text-center mb-5">
          <h1 className="text-[28px] font-black text-white tracking-tighter leading-none">
            SAFE<span style={{ color:"#60A5FA" }}>-LINK</span>
          </h1>
          <p className="text-[9px] text-slate-700 tracking-[0.4em] uppercase mt-1">
            {isEditMode ? t.editTitle : t.pgTitle}
          </p>
        </div>

        {/* Card */}
        <div style={glassCard} className="overflow-hidden">
          <div style={accentLine} />
          <div className="p-6">

            <StepIndicator step={step} t={t} />

            <AnimatePresence mode="wait">

              {/* ── STEP 1: Role + Name + Language ── */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }} transition={{ duration:0.22 }} className="flex flex-col gap-4">

                  {/* Role label */}
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                    {t.roleTitle}
                  </label>

                  {/* Role grid — 2 columns compact */}
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map(({ key, emoji, color, glow }) => {
                      const isLocked = key === "site_manager" && adminExists && role !== "site_manager";
                      const isSelected = role === key;
                      const isForbidden = key === "worker" && (isMasterEmail || isHQAuthorized);
                      const isDisabled = isLocked || (isEditMode && !isSelected && key !== "root") || isForbidden;
                      const c = colorMap[color];
                      return (
                        <button key={key}
                          onClick={() => { if (isLocked) { alert(t.adminLimit); return; } if (isEditMode && key !== "root") return; setRole(key); }}
                          disabled={isDisabled}
                          className="p-3 rounded-xl font-bold text-left transition-all duration-200 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed"
                          style={{
                            background: isSelected ? c.activeBg : c.bg,
                            border:`1px solid ${isSelected ? c.border : "rgba(255,255,255,0.06)"}`,
                            boxShadow: isSelected ? `0 0 18px ${glow}` : "none",
                          }}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-base">{emoji}</span>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[8px] font-black uppercase" style={{ color: c.text }}>
                                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />ON
                              </span>
                            )}
                            {isLocked && <span className="text-[8px] font-black uppercase" style={{ color:"#334155" }}>{t.alreadySet}</span>}
                          </div>
                          <span className="text-[11px] font-black block" style={{ color: isSelected ? c.text : "#64748B" }}>
                            {t[key as string] || key}
                          </span>
                          <p className="text-[9px] mt-0.5 leading-tight" style={{ color:"#334155" }}>
                            {t[`${key as string}_desc`]}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>{t.nameTitle}</label>
                    <div style={fieldBox}>
                      <input type="text" placeholder={t.nameTitle} value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={handleNameBlur}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                    </div>
                    {romanizing && (
                      <p className="text-[10px] mt-1.5 ml-1 animate-pulse flex items-center gap-1" style={{ color:"#60A5FA" }}>
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        영문 이름 자동 변환 중...
                      </p>
                    )}
                  </div>

                  {/* Language select */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>{t.langTitle}</label>
                    <div style={fieldBox}>
                      <select value={language} onChange={e => setLanguage(e.target.value)}
                        className="w-full bg-transparent text-white text-sm outline-none px-4 py-3.5 appearance-none"
                        style={{ color:"#F1F5F9" }}>
                        {languages.map(l => <option key={l.code} value={l.code} style={{ background:"#0d0e18" }}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={() => { if (!canProceedStep1()) { alert(t.err); return; } setStep(2); }}
                    disabled={!canProceedStep1()}
                    className="w-full py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-95 disabled:opacity-40"
                    style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 20px rgba(59,130,246,0.22)" }}>
                    {t.next}
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2: Site + Trade/Position ── */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }} transition={{ duration:0.22 }} className="flex flex-col gap-4">

                  {/* Site code */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>{t.siteTitle}</label>
                    <div style={fieldBox}>
                      <input type="text" placeholder={t.siteTitle} value={siteCode}
                        onChange={e => setSiteCode(e.target.value)}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                    </div>
                  </div>

                  {/* Worker: phone + trade / Admin: position */}
                  {role === "worker" ? (
                    <>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>
                          {language === "ko" ? "휴대폰 번호" : "Phone Number"}
                        </label>
                        <div style={fieldBox}>
                          <input type="tel" placeholder="010-0000-0000" value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>{t.tradeTitle}</label>
                        <div style={fieldBox}>
                          <input type="text" placeholder={t.tradeTitle} value={trade}
                            onChange={e => setTrade(e.target.value)}
                            className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                        </div>
                        {/* Quick-select trades — translated per language */}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {TRADES.map(({ ko, label }) => {
                            const displayLabel = label[language] || label.en || ko;
                            const chipValue = language !== "ko" ? `${displayLabel} (${ko})` : ko;
                            const isSelected = trade === chipValue || trade === ko || trade.endsWith(`(${ko})`);
                            return (
                              <button key={ko} onClick={() => setTrade(chipValue)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200"
                                style={{
                                  background: isSelected ? "#2563EB" : "rgba(255,255,255,0.04)",
                                  border:`1px solid ${isSelected ? "#3B82F6" : "rgba(255,255,255,0.07)"}`,
                                  color: isSelected ? "#fff" : "#64748B",
                                }}>
                                {displayLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block" style={{ color:"#475569" }}>{t.posTitle}</label>
                      <div style={fieldBox}>
                        <input type="text" placeholder={t.posTitle} value={title}
                          onChange={e => setTitle(e.target.value)}
                          className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2.5 mt-1">
                    <button onClick={() => setStep(1)}
                      className="py-3.5 px-5 font-black text-sm rounded-xl transition-all active:scale-95"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#94A3B8" }}>
                      {t.prev}
                    </button>
                    <button onClick={() => { if (!canProceedStep2()) { alert(t.err); return; } setStep(3); }}
                      disabled={!canProceedStep2()}
                      className="flex-1 py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-95 disabled:opacity-40"
                      style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 20px rgba(59,130,246,0.22)" }}>
                      {t.next}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: Auto-Login + Complete ── */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-20 }} transition={{ duration:0.22 }} className="flex flex-col gap-4">

                  {/* Profile summary card */}
                  <div className="p-4 rounded-xl flex items-center gap-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-center text-2xl w-11 h-11 rounded-xl flex-shrink-0"
                      style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)" }}>
                      {role === "worker" ? "👷" : role === "safety_officer" ? "🦺" : role === "site_manager" ? "🏗️" : role === "root" ? "💎" : "🏢"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">{name || "—"}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color:"#64748B" }}>
                        {t[role as string] || role} · {siteCode || "—"}
                      </p>
                      {role === "worker" && trade && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                          style={{ background:"rgba(59,130,246,0.12)", color:"#93C5FD", border:"1px solid rgba(59,130,246,0.2)" }}>
                          {trade}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Auto-login toggle — key feature */}
                  <label className="flex items-center gap-3.5 p-4 rounded-xl cursor-pointer select-none transition-all duration-200"
                    style={{ background:"rgba(59,130,246,0.06)", border:`2px solid ${rememberMe ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.07)"}` }}
                    onClick={() => setRememberMe(v => !v)}>
                    {/* iOS-style toggle */}
                    <div className="relative flex-shrink-0" style={{ width:48, height:26 }}>
                      <div className="w-full h-full rounded-full transition-all duration-300"
                        style={{ background: rememberMe ? "#3B82F6" : "rgba(255,255,255,0.1)" }} />
                      <div className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300"
                        style={{ left: rememberMe ? 24 : 2 }} />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-white font-black block">{t.rememberMe}</span>
                      <span className="text-[10px] block mt-0.5" style={{ color:"#475569" }}>{t.rememberDesc}</span>
                    </div>
                    {rememberMe && (
                      <motion.span initial={{ scale:0 }} animate={{ scale:1 }} className="text-lg flex-shrink-0"
                        style={{ color:"#10B981" }}>✓</motion.span>
                    )}
                  </label>

                  {rememberMe && (
                    <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                      className="text-[10px] flex items-center gap-1.5 -mt-1 ml-1"
                      style={{ color:"#059669" }}>
                      <span>✓</span>
                      {language === "ko" ? "자동 로그인이 활성화되었습니다." :
                       language === "vi" ? "Đăng nhập tự động đã được kích hoạt." :
                       language === "zh" ? "自动登录已启用。" :
                       "Auto-login is enabled."}
                    </motion.p>
                  )}

                  <div className="flex gap-2.5 mt-1">
                    <button onClick={() => setStep(2)}
                      className="py-3.5 px-5 font-black text-sm rounded-xl transition-all active:scale-95"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#94A3B8" }}>
                      {t.prev}
                    </button>
                    <button onClick={handleSave} disabled={loading}
                      className="flex-1 py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-95 disabled:opacity-40"
                      style={{ background:"linear-gradient(135deg,#2563EB,#3B82F6)", boxShadow:"0 4px 24px rgba(59,130,246,0.28)" }}>
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        </span>
                      ) : t.save}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SetupProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background:"#050508" }}>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}

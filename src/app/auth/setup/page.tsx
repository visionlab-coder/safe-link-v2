"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { languages } from "@/constants";
import { motion, AnimatePresence } from "framer-motion";

type RoleKey = "site_manager" | "safety_officer" | "worker" | "root" | "hq_officer" | "";

const T: any = {
    ko: {
        pgTitle: "역할 설정",
        editTitle: "프로필 설정",
        desc: "현장에서 사용할 이름과 역할, 언어를 등록해 주세요.",
        nameTitle: "이름 (Full Name)",
        phoneTitle: "휴대폰 번호",
        tradeTitle: "투입 공종 (예: 형틀, 철근)",
        posTitle: "직책 (예: 대리, 과장)",
        siteTitle: "현장 코드 또는 현장명",
        langTitle: "모국어 (Native Language)",
        roleTitle: "현장 역할",
        site_manager: "현장 소장",
        site_manager_desc: "TBM 작성 및 전파, 근로자 관리 (1명만 등록 가능)",
        safety_officer: "안전관리자",
        safety_officer_desc: "현장 안전 점검 및 TBM 모니터링",
        worker: "현장 근로자",
        worker_desc: "TBM 수신 및 서명, 관리자와 실시간 소통",
        hq_officer: "본사 안전관리실",
        hq_officer_desc: "본사 차원의 전역 통합 관제 및 전 현장 모니터링",
        save: "설정 완료하고 시작하기",
        err: "모든 정보를 정확하게 입력해주세요!",
        adminLimit: "현장 소장은 이미 등록되어 있습니다. 다른 역할을 선택해 주세요.",
        alreadySet: "이미 등록됨",
    },
    en: {
        pgTitle: "Profile Setup",
        editTitle: "Profile Settings",
        desc: "Enter your name, role, and preferred language.",
        nameTitle: "Full Name",
        phoneTitle: "Phone Number",
        tradeTitle: "Trade (e.g., Carpentry, Rebar)",
        posTitle: "Position (e.g., Lead, Officer)",
        siteTitle: "Site Code or Name",
        langTitle: "Native Language",
        roleTitle: "Site Role",
        site_manager: "Site Manager",
        site_manager_desc: "Write & broadcast TBM, manage workers (1 person only)",
        safety_officer: "Safety Officer",
        safety_officer_desc: "Safety inspection & TBM monitoring",
        worker: "Field Worker",
        worker_desc: "Receive TBM, sign, and communicate with management",
        hq_officer: "HQ Safety Office",
        hq_officer_desc: "Global HQ control and monitoring across all sites",
        save: "Complete Setup",
        err: "Please fill in all fields correctly!",
        adminLimit: "A Site Manager is already registered. Please choose another role.",
        alreadySet: "Already registered",
    },
    root: {
        ko: "마스터 관리자",
        en: "Master Admin"
    },
    zh: {
        title: "个人资料设置",
        desc: "请输入您的姓名、角色和首选语言。",
        name: "姓名",
        lang: "母语",
        role: "现场角色",
        site_manager: "现场主管",
        site_manager_desc: "编写并发送TBM，管理工人（仅限1人）",
        safety_officer: "安全管理员",
        safety_officer_desc: "现场安全检查及TBM监控",
        worker: "现场工人",
        worker_desc: "接收TBM，签名并与管理层实时沟通",
        save: "完成设置",
        err: "请填写所有字段！",
        adminLimit: "现场主管已有人注册。请选择其他角色。",
        alreadySet: "已注册",
    },
    vi: {
        title: "Cài đặt hồ sơ",
        desc: "Nhập tên, vai trò và ngôn ngữ của bạn.",
        name: "Tên",
        lang: "Ngôn ngữ",
        role: "Vai trò",
        site_manager: "Quản lý công trường",
        site_manager_desc: "Viết & phát TBM, quản lý công nhân (chỉ 1 người)",
        safety_officer: "Cán bộ an toàn",
        safety_officer_desc: "Kiểm tra an toàn & theo dõi TBM",
        worker: "Công nhân",
        worker_desc: "Nhận TBM, ký và giao tiếp với quản lý",
        save: "Hoàn tất",
        err: "Vui lòng điền đầy đủ!",
        adminLimit: "Quản lý đã được đăng ký. Chọn vai trò khác.",
        alreadySet: "Đã đăng ký",
    },
    th: {
        title: "ตั้งค่าโปรไฟล์",
        desc: "กรอกชื่อ บทบาท และภาษาของคุณ",
        name: "ชื่อ",
        lang: "ภาษา",
        role: "บทบาท",
        site_manager: "ผู้จัดการไซต์",
        site_manager_desc: "เขียน/กระจาย TBM, จัดการคนงาน (1 คนเท่านั้น)",
        safety_officer: "เจ้าหน้าที่ความปลอดภัย",
        safety_officer_desc: "ตรวจสอบความปลอดภัย & ติดตาม TBM",
        worker: "คนงาน",
        worker_desc: "รับ TBM ลงนาม และสื่อสาร",
        save: "เสร็จสิ้น",
        err: "กรุณากรอกข้อมูลให้ครบ!",
        adminLimit: "มีผู้จัดการไซต์แล้ว กรุณาเลือกบทบาทอื่น",
        alreadySet: "ลงทะเบียนแล้ว",
    },
};
const getT = (lang: string) => T[lang] || T["en"];

// 역할 → DB 저장값 매핑
const roleToDb: Record<string, string> = {
    site_manager: "HQ_ADMIN",
    safety_officer: "SAFETY_OFFICER",
    worker: "WORKER",
    root: "ROOT",
    hq_officer: "HQ_OFFICER",
};
// DB 저장값 → 리다이렉트 경로
const roleToPath: Record<string, string> = {
    site_manager: "/control",
    safety_officer: "/admin",
    worker: "/worker",
    root: "/system",
    hq_officer: "/system",
};

function SetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const urlLang = searchParams.get("lang") || "ko";
    const t = getT(urlLang);

    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState<RoleKey>("");
    const [language, setLanguage] = useState(urlLang);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [trade, setTrade] = useState("");
    const [title, setTitle] = useState("");
    const [siteCode, setSiteCode] = useState("");
    const [initSiteId, setInitSiteId] = useState(searchParams.get("site_id") || "");
    const [userId, setUserId] = useState<string | null>(null);
    const [adminExists, setAdminExists] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isMasterEmail, setIsMasterEmail] = useState(false);
    const [isHQAuthorized, setIsHQAuthorized] = useState(false);

    // 전역 통합 관제 권한 리스트
    const masterEmails = ["like2buyglobal@gmail.com", "visionlab@seowonenc.co.kr"];
    const hqOfficerEmails = [
        "sz.jung@seowonenc.co.kr", // 정성조 상무
        "sy.im@seowonenc.co.kr",   // 임성윤 부장
        "sk.park@seowonenc.co.kr", // 박순기 차장
        "jh.cho@seowonenc.co.kr"   // 조재훈 과장
    ];

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/auth"); return; }
            setUserId(user.id);
            const isMaster = masterEmails.includes(user.email || "");
            const isHQ = hqOfficerEmails.includes(user.email || "");
            setIsMasterEmail(isMaster);
            setIsHQAuthorized(isHQ);

            // 프로필 정보 가져오기
            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profile) {
                setIsEditMode(true);
                setName(profile.display_name || "");
                setLanguage(profile.preferred_lang || "ko");
                setPhone(profile.phone_number || "");
                setTrade(profile.trade || "");
                setTitle(profile.title || "");
                setSiteCode(profile.site_code || "");

                // 역매핑 (DB role -> RoleKey)
                const dbToRole: Record<string, RoleKey> = {
                    HQ_ADMIN: "site_manager",
                    SAFETY_OFFICER: "safety_officer",
                    WORKER: "worker",
                    ROOT: "root",
                    HQ_OFFICER: "hq_officer",
                };

                // 마스터나 본사 권한자면 기존 DB 역할 무시하고 강제 선택/해제 로직 적용
                if (isMaster) {
                    setRole("root");
                } else if (isHQ) {
                    setRole("hq_officer");
                } else {
                    setRole(dbToRole[profile.role] || "");
                }
            } else {
                // 신규 가입 자동 선택
                if (isMaster) setRole("root");
                else if (isHQ) setRole("hq_officer");
                else {
                    const urlRole = searchParams.get("role");
                    if (urlRole === "admin") setRole("safety_officer");
                    else if (urlRole === "worker") setRole("worker");
                }
            }

            // 현장 소장이 이미 있는지 확인 (내가 소장이 아닌 경우에만 체크용)
            const { count } = await supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "HQ_ADMIN")
                .neq("id", user.id); // '나'를 제외한 소장 존재 여부
            setAdminExists((count ?? 0) > 0);
        };
        init();
    }, []);

    const handleSave = async () => {
        if (!role || !language || !name.trim()) { alert(t.err); return; }

        // [Role Switching Protection] 마스터/본사 계정이 근로자로 전환되는 것을 원천 차단
        if ((isMasterEmail || isHQAuthorized) && role === "worker") {
            alert("관리자 권한 계정은 근로자 역할을 선택할 수 없습니다.");
            const correctRole = isMasterEmail ? "root" : "hq_officer";
            setRole(correctRole);
            return;
        }

        if (role === "site_manager" && adminExists && !isEditMode) { alert(t.adminLimit); return; }

        // 추가 검증
        if (role === "worker" && (!trade || !phone)) { alert(t.err); return; }
        if ((role === "site_manager" || role === "safety_officer" || role === "root" || role === "hq_officer") && !title) { alert(t.err); return; }

        setLoading(true);
        const { error } = await supabase.from("profiles").upsert({
            id: userId,
            display_name: name.trim(),
            role: roleToDb[role],
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
        window.location.href = roleToPath[role];
    };

    const inputCls = "w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-lg focus:border-blue-500 outline-none transition-colors";

    const roles = [
        ...(isMasterEmail ? [{ key: "root" as RoleKey, emoji: "💎", color: "purple", glowColor: "rgba(168,85,247,0.4)" }] : []),
        ...(isHQAuthorized ? [{ key: "hq_officer" as RoleKey, emoji: "🏢", color: "indigo", glowColor: "rgba(99,102,241,0.4)" }] : []),
        { key: "site_manager" as RoleKey, emoji: "🏗️", color: "blue", glowColor: "rgba(59,130,246,0.4)" },
        { key: "safety_officer" as RoleKey, emoji: "🦺", color: "amber", glowColor: "rgba(245,158,11,0.4)" },
        { key: "worker" as RoleKey, emoji: "👷", color: "green", glowColor: "rgba(34,197,94,0.4)" },
    ];

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            <div className="w-full max-w-md p-8 glass-card rounded-[32px] border-white/5 shadow-2xl relative overflow-hidden tech-border">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black text-white text-gradient italic">{isEditMode ? t.editTitle : t.pgTitle}</h1>
                    <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mt-2">{t.desc}</p>
                </div>

                <div className="flex flex-col gap-6">
                    {/* 역할 선택 (3가지) - First step */}
                    <div>
                        <label className="text-xs font-black text-slate-500 mb-3 block uppercase tracking-[0.2em]">{t.roleTitle}</label>
                        <div className="flex flex-col gap-3">
                            {roles.map(({ key, emoji, color, glowColor }) => {
                                // 내가 이 역할이 아닌데 이미 현장소장이 있는 경우에만 잠금
                                const isLocked = key === "site_manager" && adminExists && role !== "site_manager";
                                const isSelected = role === key;

                                // 마스터나 본사 권한자면 근로자 선택 원천 차단
                                const isMasterOrHQ = isMasterEmail || isHQAuthorized;
                                const isForbiddenWorker = key === "worker" && isMasterOrHQ;

                                const isDisabled = (isLocked) || (isEditMode && !isSelected && key !== "root") || isForbiddenWorker;

                                const colorMap: any = {
                                    blue: { border: "border-blue-500", bg: "bg-blue-600/20", text: "text-blue-300" },
                                    amber: { border: "border-amber-500", bg: "bg-amber-600/20", text: "text-amber-300" },
                                    green: { border: "border-green-500", bg: "bg-green-600/20", text: "text-green-300" },
                                    purple: { border: "border-purple-500", bg: "bg-purple-600/20", text: "text-purple-300" },
                                    indigo: { border: "border-indigo-500", bg: "bg-indigo-600/20", text: "text-indigo-300" },
                                };
                                const c = colorMap[color];

                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (isLocked) { alert(t.adminLimit); return; }
                                            // 마스터 계정은 editMode여도 root 선택 가능
                                            if (isEditMode && key !== "root") return;
                                            setRole(key);
                                        }}
                                        disabled={isDisabled}
                                        className={`p-4 rounded-2xl font-bold text-left border-2 transition-all duration-300 ${isSelected
                                            ? `${c.bg} ${c.border}`
                                            : isDisabled
                                                ? "border-slate-800 opacity-20 cursor-not-allowed filter grayscale"
                                                : `border-slate-700 bg-slate-900/50 hover:${c.border} hover:bg-slate-800/50`
                                            }`}
                                        style={isSelected ? { boxShadow: `0 0 25px ${glowColor}` } : {}}
                                    >
                                        <div className="flex items-center justify-between pointer-events-none">
                                            <span className={`text-lg transition-colors ${isSelected ? c.text : "text-slate-400"}`}>
                                                {emoji} {key === 'root' ? (T.root as any)[language] || T.root.en : key === 'hq_officer' ? (t as any).hq_officer : (t as any)[key]}
                                            </span>
                                            <span className="text-xs">
                                                {isLocked ? (
                                                    <span className="text-slate-600 font-black flex items-center gap-1.5 uppercase">
                                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                        {t.alreadySet}
                                                    </span>
                                                ) : isSelected ? (
                                                    <span className={`${c.text} flex items-center gap-1.5 uppercase transition-all scale-110`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`} />
                                                        Selected
                                                    </span>
                                                ) : null}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 pl-7 opacity-70">{(t as any)[`${key}_desc`]}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <AnimatePresence mode="popLayout" initial={isEditMode}>
                        {role && (
                            <motion.div
                                initial={isEditMode ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex flex-col gap-5 overflow-hidden pt-4 border-t border-slate-800/50"
                            >
                                {/* 공통: 이름 */}
                                <div>
                                    <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.nameTitle}</label>
                                    <input type="text" placeholder={t.nameTitle} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                                </div>

                                {/* 공통: 언어 */}
                                <div>
                                    <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.langTitle}</label>
                                    <select value={language} onChange={e => setLanguage(e.target.value)} className={`${inputCls} appearance-none`}>
                                        {languages.map(lang => (
                                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 공통: 현장 코드/명 */}
                                <div>
                                    <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.siteTitle}</label>
                                    <input type="text" placeholder={t.siteTitle} value={siteCode} onChange={e => setSiteCode(e.target.value)} className={inputCls} />
                                </div>

                                {/* 역할별 필드: 관리자(Title), 근로자(Phone, Trade) */}
                                {role === "worker" ? (
                                    <>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.phoneTitle}</label>
                                            <input type="tel" placeholder="010-0000-0000" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.tradeTitle}</label>
                                            <input type="text" placeholder={t.tradeTitle} value={trade} onChange={e => setTrade(e.target.value)} className={inputCls} />
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.posTitle}</label>
                                        <input type="text" placeholder={t.posTitle} value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {/* 저장 */}
                    <button
                        onClick={handleSave}
                        disabled={loading || !name || !role}
                        className="w-full py-5 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-40"
                    >
                        {loading ? "..." : t.save}
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function SetupProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#070710]" />}>
            <SetupContent />
        </Suspense>
    );
}

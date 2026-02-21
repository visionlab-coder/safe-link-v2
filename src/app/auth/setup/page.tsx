"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { languages } from "@/constants";

type RoleKey = "site_manager" | "safety_officer" | "worker" | "";

const T: any = {
    ko: {
        title: "역할 설정",
        desc: "현장에서 사용할 이름과 역할, 언어를 등록해 주세요.",
        name: "이름 (현장 호칭)",
        lang: "모국어",
        role: "현장 역할",
        site_manager: "현장 소장",
        site_manager_desc: "TBM 작성 및 전파, 근로자 관리 (1명만 등록 가능)",
        safety_officer: "안전관리자",
        safety_officer_desc: "현장 안전 점검 및 TBM 모니터링",
        worker: "현장 근로자",
        worker_desc: "TBM 수신 및 서명, 관리자와 실시간 소통",
        save: "설정 완료하고 시작하기",
        err: "이름, 역할, 언어를 모두 입력해주세요!",
        adminLimit: "현장 소장은 이미 등록되어 있습니다. 다른 역할을 선택해 주세요.",
        alreadySet: "이미 등록됨",
    },
    en: {
        title: "Profile Setup",
        desc: "Enter your name, role, and preferred language.",
        name: "Name",
        lang: "Native Language",
        role: "Site Role",
        site_manager: "Site Manager",
        site_manager_desc: "Write & broadcast TBM, manage workers (1 person only)",
        safety_officer: "Safety Officer",
        safety_officer_desc: "Safety inspection & TBM monitoring",
        worker: "Field Worker",
        worker_desc: "Receive TBM, sign, and communicate with management",
        save: "Complete Setup",
        err: "Please fill in all fields!",
        adminLimit: "A Site Manager is already registered. Please choose another role.",
        alreadySet: "Already registered",
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
};
// DB 저장값 → 리다이렉트 경로
const roleToPath: Record<string, string> = {
    site_manager: "/admin",
    safety_officer: "/admin",
    worker: "/worker",
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
    const [userId, setUserId] = useState<string | null>(null);
    const [adminExists, setAdminExists] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/auth"); return; }
            setUserId(user.id);

            // 현장 소장이 이미 있는지 확인
            const { count } = await supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "HQ_ADMIN");
            setAdminExists((count ?? 0) > 0);
        };
        init();
    }, []);

    const handleSave = async () => {
        if (!role || !language || !name.trim()) { alert(t.err); return; }
        if (role === "site_manager" && adminExists) { alert(t.adminLimit); return; }

        setLoading(true);
        const { error } = await supabase.from("profiles").upsert({
            id: userId,
            display_name: name.trim(),
            role: roleToDb[role],
            preferred_lang: language,
        });
        setLoading(false);

        if (error) { alert(error.message); return; }
        window.location.href = roleToPath[role];
    };

    const inputCls = "w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-lg focus:border-blue-500 outline-none transition-colors";

    const roles: { key: RoleKey; emoji: string; color: string; glowColor: string }[] = [
        { key: "site_manager", emoji: "🏗️", color: "blue", glowColor: "rgba(59,130,246,0.4)" },
        { key: "safety_officer", emoji: "🦺", color: "amber", glowColor: "rgba(245,158,11,0.4)" },
        { key: "worker", emoji: "👷", color: "green", glowColor: "rgba(34,197,94,0.4)" },
    ];

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            <div className="w-full max-w-md p-8 bg-slate-900/80 rounded-[32px] border border-slate-800 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black text-blue-400">{t.title}</h1>
                    <p className="text-slate-500 text-sm mt-2">{t.desc}</p>
                </div>

                <div className="flex flex-col gap-5">
                    {/* 이름 */}
                    <div>
                        <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.name}</label>
                        <input type="text" placeholder={t.name} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                    </div>

                    {/* 언어 */}
                    <div>
                        <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">{t.lang}</label>
                        <select value={language} onChange={e => setLanguage(e.target.value)} className={`${inputCls} appearance-none`}>
                            {languages.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 역할 선택 (3가지) */}
                    <div>
                        <label className="text-xs font-black text-slate-400 mb-2 block uppercase tracking-wider">{t.role}</label>
                        <div className="flex flex-col gap-3">
                            {roles.map(({ key, emoji, color, glowColor }) => {
                                const isLocked = key === "site_manager" && adminExists;
                                const isSelected = role === key;
                                const colorMap: any = {
                                    blue: { border: "border-blue-500", bg: "bg-blue-600/20", text: "text-blue-300" },
                                    amber: { border: "border-amber-500", bg: "bg-amber-600/20", text: "text-amber-300" },
                                    green: { border: "border-green-500", bg: "bg-green-600/20", text: "text-green-300" },
                                };
                                const c = colorMap[color];

                                return (
                                    <button
                                        key={key}
                                        onClick={() => { if (isLocked) { alert(t.adminLimit); return; } setRole(key); }}
                                        disabled={isLocked}
                                        className={`p-4 rounded-2xl font-bold text-left border-2 transition-all ${isSelected
                                                ? `${c.bg} ${c.border}`
                                                : isLocked
                                                    ? "border-slate-800 opacity-35 cursor-not-allowed"
                                                    : `border-slate-700 bg-slate-900 hover:${c.border}`
                                            }`}
                                        style={isSelected ? { boxShadow: `0 0 18px ${glowColor}` } : {}}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-lg ${isSelected ? c.text : "text-slate-300"}`}>
                                                {emoji} {(t as any)[key]}
                                            </span>
                                            <span className="text-xs">
                                                {isLocked ? <span className="text-slate-600">{t.alreadySet}</span> : isSelected ? <span className={c.text}>✓</span> : null}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{(t as any)[`${key}_desc`]}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

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

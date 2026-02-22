"use client";
import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// 관리자 모드: 한국어 / 영어 / 중국어 3개 (그 외 언어는 영어 fallback)
const adminUI: Record<string, any> = {
    ko: {
        board: "실시간 관제 보드",
        boardDesc: "현장 TBM 전파 및 소속 근로자 통신 현황을 확인합니다.",
        tbmTitle: "TBM 전파",
        tbmDesc: "안전 지침을 작성(녹음)하고 모든 외국인 근로자에게 모국어로 일괄 전송합니다.",
        tbmBtn: "새 TBM 작성하기",
        chatTitle: "1:1 실시간 대화",
        chatDesc: "근로자와의 현장 통신을 실시간으로 완벽하게 번역합니다.",
        chatBtn: "대화 채널 열기",
        signOut: "로그아웃",
        roleLabel: { HQ_ADMIN: "현장 소장", SAFETY_OFFICER: "안전관리자", WORKER: "근로자" },
    },
    en: {
        board: "Real-time Control Board",
        boardDesc: "View TBM broadcast status and worker communication on site.",
        tbmTitle: "TBM Broadcast",
        tbmDesc: "Write (or record) safety instructions and send to all workers in their native language.",
        tbmBtn: "Write New TBM",
        chatTitle: "1:1 Live Chat",
        chatDesc: "Real-time translation of field communication including slang.",
        chatBtn: "Open Channel",
        signOut: "Sign out",
        roleLabel: { HQ_ADMIN: "Site Manager", SAFETY_OFFICER: "Safety Officer", WORKER: "Worker" },
    },
    zh: {
        board: "实时控制台",
        boardDesc: "查看TBM广播状态及工人通信情况。",
        tbmTitle: "TBM广播",
        tbmDesc: "撰写（或录音）安全指示，以各工人母语批量发送。",
        tbmBtn: "新建TBM",
        chatTitle: "1对1实时聊天",
        chatDesc: "实时完美翻译现场通信内容。",
        chatBtn: "打开频道",
        signOut: "退出",
        roleLabel: { HQ_ADMIN: "现场主管", SAFETY_OFFICER: "安全管理员", WORKER: "工人" },
    },
};
const getUI = (lang: string) => adminUI[lang] || adminUI["en"];

export default function AdminDashboard() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<{ email: string; role: string; prefLang: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, preferred_lang, display_name")
                    .eq("id", session.user.id)
                    .single();
                setCurrentUser({
                    email: session.user.email || "",
                    role: profile?.role || "",
                    prefLang: profile?.preferred_lang || "en",
                });
            }
        };
        load();
    }, []);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    const lang = currentUser?.prefLang || "en";
    const t = getUI(lang);
    const roleDisplay = currentUser ? ((t.roleLabel as any)[currentUser.role] || currentUser.role) : "";
    // 역할별 색상
    const roleColor = currentUser?.role === "HQ_ADMIN" ? "text-blue-300 border-blue-500/30 bg-blue-500/20"
        : currentUser?.role === "SAFETY_OFFICER" ? "text-amber-300 border-amber-500/30 bg-amber-500/20"
            : "text-slate-300 border-slate-500/30 bg-slate-500/20";

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col gap-6">
                {/* 헤더 */}
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-black tracking-wider text-blue-400">SAFE-LINK</h1>
                    <div className="flex items-center gap-3">
                        {/* 이메일 + 역할 */}
                        {currentUser && (
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{currentUser.email}</span>
                                <span className={`text-[10px] font-black`}>{roleDisplay}</span>
                            </div>
                        )}
                        {/* 역할 뱃지 */}
                        <div className={`px-3 py-1.5 rounded-full font-bold text-xs border ${roleColor}`}>
                            {roleDisplay || "Admin"}
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full text-xs font-bold transition-colors"
                        >
                            {t.signOut}
                        </button>
                    </div>
                </header>

                <h2 className="text-3xl font-bold mb-2">{t.board}</h2>
                <p className="text-slate-400 mb-6">{t.boardDesc}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* TBM 카드 */}
                    <div className="p-8 bg-slate-800/80 rounded-[32px] border border-blue-500/30 hover:border-blue-500/60 transition-colors shadow-lg shadow-blue-900/10">
                        <h3 className="font-bold text-2xl mb-4 text-slate-200">{t.tbmTitle}</h3>
                        <p className="text-slate-400 mb-8">{t.tbmDesc}</p>
                        <button
                            onClick={() => router.push('/admin/tbm/create')}
                            className="px-8 py-4 w-full text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-transform active:scale-95"
                        >
                            {t.tbmBtn}
                        </button>
                    </div>

                    {/* 채팅 카드 */}
                    <div className="p-8 bg-slate-800/80 rounded-[32px] border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <h3 className="font-bold text-2xl mb-4 text-slate-200">{t.chatTitle}</h3>
                        <p className="text-slate-400 mb-8">{t.chatDesc}</p>
                        <button className="px-8 py-4 w-full text-lg font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-transform active:scale-95">
                            {t.chatBtn}
                        </button>
                    </div>

                    {/* 서명 현황 카드 */}
                    <div
                        onClick={() => router.push('/admin/tbm/status')}
                        className="md:col-span-2 p-8 bg-slate-800/80 rounded-[32px] border border-green-500/30 hover:border-green-500/60 transition-colors cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-2xl mb-2 text-slate-200">
                                    {lang === "ko" ? "근로자 서명 현황" : lang === "zh" ? "工人签名状态" : "Worker Signature Status"}
                                </h3>
                                <p className="text-slate-400">
                                    {lang === "ko" ? "TBM 수신 확인 및 서명 완료 여부를 실시간으로 확인합니다." : lang === "zh" ? "实时查看TBM确认及签名完成情况。" : "Check TBM acknowledgement and signature status in real time."}
                                </p>
                            </div>
                            <svg className="w-8 h-8 text-green-400 group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}

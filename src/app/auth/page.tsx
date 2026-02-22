"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// 지원 언어별 UI 텍스트
const T: any = {
    ko: {
        login: "로그인", signup: "회원가입", forgot: "비밀번호 찾기",
        email: "이메일", pass: "비밀번호", passConfirm: "비밀번호 확인",
        backupEmail: "백업 이메일 (선택사항 — 비밀번호 분실 시 복구용)",
        doLogin: "로그인하기", doSignup: "가입 완료하기", doReset: "재설정 메일 보내기",
        backToSelect: "← 처음으로", noMatch: "비밀번호가 일치하지 않습니다.",
        emailSent: "입력하신 이메일로 재설정 링크를 보내드렸습니다.",
        signupOk: "가입 성공! 이제 로그인해 주세요.",
        loginDesc: "이메일과 비밀번호를 입력해주세요.",
        signupDesc: "가입 정보를 입력해주세요.",
        forgotDesc: "가입할 때 사용한 이메일 또는 백업 이메일을 입력하세요.",
        selectTitle: "시작하기",
        selectDesc: "어떻게 시작하시겠어요?",
    },
    en: {
        login: "Login", signup: "Sign Up", forgot: "Forgot Password",
        email: "Email", pass: "Password", passConfirm: "Confirm Password",
        backupEmail: "Backup Email (Optional — for account recovery)",
        doLogin: "Log In", doSignup: "Create Account", doReset: "Send Reset Link",
        backToSelect: "← Back", noMatch: "Passwords do not match.",
        emailSent: "A reset link has been sent to your email.",
        signupOk: "Sign up successful! Please log in.",
        loginDesc: "Enter your email and password.",
        signupDesc: "Enter your details to create an account.",
        forgotDesc: "Enter your email or backup email to recover your account.",
        selectTitle: "Get Started",
        selectDesc: "How would you like to continue?",
    },
    vi: {
        login: "Đăng nhập", signup: "Đăng ký", forgot: "Quên mật khẩu",
        email: "Email", pass: "Mật khẩu", passConfirm: "Xác nhận mật khẩu",
        backupEmail: "Email dự phòng (Tùy chọn — để khôi phục tài khoản)",
        doLogin: "Đăng nhập", doSignup: "Tạo tài khoản", doReset: "Gửi liên kết đặt lại",
        backToSelect: "← Quay lại", noMatch: "Mật khẩu không khớp.",
        emailSent: "Liên kết đặt lại đã được gửi đến email của bạn.",
        signupOk: "Đăng ký thành công! Vui lòng đăng nhập.",
        loginDesc: "Nhập email và mật khẩu của bạn.",
        signupDesc: "Nhập thông tin để tạo tài khoản.",
        forgotDesc: "Nhập email hoặc email dự phòng để khôi phục tài khoản.",
        selectTitle: "Bắt đầu", selectDesc: "Bạn muốn tiếp tục như thế nào?",
    },
    th: {
        login: "เข้าสู่ระบบ", signup: "ลงทะเบียน", forgot: "ลืมรหัสผ่าน",
        email: "อีเมล", pass: "รหัสผ่าน", passConfirm: "ยืนยันรหัสผ่าน",
        backupEmail: "อีเมลสำรอง (ตัวเลือก — สำหรับกู้คืนบัญชี)",
        doLogin: "เข้าสู่ระบบ", doSignup: "สร้างบัญชี", doReset: "ส่งลิงก์รีเซ็ต",
        backToSelect: "← กลับ", noMatch: "รหัสผ่านไม่ตรงกัน",
        emailSent: "ส่งลิงก์รีเซ็ตไปยังอีเมลของคุณแล้ว",
        signupOk: "ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ",
        loginDesc: "กรุณากรอกอีเมลและรหัสผ่าน",
        signupDesc: "กรอกข้อมูลเพื่อสร้างบัญชี",
        forgotDesc: "กรอกอีเมลหรืออีเมลสำรองเพื่อกู้คืนบัญชี",
        selectTitle: "เริ่มต้น", selectDesc: "คุณต้องการดำเนินการอย่างไร?",
    },
};
// 나머지 언어는 영어 fallback
const getT = (lang: string) => T[lang] || T["en"];

type Mode = "select" | "login" | "signup" | "forgot";

function AuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const lang = searchParams.get("lang") || "ko";
    const t = getT(lang);

    const [mode, setMode] = useState<Mode>("select");
    const [loading, setLoading] = useState(false);
    const [existingUser, setExistingUser] = useState<{ email: string; role: string | null } | null>(null);

    // 공통 필드
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // 회원가입 전용
    const [passConfirm, setPassConfirm] = useState("");
    const [backupEmail, setBackupEmail] = useState("");

    // 이미 로그인 중인지 조용히 확인만 (자동으로 이동하지 않음!)
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", session.user.id)
                    .single();
                // 자동으로 이동하지 않고, 현재 로그인 정보만 state에 저장
                setExistingUser({
                    email: session.user.email || "",
                    role: profile?.role || null,
                });
            }
        };
        checkUser();
    }, []);

    // 이미 로그인된 계정으로 계속 진행
    const handleContinueAsExisting = () => {
        if (!existingUser?.role) { router.push(`/auth/setup?lang=${lang}`); return; }
        const path = (existingUser.role === "HQ_ADMIN" || existingUser.role === "SAFETY_OFFICER") ? "/admin" : "/worker";
        router.push(`${path}?lang=${lang}`);
    };

    // 로그아웃 후 새 계정으로
    const handleSwitchAccount = async () => {
        await supabase.auth.signOut();
        setExistingUser(null);
    };

    // ── 로그인 ──
    const handleLogin = async () => {
        if (!email || !password) return;
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); setLoading(false); return; }
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase
                .from("profiles").select("role").eq("id", session.user.id).single();
            // 현장 소장 + 안전관리자 모두 /admin으로
            if (profile?.role === "HQ_ADMIN" || profile?.role === "SAFETY_OFFICER") router.push("/admin");
            else if (profile?.role === "WORKER") router.push("/worker");
            else router.push(`/auth/setup?lang=${lang}`);
        }
        setLoading(false);
    };

    // ── 회원가입 ──
    const handleSignup = async () => {
        if (!email || !password || !passConfirm) return;
        if (password !== passConfirm) { alert(t.noMatch); return; }
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { backup_email: backupEmail || null } }
        });
        if (error) { alert(error.message); setLoading(false); return; }
        alert(t.signupOk);
        setMode("login");
        setPassword(""); setPassConfirm(""); setBackupEmail("");
        setLoading(false);
    };

    // ── 비밀번호 찾기 ──
    const handleForgot = async () => {
        if (!email) return;
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) { alert(error.message); setLoading(false); return; }
        alert(t.emailSent);
        setMode("select");
        setLoading(false);
    };

    const inputCls = "w-full p-4 bg-slate-900/80 border border-slate-700 rounded-2xl text-base focus:border-blue-500 outline-none transition-colors placeholder:text-slate-600";
    const btnPrimary = "w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40";

    // ─────────────────────── RENDER ───────────────────────
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            {/* Logo header */}
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-black tracking-tight">
                    <span className="text-white">SAFE</span>
                    <span className="text-blue-400">-LINK</span>
                </h1>
                <p className="text-[10px] text-slate-600 tracking-[0.3em] uppercase mt-1">Field Communication OS</p>
            </div>

            <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">

                {/* ── MODE: SELECT ── */}
                {mode === "select" && (
                    <div className="flex flex-col gap-4">
                        <div className="mb-4">
                            <h2 className="text-2xl font-black text-white">{t.selectTitle}</h2>
                            <p className="text-slate-500 text-sm mt-1">{t.selectDesc}</p>
                        </div>

                        {/* 이미 로그인된 계정 감지 배너 */}
                        {existingUser && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col gap-3">
                                <p className="text-amber-300 text-sm font-bold flex items-center gap-2">
                                    <span>⚡</span>
                                    <span className="truncate">이미 로그인됨: {existingUser.email}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleContinueAsExisting}
                                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition-all"
                                    >
                                        이 계정으로 계속
                                    </button>
                                    <button
                                        onClick={handleSwitchAccount}
                                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-all"
                                    >
                                        다른 계정으로
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 로그인 버튼 */}
                        <button
                            onClick={() => setMode("login")}
                            className="group flex items-center justify-between p-5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-2xl transition-all"
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-black text-xl text-blue-300">{t.login}</span>
                                <span className="text-sm text-slate-500 mt-0.5">{t.loginDesc}</span>
                            </div>
                            <svg className="w-6 h-6 text-blue-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>

                        {/* 회원가입 버튼 */}
                        <button
                            onClick={() => setMode("signup")}
                            className="group flex items-center justify-between p-5 bg-green-600/10 hover:bg-green-600/20 border border-green-500/30 rounded-2xl transition-all"
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-black text-xl text-green-300">{t.signup}</span>
                                <span className="text-sm text-slate-500 mt-0.5">{t.signupDesc}</span>
                            </div>
                            <svg className="w-6 h-6 text-green-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>

                        {/* 비밀번호 찾기 */}
                        <button
                            onClick={() => setMode("forgot")}
                            className="text-slate-500 hover:text-slate-300 text-sm font-bold text-center mt-2 transition-colors"
                        >
                            🔑 {t.forgot}
                        </button>
                    </div>
                )}

                {/* ── MODE: LOGIN ── */}
                {mode === "login" && (
                    <div className="flex flex-col gap-4">
                        <div className="mb-2">
                            <h2 className="text-2xl font-black text-blue-300">{t.login}</h2>
                            <p className="text-slate-500 text-sm mt-1">{t.loginDesc}</p>
                        </div>
                        <input type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                        <input type="password" placeholder={t.pass} value={password} onChange={e => setPassword(e.target.value)} className={inputCls}
                            onKeyDown={e => e.key === "Enter" && handleLogin()} />
                        <button onClick={handleLogin} disabled={loading || !email || !password} className={btnPrimary}>
                            {loading ? "..." : t.doLogin}
                        </button>
                        <button onClick={() => setMode("select")} className="text-slate-600 hover:text-slate-400 text-sm font-bold text-center mt-1 transition-colors">{t.backToSelect}</button>
                    </div>
                )}

                {/* ── MODE: SIGNUP ── */}
                {mode === "signup" && (
                    <div className="flex flex-col gap-4">
                        <div className="mb-2">
                            <h2 className="text-2xl font-black text-green-300">{t.signup}</h2>
                            <p className="text-slate-500 text-sm mt-1">{t.signupDesc}</p>
                        </div>
                        <input type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                        <input type="password" placeholder={t.pass} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                        <div className="relative">
                            <input type="password" placeholder={t.passConfirm} value={passConfirm} onChange={e => setPassConfirm(e.target.value)} className={`${inputCls} ${passConfirm && passConfirm !== password ? 'border-red-500' : passConfirm && passConfirm === password ? 'border-green-500' : ''}`} />
                            {passConfirm && (
                                <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl ${passConfirm === password ? 'text-green-400' : 'text-red-400'}`}>
                                    {passConfirm === password ? '✓' : '✗'}
                                </span>
                            )}
                        </div>
                        <div>
                            <input type="email" placeholder={t.backupEmail} value={backupEmail} onChange={e => setBackupEmail(e.target.value)} className={inputCls} />
                            <p className="text-[11px] text-slate-600 mt-1.5 ml-1">💡 이메일/비밀번호를 잊었을 때 계정을 복구할 수 있습니다.</p>
                        </div>
                        <button onClick={handleSignup} disabled={loading || !email || !password || !passConfirm} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40">
                            {loading ? "..." : t.doSignup}
                        </button>
                        <button onClick={() => setMode("select")} className="text-slate-600 hover:text-slate-400 text-sm font-bold text-center mt-1 transition-colors">{t.backToSelect}</button>
                    </div>
                )}

                {/* ── MODE: FORGOT ── */}
                {mode === "forgot" && (
                    <div className="flex flex-col gap-4">
                        <div className="mb-2">
                            <h2 className="text-2xl font-black text-yellow-300">🔑 {t.forgot}</h2>
                            <p className="text-slate-500 text-sm mt-1">{t.forgotDesc}</p>
                        </div>
                        <input type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                        <button onClick={handleForgot} disabled={loading || !email} className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40">
                            {loading ? "..." : t.doReset}
                        </button>
                        <button onClick={() => setMode("select")} className="text-slate-600 hover:text-slate-400 text-sm font-bold text-center mt-1 transition-colors">{t.backToSelect}</button>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#070710]" />}>
            <AuthContent />
        </Suspense>
    );
}

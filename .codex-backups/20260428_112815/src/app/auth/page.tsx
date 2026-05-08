"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { languages } from "@/constants";
import { HardHat, ShieldCheck, Info, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { getT } from "./translations";

/** 원시 API 에러를 사용자 친화적 한국어로 변환. 절대 내부 에러 메시지를 그대로 노출하지 않음. */
function sanitizeAuthError(msg: string): string {
  console.error("[Auth] Raw error:", msg);
  const m = msg.toLowerCase();
  if (m.includes("api key") || m.includes("apikey") || m.includes("unauthorized") || m.includes("authentication")) {
    return "서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong password")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (m.includes("already registered") || m.includes("already exists") || m.includes("duplicate")) {
    return "이미 등록된 계정입니다. 로그인을 시도해주세요.";
  }
  if (m.includes("not confirmed") || m.includes("email") && m.includes("confirm")) {
    return "이메일 인증이 필요합니다. 메일함을 확인해주세요.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("connection")) {
    return "네트워크 연결을 확인해주세요.";
  }
  return "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

const DIAL_CODES: Record<string, string> = {
  ko: "+82", vi: "+84", zh: "+86", th: "+66", uz: "+998",
  ph: "+63", km: "+855", id: "+62", mn: "+976", my: "+95",
  ne: "+977", bn: "+880", kk: "+7", ru: "+7", en: "+1",
  jp: "+81", fr: "+33", es: "+34", ar: "+966", hi: "+91",
};

type Mode = "lang" | "role" | "worker" | "admin";

// ─────────────────────────────────────────────────────────────────────────────
// Animated background orbs
// ─────────────────────────────────────────────────────────────────────────────
function BgOrbs() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes safeOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-28px) scale(1.08)}}
        @keyframes safeOrb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-32px,36px) scale(0.93)}}
        @keyframes safeOrb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,28px) scale(1.05)}}
      `}} />
      <div style={{
        position:"absolute",width:560,height:560,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 68%)",
        top:"-18%",left:"-5%",pointerEvents:"none",
        animation:"safeOrb1 11s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:400,height:400,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 68%)",
        bottom:"-5%",right:"-5%",pointerEvents:"none",
        animation:"safeOrb2 13s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:280,height:280,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 68%)",
        top:"42%",right:"15%",pointerEvents:"none",
        animation:"safeOrb3 8s ease-in-out infinite",
      }} />
    </>
  );
}

// ─── Shared panel styles ───────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: "rgba(10,11,20,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  borderRadius: 24,
  boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
};
const accentLine: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)",
};
const fieldBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  transition: "border-color 0.2s",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Auth Content
// ─────────────────────────────────────────────────────────────────────────────
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const urlLang = searchParams.get("lang");
  const [lang, setLang] = useState<string>(urlLang || "");
  const t = getT(lang || "en");

  const [mode, setMode] = useState<Mode>(urlLang ? "role" : "lang");
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<{ email: string; role: string | null } | null>(null);

  const [phone, setPhone] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [password, setPassword] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [countryCode, setCountryCode] = useState(DIAL_CODES[urlLang || "ko"] || "+82");
  const [hoveredLang, setHoveredLang] = useState<string | null>(null);
  const [adminSignupMode, setAdminSignupMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    const savedLang = localStorage.getItem("safe-link-lang");
    if (!urlLang && savedLang) {
      setLang(savedLang);
      setCountryCode(DIAL_CODES[savedLang] || "+82");
      // setMode("role"); // 로컬 저장소가 있어도 항상 언어 선택부터 시작하도록 주석 처리
    }
    
    // URL에 역할(role)이 있으면 즉시 해당 로그인 폼으로 진입 (자동 로그인 방지 및 진입 단계 단축)
    const urlRole = searchParams.get("role");
    if (urlRole === "worker") setMode("worker");
    else if (urlRole === "admin") setMode("admin");
  }, [urlLang, searchParams]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
          setExistingUser({ email: session.user.email || "", role: profile?.role || null });
        }
      } catch {
        await supabase.auth.signOut();
      }
    };
    checkUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자동 로그인 제거 — 기존 세션이 있어도 사용자가 직접 선택하며 진입해야 함
  useEffect(() => {
    // 세션이 있어도 모드를 강제로 'role'로 바꾸지 않음. 
    // 사용자가 언어를 먼저 선택하도록 유도.
  }, [existingUser]);

  const redirectByRoleString = useCallback((role: string | null, activeLang: string) => {
    const targetRole = searchParams.get("role");
    const siteId = searchParams.get("site_id");
    if (!role) {
      router.push(`/auth/setup?lang=${activeLang}${targetRole ? `&role=${targetRole}` : ""}${siteId ? `&site_id=${siteId}` : ""}`);
      return;
    }
    if (role === "ROOT" || role === "HQ_OFFICER") router.push(`/system?lang=${activeLang}`);
    else if (role === "HQ_ADMIN") router.push(`/control?lang=${activeLang}`);
    else if (role === "SAFETY_OFFICER") router.push(`/admin?lang=${activeLang}`);
    else router.push(`/worker?lang=${activeLang}`);
  }, [router, searchParams]);

  const handleLangSelect = (code: string) => {
    setLang(code);
    setCountryCode(DIAL_CODES[code] || "+82");
    localStorage.setItem("safe-link-lang", code);
    setMode("role");
  };

  const getVirtualEmail = (num: string) => `${num.replace(/[^0-9]/g, "")}@safe-link.local`;

  // No auto-login — worker enters fresh every time

  const redirectByRole = async (userId: string) => {
    const activeLang = lang || "ko";
    const { data: profile } = await supabase
      .from("profiles").select("role, phone_number").eq("id", userId).single() as {
        data: { role: string | null; phone_number: string | null } | null
      };
    if (profile && !profile.phone_number) {
      await supabase.from("profiles").update({ phone_number: phone.replace(/[^0-9]/g, "") }).eq("id", userId);
    }
    redirectByRoleString(profile?.role ?? null, activeLang);
  };

  const handleWorkerEnter = async () => {
    if (!phone || !workerName.trim()) return;
    setLoading(true);
    const activeLang = lang || "ko";
    const email = getVirtualEmail(phone);
    const autoPassword = `sl_${phone.replace(/[^0-9]/g, "")}_safe`;
    const phoneDigits = phone.replace(/[^0-9]/g, "");

    // 로그인 시도
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: autoPassword });
    if (signInErr) {
      // 신규 가입 → 즉시 프로필 생성까지 한 번에 처리
      const { error: signUpErr } = await supabase.auth.signUp({
        email, password: autoPassword,
        options: { data: { phone_number: phoneDigits, display_name: workerName.trim() } },
      });
      if (signUpErr) { alert(sanitizeAuthError(signUpErr.message)); setLoading(false); return; }
      const { error: signInErr2 } = await supabase.auth.signInWithPassword({ email, password: autoPassword });
      if (signInErr2) { alert(sanitizeAuthError(signInErr2.message)); setLoading(false); return; }
    }

    // 세션에서 유저 정보 가져와서 프로필 upsert (신규든 기존이든 동일)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      sessionStorage.setItem("safe-link-session-active", "true");
      // 근로자는 setup 페이지를 거치지 않으므로 기본 자동로그인 비활성화
      if (!localStorage.getItem("safe-link-remember")) {
        localStorage.setItem("safe-link-remember", "false");
      }
      await supabase.from("profiles").upsert({
        id: session.user.id,
        display_name: workerName.trim(),
        role: "WORKER",
        preferred_lang: activeLang,
        phone_number: phoneDigits,
      });
      router.push(`/worker?lang=${activeLang}`);
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    if (!adminEmail || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
    if (error) { alert(sanitizeAuthError(error.message)); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      sessionStorage.setItem("safe-link-session-active", "true");
      await redirectByRole(session.user.id);
    }
    setLoading(false);
  };

  const handleAdminSignup = async () => {
    if (!adminEmail || !password || !passConfirm) return;
    if (password !== passConfirm) { alert(t.noMatch); return; }
    setLoading(true);
    const activeLang = lang || "ko";
    const { error: signUpErr } = await supabase.auth.signUp({
      email: adminEmail, password,
      options: { data: { backup_email: backupEmail || null } },
    });
    if (signUpErr) { alert(sanitizeAuthError(signUpErr.message)); setLoading(false); return; }
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
    if (loginErr) { alert(sanitizeAuthError(loginErr.message)); setLoading(false); return; }
    sessionStorage.setItem("safe-link-session-active", "true");
    const targetRole = searchParams.get("role");
    const siteId = searchParams.get("site_id");
    router.push(`/auth/setup?lang=${activeLang}${targetRole ? `&role=${targetRole}` : ""}${siteId ? `&site_id=${siteId}` : ""}`);
    setLoading(false);
  };

  const selectedLangObj = languages.find(l => l.code === lang);

  const Spinner = () => (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
    </span>
  );

  // ── SCREEN 1: LANGUAGE SELECTION ──────────────────────────────────────────
  if (mode === "lang") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ background: "#050508" }}>
        <BgOrbs />
        <div className="w-full max-w-[400px] relative z-10" style={glassCard}>
          <div style={accentLine} />
          <div className="p-7">
            {/* Header */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase">SAFE-LINK · v2.0</span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                SAFE<span className="text-blue-400">-LINK</span>
              </h1>
              <p className="text-[10px] text-slate-600 tracking-[0.4em] uppercase mt-2">Field Communication OS</p>
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-sm font-semibold text-slate-300">언어를 선택하세요</p>
                <p className="text-xs text-slate-600 mt-1">Select Language · 语言选择</p>
              </div>
            </div>

            {/* Language grid — 5 columns */}
            <div className="grid grid-cols-5 gap-2">
              {languages.map((l) => {
                const isHov = hoveredLang === l.code;
                return (
                  <button key={l.code} onClick={() => handleLangSelect(l.code)}
                    onMouseEnter={() => setHoveredLang(l.code)}
                    onMouseLeave={() => setHoveredLang(null)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200"
                    style={{
                      background: isHov ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isHov ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.05)"}`,
                      transform: isHov ? "scale(1.08) translateY(-2px)" : "scale(1)",
                    }}>
                    <div className="w-9 h-6 rounded-md overflow-hidden shadow-md"
                      style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                      <Image src={`https://flagcdn.com/w80/${l.iso}.png`} alt={l.name}
                        width={36} height={24} className="w-full h-full object-cover" unoptimized />
                    </div>
                    <span className="text-[9px] font-bold text-center leading-tight transition-colors duration-200"
                      style={{ color: isHov ? "#93C5FD" : "#4B5563" }}>
                      {l.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-slate-700 mt-5">탭하면 즉시 해당 언어로 전환됩니다</p>
          </div>
        </div>
      </main>
    );
  }

  // ── SCREENS 2-4 (role / worker / admin) ──────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden relative" style={{ background: "#050508" }}>
      <BgOrbs />
      <div className="w-full max-w-[380px] relative z-10">

        {/* Brand + lang chip */}
        <div className="text-center mb-5">
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
            SAFE<span className="text-blue-400">-LINK</span>
          </h1>
          <p className="text-[10px] text-slate-700 tracking-[0.4em] uppercase mt-1.5">Field Communication OS</p>
          {selectedLangObj && (
            <button onClick={() => setMode("lang")}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-slate-200 transition-all duration-200 hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Image src={`https://flagcdn.com/w40/${selectedLangObj.iso}.png`}
                alt={selectedLangObj.name} width={16} height={11} className="rounded-sm" unoptimized />
              <span className="font-medium">{selectedLangObj.name}</span>
              <span className="text-slate-600">· {t.changeLang}</span>
            </button>
          )}
        </div>

        {/* Card */}
        <div style={glassCard} className="overflow-hidden">
          <div style={accentLine} />
          <div className="p-6">

            {/* ── ROLE SCREEN ── */}
            {mode === "role" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-black text-white">{t.chooseRole}</h2>
                  <p className="text-xs text-slate-500 mt-1">{t.chooseRoleDesc}</p>
                </div>

                {existingUser && (
                  <div className="p-4 rounded-2xl"
                    style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-amber-300 text-xs font-bold flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                      <span className="truncate">{existingUser.email}</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => redirectByRoleString(existingUser.role, lang || "ko")}
                        className="flex-1 py-2 text-xs font-black text-slate-900 rounded-xl transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg,#F59E0B,#FCD34D)" }}>
                        이 계정으로 계속
                      </button>
                      <button onClick={async () => { await supabase.auth.signOut(); setExistingUser(null); }}
                        className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl transition-all active:scale-95"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        다른 계정
                      </button>
                    </div>
                  </div>
                )}

                {/* 2-column role split */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMode("worker")}
                    className="group flex flex-col items-center gap-3 p-5 rounded-2xl text-center transition-all duration-300 active:scale-95"
                    style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(16,185,129,0.13)";
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)";
                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(16,185,129,0.07)";
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                      <HardHat className="w-6 h-6" style={{ color: "#6EE7B7" }} />
                    </div>
                    <div>
                      <span className="text-sm font-black block" style={{ color: "#6EE7B7" }}>{t.workerRole}</span>
                      <span className="text-[11px] block mt-0.5 leading-snug" style={{ color: "#475569" }}>{t.workerRoleDesc}</span>
                    </div>
                  </button>

                  <button onClick={() => { setAdminSignupMode(false); setMode("admin"); }}
                    className="group flex flex-col items-center gap-3 p-5 rounded-2xl text-center transition-all duration-300 active:scale-95"
                    style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(59,130,246,0.13)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(59,130,246,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(59,130,246,0.07)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                      <ShieldCheck className="w-6 h-6" style={{ color: "#93C5FD" }} />
                    </div>
                    <div>
                      <span className="text-sm font-black block" style={{ color: "#93C5FD" }}>{t.adminRole}</span>
                      <span className="text-[11px] block mt-0.5 leading-snug" style={{ color: "#475569" }}>{t.adminRoleDesc}</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── WORKER SCREEN ── */}
            {mode === "worker" && (
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <HardHat className="w-5 h-5" style={{ color: "#6EE7B7" }} />
                  </div>
                  <div>
                    <h2 className="text-base font-black" style={{ color: "#6EE7B7" }}>{t.workerTitle}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.workerDesc}</p>
                  </div>
                </div>

                {/* Phone with country code */}
                <div className="flex items-center overflow-hidden" style={fieldBox}>
                  <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-400 outline-none px-3 py-3.5"
                    style={{ borderRight: "1px solid rgba(255,255,255,0.07)", minWidth: 66 }}>
                    {languages.map(l => (
                      <option key={l.code} value={DIAL_CODES[l.code] || "+82"} style={{ background: "#0d0e18" }}>
                        {DIAL_CODES[l.code] || "+82"}
                      </option>
                    ))}
                  </select>
                  <input type="tel" placeholder={t.phone} value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm placeholder-slate-700 outline-none px-3 py-3.5" />
                </div>

                {/* Name */}
                <div style={fieldBox}>
                  <input type="text" placeholder={t.name} value={workerName}
                    onChange={e => setWorkerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleWorkerEnter()}
                    className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                </div>

                {/* Hint */}
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-600" />
                  <p className="text-[11px] text-slate-600 leading-snug">{t.newUser}</p>
                </div>

                {/* CTA */}
                <button onClick={handleWorkerEnter} disabled={loading || !phone || !workerName.trim()}
                  className="w-full py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#059669 0%,#10B981 100%)", boxShadow: "0 4px 24px rgba(16,185,129,0.28)" }}>
                  {loading ? <Spinner /> : t.doEnter}
                </button>

                {/* Back */}
                <button onClick={() => setMode("role")}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-300 transition-colors mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.back}
                </button>
              </div>
            )}

            {/* ── ADMIN SCREEN ── */}
            {mode === "admin" && (
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                    <ShieldCheck className="w-5 h-5" style={{ color: "#93C5FD" }} />
                  </div>
                  <div>
                    <h2 className="text-base font-black" style={{ color: "#93C5FD" }}>
                      {adminSignupMode ? t.doSignup : t.adminTitle}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.adminDesc}</p>
                  </div>
                </div>

                {/* Email */}
                <div style={fieldBox}>
                  <input type="email" placeholder="Email" value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                </div>

                {/* Password */}
                <div style={fieldBox}>
                  <input type="password" placeholder={t.pass} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => !adminSignupMode && e.key === "Enter" && handleAdminLogin()}
                    className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                </div>

                {/* Signup extra fields */}
                {adminSignupMode && (
                  <>
                    <div className="relative" style={{
                      ...fieldBox,
                      border: `1px solid ${passConfirm && passConfirm !== password
                        ? "rgba(239,68,68,0.5)"
                        : passConfirm && passConfirm === password
                          ? "rgba(16,185,129,0.5)"
                          : "rgba(255,255,255,0.08)"}`,
                    }}>
                      <input type="password" placeholder={t.passConfirm} value={passConfirm}
                        onChange={e => setPassConfirm(e.target.value)}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5 pr-11" />
                      {passConfirm && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          {passConfirm === password
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : <XCircle className="w-4 h-4 text-red-400" />
                          }
                        </span>
                      )}
                    </div>
                    <div style={fieldBox}>
                      <input type="email" placeholder={t.backupEmail} value={backupEmail}
                        onChange={e => setBackupEmail(e.target.value)}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                    </div>
                  </>
                )}

                {/* CTA */}
                <button onClick={adminSignupMode ? handleAdminSignup : handleAdminLogin}
                  disabled={loading || !adminEmail || !password || (adminSignupMode && !passConfirm)}
                  className="w-full py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#2563EB 0%,#3B82F6 100%)", boxShadow: "0 4px 24px rgba(59,130,246,0.28)" }}>
                  {loading ? <Spinner /> : adminSignupMode ? t.doSignup : t.doLogin}
                </button>

                {/* Toggle signup/login */}
                <button onClick={() => { setAdminSignupMode(v => !v); setPassConfirm(""); setBackupEmail(""); }}
                  className="text-xs font-semibold text-center text-blue-400 hover:text-blue-300 transition-colors">
                  {adminSignupMode ? t.adminLoginLink : t.adminSignupLink}
                </button>

                {/* Back */}
                <button onClick={() => setMode("role")}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-300 transition-colors mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.back}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050508" }}>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}

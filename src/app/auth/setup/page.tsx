"use client";
import EnglishNameField from "@/components/EnglishNameField";
import { englishNameUI } from "@/lib/english-name";
import { isWorkerBirthDate, workerLoginUI } from "@/lib/worker-login";

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
import { persistDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { setupUI as getT, setupLanguage, SETUP_TRADES as TRADES, displaySetupTrade, findSetupTrade } from "@/lib/profile-setup-ui";

type RoleKey = SetupRoleKey | "";
type ColorKey = "blue" | "amber" | "green" | "purple" | "indigo";
type Step = 1 | 2 | 3;
type SiteOption = { id: string; name: string; site_code?: string | null };

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
  background:"rgba(255,255,255,0.96)",
  border:"1px solid #dbe5f0",
  backdropFilter:"blur(24px)",
  WebkitBackdropFilter:"blur(24px)",
  borderRadius:20,
};
const accentLine: React.CSSProperties = {
  height:1,
  background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.65),transparent)",
};
const fieldBox: React.CSSProperties = {
  background:"#f8fafc",
  border:"1px solid #dbe5f0",
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
                background: step > s.num ? "#10B981" : step === s.num ? "#2563EB" : "#f1f5f9",
                border: `1px solid ${step > s.num ? "#10B981" : step === s.num ? "#2563EB" : "#cbd5e1"}`,
                color: step >= s.num ? "#fff" : "#64748b",
                boxShadow: step === s.num ? "0 0 14px rgba(59,130,246,0.45)" : "none",
              }}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className="max-w-[60px] truncate text-center text-[8px] font-bold leading-tight transition-colors"
              style={{ color: step === s.num ? "#2563EB" : step > s.num ? "#059669" : "#64748b" }}
            >
              {s.label}
            </span>
          </div>
          {idx < 2 && (
            <div
              className="mb-3.5 mx-1.5 h-px flex-1 transition-all duration-300"
              style={{ background: step > s.num ? "#10B981" : "#cbd5e1" }}
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
  const displayLanguage = useDisplayLanguage();

  const language = setupLanguage(displayLanguage);
  const t = getT(language);
  const initSiteId = searchParams.get("site_id") || "";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleKey>(getInitialSetupRole(searchParams.get("role")));
  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [workerBirthDate, setWorkerBirthDate] = useState<string | null>(null);
  const [isWorkerAccount, setIsWorkerAccount] = useState(false);
  const isBirthDateWorker = workerBirthDate !== null;
  const identityReady = isBirthDateWorker ? Boolean(name.trim()) : nameReady;
  const [nameError, setNameError] = useState(false);
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
      setIsWorkerAccount(user.roles.length === 1 && user.roles[0] === "WORKER");
      setWorkerBirthDate(user.roles.length === 1 && user.roles[0] === "WORKER"
        && isWorkerBirthDate(user.workerBirthDate || "") ? user.workerBirthDate! : null);
      const saved = user.profileDetails;
      if (saved) {
        setTitle(saved.title || "");
        setTrade(saved.trade || "");
        setPhone(saved.phoneNumber || "");
        setSiteCode(saved.siteCode || "");
        if (saved.activeSiteId != null) setSelectedSiteId(String(saved.activeSiteId));
      }
      if (user.roles.length === 1 && user.roles[0] === "WORKER" && saved?.activeSiteId == null && user.siteIds.length === 1) {
        setSelectedSiteId(String(user.siteIds[0]));
      }
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

  const isAdminSiteRole = role === "site_manager" || role === "safety_officer" || role === "gongmu";
  const canProceedStep1 = () => Boolean(identityReady && role);
  const canProceedStep2 = () => {
    if (isWorkerAccount && role === "worker" && !siteList.some(site => site.id === selectedSiteId)) return false;
    if (isBirthDateWorker && role === "worker") return siteList.some(site => site.id === selectedSiteId);
    if (role === "worker" && (!trade || (!isWorkerAccount && !siteCode))) return false;
    if (isAdminSiteRole) {
      if (!title) return false;
      return siteList.length > 0 ? Boolean(selectedSiteId) : Boolean(siteCode);
    }
    if ((role === "root" || role === "hq_officer") && !title) return false;
    return true;
  };

  const handleSave = useCallback(async () => {
    if (!role || !identityReady) {
      setNameError(true); setStep(1);
      return;
    }
    const finalName = name.trim();

    if ((isMasterEmail || isHQAuthorized) && role === "worker") {
      alert(t.adminAccountWorker);
      setRole(isMasterEmail ? "root" : "hq_officer");
      return;
    }
    if (role === "site_manager" && adminExists && !isEditMode) {
      alert(t.adminLimit);
      return;
    }
    if (role === "worker" && !isBirthDateWorker && (!trade || !phone)) {
      alert(t.err);
      return;
    }
    if (isWorkerAccount && role === "worker" && !siteList.some(site => site.id === selectedSiteId)) {
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
        siteCode: (isWorkerAccount ? siteList.find(site => site.id === resolvedSiteId)?.name : siteCode.trim()) || undefined,
        siteId: resolvedSiteId || undefined,
      });

      if (rememberMe) {
        localStorage.setItem("safe-link-remember", "true");
        localStorage.setItem("safe-link-lang", language);
      } else {
        localStorage.setItem("safe-link-remember", "false");
      }
      persistDisplayLanguage(language);
      sessionStorage.setItem("safe-link-session-active", "true");

      const serverRole = pickDefaultV3Role(user.roles);
      const redirectPath = serverRole
        ? getDefaultRouteForProfileRole(serverRole as ProfileRole)
        : getDefaultRouteForProfileRole(getProfileRoleFromSetupRole(role));
      window.location.href = `${redirectPath}?lang=${language}`;
    } catch {
      alert(t.saveFailed);
      setLoading(false);
    }
  }, [
    adminExists,
    initSiteId,
    isAdminSiteRole,
    isEditMode,
    isHQAuthorized,
    isMasterEmail,
    identityReady,
    isBirthDateWorker,
    isWorkerAccount,
    siteList,
    language,
    name,
    phone,
    rememberMe,
    role,
    selectedSiteId,
    siteCode,
    t.adminLimit,
    t.adminAccountWorker,
    t.err,
    t.saveFailed,
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
    blue:   { border:"#60a5fa", bg:"#f8fbff", activeBg:"#eff6ff", text:"#1d4ed8" },
    amber:  { border:"#fbbf24", bg:"#fffdf7", activeBg:"#fffbeb", text:"#b45309" },
    green:  { border:"#4ade80", bg:"#f7fef9", activeBg:"#ecfdf5", text:"#047857" },
    purple: { border:"#c084fc", bg:"#fdfaff", activeBg:"#faf5ff", text:"#7e22ce" },
    indigo: { border:"#818cf8", bg:"#fafaff", activeBg:"#eef2ff", text:"#4338ca" },
  };

  return (
    <main lang={language === "jp" ? "ja" : language === "ph" ? "fil" : language} dir={language === "ar" ? "rtl" : "ltr"} className="relative flex min-h-screen flex-col items-center justify-center overflow-clip bg-[#eef3f8] p-5">
      <BgOrbs />
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-5 text-center">
          <h1 className="text-[28px] font-black leading-none tracking-tighter text-[#172033]">
            SQ<span style={{ color:"#2563EB" }}> LINK</span>
          </h1>
          <p className="mt-1 text-[9px] uppercase tracking-[0.4em] text-slate-500">
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
                          className="rounded-xl p-3 text-start font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-20"
                          style={{
                            background: isSelected ? c.activeBg : c.bg,
                            border:`1px solid ${isSelected ? c.border : "#dbe5f0"}`,
                            boxShadow: isSelected ? `0 8px 18px ${glow}` : "none",
                          }}
                        >
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="text-base">{emoji}</span>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[8px] font-black uppercase" style={{ color: c.text }}>
                                <span className="h-1 w-1 animate-pulse rounded-full bg-current" />{t.selected}
                              </span>
                            )}
                            {isLocked && <span className="text-[8px] font-black uppercase" style={{ color:"#334155" }}>{t.alreadySet}</span>}
                          </div>
                          <span className="block text-[11px] font-black" style={{ color: isSelected ? c.text : "#64748B" }}>
                            {t[key as string] || key}
                          </span>
                          <p className="mt-0.5 text-[9px] leading-tight" style={{ color:"#64748B" }}>
                            {t[`${key as string}_desc`]}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {isBirthDateWorker ? (
                    <div className="space-y-2 text-sm text-slate-700">
                      <label htmlFor="worker-birth-login" className="block font-bold">{englishNameUI(language).loginId} · {workerLoginUI(language).birth}</label>
                      <input id="worker-birth-login" value={workerBirthDate || ""} readOnly dir="ltr"
                        className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700" />
                      <p className="text-xs leading-relaxed">{workerLoginUI(language).hint}</p>
                    </div>
                  ) : (
                    <EnglishNameField language={language} value={name} onChange={setName} onReadyChange={setNameReady} />
                  )}
                  {nameError && !identityReady && <p role="alert" className="text-sm text-red-700">{englishNameUI(language).error}</p>}

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                      {t.langTitle}
                    </label>
                    <div style={fieldBox}>
                      <select
                        value={language}
                        onChange={(event) => persistDisplayLanguage(event.target.value)}
                        aria-label={t.langTitle}
                        className="w-full appearance-none bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none"
                        style={{ color:"#1e293b" }}
                      >
                        {languages.map((lang) => (
                          <option key={lang.code} value={lang.code} style={{ background:"#fff" }}>
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
                      {isWorkerAccount || ((isAdminSiteRole || isMasterEmail || isHQAuthorized) && siteList.length > 0)
                        ? t.selectSite
                        : t.siteTitle}
                    </label>
                    {isWorkerAccount || ((isAdminSiteRole || isMasterEmail || isHQAuthorized) && siteList.length > 0) ? (
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
                            className="w-full appearance-none bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none"
                            style={{ color: selectedSiteId ? "#1e293b" : "#64748b" }}
                          >
                            <option value="" style={{ background:"#fff" }}>
                              {t.sitePrompt}
                            </option>
                            {siteList.map((site) => (
                              <option key={site.id} value={site.id} style={{ background:"#fff" }}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedSiteId && (
                          <p className="ml-1 mt-1.5 text-[10px]" style={{ color:"#22C55E" }}>
                            ✓ {t.siteSelected}
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
                          className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    )}
                  </div>

                  {role === "worker" ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color:"#475569" }}>
                          {t.phoneTitle}
                        </label>
                        <div style={fieldBox}>
                          <input
                            type="tel"
                            placeholder="010-0000-0000"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
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
                            value={displaySetupTrade(trade, language)}
                            onChange={(event) => setTrade(event.target.value)}
                            className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {TRADES.map(({ ko, label }) => {
                            const displayLabel = label[language] || label.en || ko;
                            const isSelected = findSetupTrade(trade)?.ko === ko;
                            return (
                              <button
                                key={ko}
                                onClick={() => setTrade(ko)}
                                className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all duration-200"
                                style={{
                                  background: isSelected ? "#2563EB" : "#fff",
                                  border:`1px solid ${isSelected ? "#3B82F6" : "#dbe5f0"}`,
                                  color: isSelected ? "#fff" : "#475569",
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
                          className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-1 flex gap-2.5">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl px-5 py-3.5 text-sm font-black transition-all active:scale-95"
                      style={{ background:"#f8fafc", border:"1px solid #dbe5f0", color:"#475569" }}
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
                  <div className="flex items-center gap-3 rounded-xl p-4" style={{ background:"#f8fafc", border:"1px solid #dbe5f0" }}>
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)" }}>
                      {role === "worker" ? "👷" : role === "safety_officer" ? "🦺" : role === "site_manager" ? "🏗️" : role === "root" ? "💎" : "🏢"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">{name || "—"}</p>
                      <p className="mt-0.5 truncate text-[11px]" style={{ color:"#64748B" }}>
                        {t[role as string] || role} · {siteCode || "—"}
                      </p>
                      {role === "worker" && trade && (
                        <span className="mt-1 inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold" style={{ background:"rgba(59,130,246,0.12)", color:"#93C5FD", border:"1px solid rgba(59,130,246,0.2)" }}>
                          {displaySetupTrade(trade, language)}
                        </span>
                      )}
                    </div>
                  </div>

                  <label
                    className="flex cursor-pointer select-none items-center gap-3.5 rounded-xl p-4 transition-all duration-200"
                    style={{ background:"#f8fbff", border:`2px solid ${rememberMe ? "#93c5fd" : "#dbe5f0"}` }}
                    onClick={() => setRememberMe((value) => !value)}
                  >
                    <div className="relative flex-shrink-0" style={{ width:48, height:26 }}>
                      <div className="h-full w-full rounded-full transition-all duration-300" style={{ background: rememberMe ? "#3B82F6" : "#cbd5e1" }} />
                      <div className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-lg transition-all duration-300" style={{ left: rememberMe ? 24 : 2 }} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-black text-slate-800">{t.rememberMe}</span>
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
                      {t.autoEnabled}
                    </motion.p>
                  )}

                  <div className="mt-1 flex gap-2.5">
                    <button
                      onClick={() => setStep(2)}
                      className="rounded-xl px-5 py-3.5 text-sm font-black transition-all active:scale-95"
                      style={{ background:"#f8fafc", border:"1px solid #dbe5f0", color:"#475569" }}
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
              {t.deleteAccount}
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
      <div className="flex min-h-screen items-center justify-center bg-[#eef3f8]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}

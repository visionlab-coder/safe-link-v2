"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { HardHat, ShieldCheck } from 'lucide-react';
import { languages } from '@/constants';
import BrandLogo from '@/components/BrandLogo';

const startBtnText: Record<string, string> = {
  ko: "시작하기",
  en: "Start",
  vi: "Bắt đầu",
  zh: "开始",
  th: "เริ่มต้น",
  uz: "Boshlash",
  ph: "Simulan",
  km: "Start",
  id: "Mulai",
  mn: "Start",
  my: "Start",
  ne: "Start",
  bn: "Start",
  kk: "Start",
  ru: "Start",
  jp: "Start",
  fr: "Start",
  es: "Start",
  ar: "Start",
  hi: "Start",
};

const roleTexts: Record<string, any> = {
  ko: { admin: "관리자", worker: "현장 근로자", selectRole: "역할을 선택하세요" },
  en: { admin: "Administrator", worker: "Field Worker", selectRole: "Select your role" },
  vi: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  zh: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  th: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  uz: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  ph: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  km: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  id: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  mn: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  my: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  ne: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  bn: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  kk: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  ru: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  jp: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  fr: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  es: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  ar: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
  hi: { admin: "Admin", worker: "Worker", selectRole: "Select your role" },
};

function LandingPageInner() {
  const [selectedLang, setSelectedLang] = useState("ko");
  const [showRoles, setShowRoles] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // QR 吏꾩엯: role怨?site_id瑜?URL?먯꽌 ?쎌뼱 auth濡?諛붾줈 ?꾨떖
  const qrRole = searchParams.get("role");
  const qrSiteId = searchParams.get("site_id");

  useEffect(() => {
    if (qrRole === "admin") {
      // 愿由ъ옄 QR: ??븷 踰꾪듉 ?먮룞 ?쒖떆
      setShowRoles(true);
    }
  // selectedLang ?섏〈 ?쒓굅 ??珥덇린媛?"ko"濡?由щ떎?대젆?? ?몄뼱???댄썑 ?좏깮
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrRole, qrSiteId, router]);

  const startText = startBtnText[selectedLang] || "Start";
  const rt = roleTexts[selectedLang] || roleTexts.en;

  const buildAuthUrl = (role: "admin" | "worker") => {
    if (role === "worker" && qrRole === "worker") {
      const params = new URLSearchParams({ lang: selectedLang });
      if (qrSiteId) params.set("site_id", qrSiteId);
      return `/qr/site?${params.toString()}`;
    }
    const params = new URLSearchParams({ lang: selectedLang, role });
    if (qrSiteId) params.set("site_id", qrSiteId);
    return `/auth?${params.toString()}`;
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-mesh p-4 py-10 selection:bg-blue-500/30">

      {/* ?뭿 Background Ambient Lights */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[160px] rounded-full pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none animate-float" />

      <div className="z-10 w-full max-w-lg flex flex-col items-center">

        {/* Brand Header */}
        <div className="relative mb-16 flex flex-col items-center select-none animate-float">
          <BrandLogo compact={false} imageClassName="max-w-[260px] md:max-w-[330px] mb-7" />
          <div className="relative">
            <div className="absolute -inset-8 blur-[100px] bg-blue-600/30 rounded-full pointer-events-none" />
            <h1 className="relative text-8xl md:text-9xl font-bold tracking-tighter leading-none italic">
              <span className="text-white text-gradient">SAFE</span>
              <span className="text-blue-500 drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]">-</span>
              <span className="text-blue-500 text-shadow-glow">LINK</span>
            </h1>
          </div>

          <div className="mt-6 px-6 py-2 glass-card rounded-full flex items-center gap-3 tech-border">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]" />
            <p className="text-[10px] text-blue-100 font-black tracking-[0.5em] uppercase">
              Global Field OS v2.0
            </p>
          </div>
        </div>

        {/* ?? Language Picker ?? */}
        <div className="relative mb-10 h-44 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
          <Image
            src="/images/safelink-pages/landing-poc-hero.png"
            alt="SAFE-LINK field safety platform"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </div>

        <div className="w-full mb-12 glass-card rounded-[48px] p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

          <p className="text-center text-[10px] font-black text-blue-400/60 tracking-[0.4em] mb-10 uppercase relative">
            Select Service Country
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-10 gap-x-4 relative">
            {languages.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className="flex flex-col items-center gap-3 group tap-effect"
                >
                  <div className={`
                    relative flex-shrink-0 rounded-3xl transition-all duration-500
                    ${isSelected
                      ? 'p-[3px] bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_15px_30px_-5px_rgba(59,130,246,0.6)] -translate-y-2'
                      : 'p-[1px] bg-white/10 hover:bg-white/20'
                    }
                  `}>
                    <div className="w-14 h-10 md:w-16 md:h-12 rounded-[21px] overflow-hidden bg-slate-900 border border-black/20">
                      <Image
                        src={`https://flagcdn.com/w160/${lang.iso}.png`}
                        alt={lang.name}
                        width={160}
                        height={120}
                        className="w-full h-full object-cover block"
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase tracking-tighter leading-tight text-center transition-all duration-300 ${isSelected ? 'text-blue-400 scale-110' : 'text-slate-600 group-hover:text-slate-400'}`}>
                    {lang.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start / Role Selection Section */}
        <div className="w-full px-4 relative flex flex-col items-center gap-6">
          {!showRoles ? (
            <button
              onClick={() => qrRole === "worker" ? router.push(buildAuthUrl("worker")) : setShowRoles(true)}
              className="group w-full max-w-[320px] py-6 glass-blue rounded-[32px] text-white font-black text-2xl transition-all duration-500 tap-effect shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-4 relative overflow-hidden tech-border"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative text-gradient">{startText.toUpperCase()}</span>
              <svg className="w-6 h-6 text-white group-hover:translate-x-2 transition-transform relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ) : (
            <div className="w-full max-w-sm flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-center text-[10px] font-black text-blue-400/70 tracking-[0.4em] uppercase mb-1">
                {rt.selectRole}
              </p>

              {/* Admin role card */}
              <button
                onClick={() => router.push(buildAuthUrl("admin"))}
                className="group w-full glass-card rounded-2xl p-5 transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/5 hover:shadow-[0_8px_32px_rgba(59,130,246,0.15)] tap-effect"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-base font-black text-white group-hover:text-blue-300 transition-colors block">{rt.admin}</span>
                    <span className="text-xs text-slate-600 group-hover:text-slate-500 transition-colors">Admin / Safety Officer</span>
                  </div>
                  <svg className="w-4 h-4 text-slate-700 group-hover:text-blue-400 ml-auto transition-all duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Worker role card */}
              <button
                onClick={() => router.push(buildAuthUrl("worker"))}
                className="group w-full glass-card rounded-2xl p-5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-emerald-600/5 hover:shadow-[0_8px_32px_rgba(16,185,129,0.15)] tap-effect"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                    <HardHat className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-base font-black text-white group-hover:text-emerald-300 transition-colors block">{rt.worker}</span>
                    <span className="text-xs text-slate-600 group-hover:text-slate-500 transition-colors">Field Worker / 현장 근로자</span>
                  </div>
                  <svg className="w-4 h-4 text-slate-700 group-hover:text-emerald-400 ml-auto transition-all duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => setShowRoles(false)}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-semibold hover:text-slate-300 transition-colors mt-1 mx-auto"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Language
              </button>
            </div>
          )}

          <div className="flex flex-col items-center gap-1 opacity-30">
            <p className="text-[10px] text-slate-500 tracking-[0.5em] uppercase font-black">
              Powered by SAFE-LINK Engine
            </p>
            <p className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">
              짤 2026 NEXT-GEN FIELD COMMUNICATION
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .text-shadow-glow {
            text-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </main>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-mesh" />}>
      <LandingPageInner />
    </Suspense>
  );
}




"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { languages } from '@/constants';

const startBtnText: Record<string, string> = {
  vi: "Bắt đầu", zh: "开始", th: "เริ่ม",
  uz: "Boshlash", ph: "Simulan", km: "ចាប់ផ្តើម",
  id: "Mulai", mn: "Эхлэх", my: "စတင်ရန်",
  ne: "सुरु गर्नुहोस्", bn: "শুরু করুন", kk: "Бастау",
  ru: "Начать", en: "Start", ko: "시스템 시작하기",
  jp: "スタート", fr: "Démarrer", es: "Iniciar",
  ar: "ابدأ", hi: "शुरू करें",
};

export default function LandingPage() {
  const [selectedLang, setSelectedLang] = useState("ko");
  const router = useRouter();

  const startText = startBtnText[selectedLang] || "Start";

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#070710] p-4 py-10">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-700/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="z-10 w-full max-w-lg flex flex-col items-center">

        {/* Brand Header — Clean Premium Design */}
        <div className="relative mb-12 flex flex-col items-center select-none">

          {/* Main Logo */}
          <div className="relative">
            {/* Deep blur glow behind */}
            <div className="absolute -inset-4 blur-3xl bg-blue-600/20 rounded-full pointer-events-none" />

            <h1 className="relative text-7xl md:text-8xl font-black tracking-tight leading-none">
              {/* SAFE = 흰색 (밝고 깔끔한 느낌) */}
              <span className="text-white drop-shadow-[0_2px_15px_rgba(255,255,255,0.3)]">
                SAFE
              </span>
              {/* - = 파란색 구분자 */}
              <span className="text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.9)]">-</span>
              {/* LINK = 파란색 (액션, 연결의 느낌) */}
              <span className="text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.7)]">
                LINK
              </span>
            </h1>
          </div>

          {/* Badge-style subtitle */}
          <div className="mt-4 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <p className="text-[10px] text-slate-400 font-black tracking-[0.4em] uppercase">
              Field Communication OS
            </p>
          </div>
        </div>

        {/* ── Language Picker ── */}
        <div className="w-full mb-10">
          <p className="text-center text-[10px] font-black text-slate-600 tracking-[0.25em] mb-6 uppercase">
            ─── Choose Your Country ───
          </p>

          {/* 4-column responsive grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-7 gap-x-2 px-2">
            {languages.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className="flex flex-col items-center gap-2 group"
                >
                  {/* Flag circle */}
                  {/* Outer ring glow */}
                  <div className={`
                    relative flex-shrink-0 rounded-full transition-all duration-300
                    ${isSelected
                      ? 'p-[3px] bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_22px_6px_rgba(59,130,246,0.5)] scale-110'
                      : 'p-[2px] bg-slate-800 hover:bg-slate-700 hover:scale-105'
                    }
                  `}>
                    {/* Inner circle clipping the flag */}
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-slate-900">
                      <img
                        src={`https://flagcdn.com/w160/${lang.iso}.png`}
                        alt={lang.name}
                        className="w-full h-full object-cover object-center block"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  {/* Country name */}
                  <span className={`text-[9px] font-black uppercase tracking-wider leading-tight text-center transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'
                    }`}>
                    {lang.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => router.push(`/auth?lang=${selectedLang}`)}
          className="group w-full max-w-sm py-5 px-8 bg-white hover:bg-blue-50 text-slate-950 font-black rounded-full text-xl md:text-2xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_10px_40px_-10px_rgba(255,255,255,0.25)] flex items-center justify-center gap-3"
        >
          {startText}
          <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        <p className="mt-6 text-[10px] text-slate-700 tracking-widest uppercase">
          © 2025 SAFE-LINK · All rights reserved
        </p>
      </div>
    </main>
  );
}

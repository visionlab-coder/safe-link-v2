"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { languages } from '@/constants';

const startBtnText: Record<string, string> = {
  vi: "Bắt đầu", zh: "开始", th: "เริ่ม",
  uz: "Boshlash", ph: "Simulan", km: "ចាប់ផ្តើម",
  id: "Mulai", mn: "Эхлэх", my: "စတင်ရန်",
  ne: "सुरु गर्नुहोस्", bn: "شুরু করুন", kk: "Бастау",
  ru: "Начать", en: "Start", ko: "시스템 시작하기",
  jp: "スタート", fr: "Démarrer", es: "Iniciar",
  ar: "ابدأ", hi: "शुरू करें",
};

export default function LandingPage() {
  const [selectedLang, setSelectedLang] = useState("ko");
  const router = useRouter();

  const startText = startBtnText[selectedLang] || "Start";

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-mesh p-4 py-10 selection:bg-blue-500/30">

      {/* 💎 Background Ambient Lights */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[160px] rounded-full pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none animate-float" />

      <div className="z-10 w-full max-w-lg flex flex-col items-center">

        {/* Brand Header */}
        <div className="relative mb-16 flex flex-col items-center select-none animate-float">
          <div className="relative">
            <div className="absolute -inset-8 blur-[100px] bg-blue-600/30 rounded-full pointer-events-none" />
            <h1 className="relative text-8xl md:text-9xl font-black tracking-tighter leading-none italic">
              <span className="text-white text-gradient">SAFE</span>
              <span className="text-blue-500 drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]">-</span>
              <span className="text-blue-500 text-shadow-glow">LINK</span>
            </h1>
          </div>

          <div className="mt-6 px-6 py-2 glass rounded-full border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] text-slate-400 font-black tracking-[0.5em] uppercase">
              Global Field OS v2.0
            </p>
          </div>
        </div>

        {/* ── Language Picker ── */}
        <div className="w-full mb-12 glass rounded-[48px] p-8 border-white/5 shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-[48px] pointer-events-none" />

          <p className="text-center text-[10px] font-black text-slate-500 tracking-[0.4em] mb-10 uppercase relative">
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
                      <img
                        src={`https://flagcdn.com/w160/${lang.iso}.png`}
                        alt={lang.name}
                        className="w-full h-full object-cover block"
                        loading="lazy"
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

        {/* Start Button */}
        <div className="w-full px-4 relative flex flex-col items-center gap-6">
          <button
            onClick={() => router.push(`/auth?lang=${selectedLang}`)}
            className="group w-full max-w-[320px] py-6 glass rounded-[32px] border-blue-500/50 hover:border-blue-400 bg-blue-600/10 hover:bg-blue-600/20 text-white font-black text-2xl transition-all duration-500 tap-effect shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span className="relative text-gradient">{startText.toUpperCase()}</span>
            <svg className="w-6 h-6 text-blue-400 group-hover:translate-x-2 transition-transform relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <div className="flex flex-col items-center gap-1 opacity-30">
            <p className="text-[10px] text-slate-500 tracking-[0.5em] uppercase font-black">
              Powered by SAFE-LINK Engine
            </p>
            <p className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">
              © 2026 NEXT-GEN FIELD COMMUNICATION
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

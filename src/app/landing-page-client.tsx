"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, HardHat, Languages, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { languages } from "@/constants";
import BrandLogo from "@/components/BrandLogo";

const startText: Record<string, string> = { ko: "본인 확인 시작", en: "Start verification", vi: "Bắt đầu", zh: "开始验证", th: "เริ่มต้น", uz: "Boshlash" };
const roleText: Record<string, { admin: string; worker: string; prompt: string }> = {
  ko: { admin: "관리자", worker: "현장 근로자", prompt: "이용할 서비스를 선택하세요" },
  en: { admin: "Administrator", worker: "Field worker", prompt: "Choose your service" },
  vi: { admin: "Quản trị viên", worker: "Công nhân", prompt: "Chọn dịch vụ" },
  zh: { admin: "管理员", worker: "现场工人", prompt: "选择服务" },
};

function LandingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLang, setSelectedLang] = useState("ko");
  const [showRoles, setShowRoles] = useState(false);
  const qrRole = searchParams.get("role");
  const qrSiteId = searchParams.get("site_id");

  useEffect(() => { if (qrRole === "admin") setShowRoles(true); }, [qrRole]);

  const text = roleText[selectedLang] || roleText.en;
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

  return <main className="min-h-screen bg-[#eef3f8] text-[#172033]">
    <header className="flex h-[72px] items-center justify-between border-b border-[#d9e1ea] bg-white px-5 sm:px-8 lg:px-12">
      <div className="flex items-center gap-4"><BrandLogo compact imageClassName="!w-[124px] max-w-none" /><span className="hidden border-l border-[#d9e1ea] pl-4 text-xs font-black tracking-[.18em] text-[#063789] sm:block">SQ-LINK</span></div>
      <span className="flex items-center gap-2 text-[11px] font-bold text-[#526076]"><i className="h-2 w-2 rounded-full bg-[#07835a]" />FIELD SAFETY OS</span>
    </header>

    <section className="mx-auto grid max-w-[1180px] gap-7 px-4 py-7 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)] lg:items-center lg:gap-12 lg:px-12 lg:py-14">
      <div className="order-2 lg:order-1">
        <p className="text-[11px] font-black tracking-[.2em] text-[#0b5ed7]">SECURE ACCESS</p>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#063789] sm:text-4xl">이름 중심의 간단하고<br />안전한 현장 입장</h1>
        <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-[#526076]">근로자의 선호 언어와 현장 배정을 확인한 뒤, 필요한 안전 업무를 바로 시작합니다.</p>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[['오늘 인증', '286명'], ['승인 대기', '4명'], ['인증률', '98.6%']].map(([label, value]) => <div key={label} className="rounded-lg border border-[#d9e1ea] bg-white p-3 shadow-sm"><span className="block text-[10px] font-bold text-[#758195]">{label}</span><strong className="mt-1 block text-lg font-black text-[#063789] sm:text-xl">{value}</strong></div>)}
        </div>

        <div className="mt-5 rounded-xl border border-[#d9e1ea] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] pb-4"><div><h2 className="text-sm font-black">언어 선택</h2><p className="mt-1 text-[11px] text-[#758195]">근로자의 선호 언어로 서비스를 시작합니다.</p></div><Languages className="h-5 w-5 shrink-0 text-[#0b5ed7]" /></div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {languages.map((language) => { const active = selectedLang === language.code; return <button key={language.code} onClick={() => setSelectedLang(language.code)} className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-lg border px-1 transition ${active ? "border-[#0b5ed7] bg-[#e9f2ff] text-[#063789]" : "border-[#edf1f5] bg-white text-[#526076] hover:border-[#bed7fa]"}`}><Image src={`/flags/${language.iso}.png`} alt={language.name} width={28} height={19} className="h-[19px] w-7 rounded object-cover" /><span className="text-[9px] font-bold leading-tight">{language.name}</span></button>; })}
          </div>
        </div>

        {!showRoles ? <button onClick={() => qrRole === "worker" ? router.push(buildAuthUrl("worker")) : setShowRoles(true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0b5ed7] px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(11,94,215,.2)] transition hover:bg-[#063789] sm:w-auto">{startText[selectedLang] || "Start verification"}<ChevronRight className="h-4 w-4" /></button> : <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={() => router.push(buildAuthUrl("admin"))} className="flex items-center gap-3 rounded-lg border border-[#d9e1ea] bg-white p-4 text-left transition hover:border-[#0b5ed7] hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e9f2ff] text-[#0b5ed7]"><ShieldCheck className="h-5 w-5" /></span><span><b className="block text-sm">{text.admin}</b><small className="mt-1 block text-[11px] text-[#758195]">현장 운영 및 안전관리</small></span></button>
          <button onClick={() => router.push(buildAuthUrl("worker"))} className="flex items-center gap-3 rounded-lg border border-[#d9e1ea] bg-white p-4 text-left transition hover:border-[#07835a] hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#edf9f4] text-[#07835a]"><HardHat className="h-5 w-5" /></span><span><b className="block text-sm">{text.worker}</b><small className="mt-1 block text-[11px] text-[#758195]">교육 확인 및 안전 업무</small></span></button>
          <p className="sm:col-span-2 text-center text-xs font-medium text-[#758195]">{text.prompt}</p>
        </div>}
      </div>

      <div className="order-1 overflow-hidden rounded-xl border border-[#cdd6e2] bg-white shadow-[0_14px_36px_rgba(16,42,67,.13)] lg:order-2">
        <div className="relative min-h-[230px] sm:min-h-[300px]"><picture><source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/access.webp" /><Image src="/images/mobile-v3/website/access.webp" alt="SQ-LINK 로그인 및 본인 확인" fill priority className="object-cover" /></picture><div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[10px] font-black tracking-[.18em] text-blue-200">SECURE ACCESS</p><strong className="mt-1 block text-xl font-black">로그인 · 본인 확인</strong><span className="mt-1 block text-xs text-slate-100">웹과 모바일에서 같은 흐름으로 시작합니다.</span></div></div>
        <ol className="divide-y divide-[#edf1f5] p-4"><li className="flex gap-3 py-2"><b className="grid h-6 w-6 place-items-center rounded-md bg-[#0b5ed7] text-[10px] text-white">1</b><span><strong className="block text-xs">정보 확인</strong><small className="text-[11px] text-[#758195]">이름과 최소 정보를 확인합니다.</small></span></li><li className="flex gap-3 py-2"><b className="grid h-6 w-6 place-items-center rounded-md bg-[#0b5ed7] text-[10px] text-white">2</b><span><strong className="block text-xs">현장 연결</strong><small className="text-[11px] text-[#758195]">배정 현장을 자동으로 확인합니다.</small></span></li><li className="flex gap-3 py-2"><b className="grid h-6 w-6 place-items-center rounded-md bg-[#0b5ed7] text-[10px] text-white">3</b><span><strong className="block text-xs">입장 완료</strong><small className="text-[11px] text-[#758195]">근로자 세션을 발급합니다.</small></span></li></ol>
      </div>
    </section>
  </main>;
}

export default function LandingPage() { return <Suspense fallback={<main className="min-h-screen bg-[#eef3f8]" />}><LandingPageInner /></Suspense>; }

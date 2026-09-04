"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, HardHat, Languages, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { languages } from "@/constants";
import BrandLogo from "@/components/BrandLogo";
import { getT } from "./auth/translations";
import { persistDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const LANDING_UI: Record<string, Record<string, string | string[]>> = {
  ko: { os:"FIELD SAFETY OS", access:"SECURE ACCESS", title:"이름 중심의 간단하고\n안전한 현장 입장", desc:"근로자의 선호 언어와 현장 배정을 확인한 뒤, 필요한 안전 업무를 바로 시작합니다.", language:"언어 선택", languageDesc:"근로자의 선호 언어로 서비스를 시작합니다.", adminDesc:"현장 운영 및 안전관리", workerDesc:"교육 확인 및 안전 업무", login:"로그인 · 본인 확인", loginDesc:"웹과 모바일에서 같은 흐름으로 시작합니다.", steps:["정보 확인|이름과 최소 정보를 확인합니다.", "현장 연결|배정 현장을 자동으로 확인합니다.", "입장 완료|근로자 세션을 발급합니다."] },
  en: { os:"FIELD SAFETY OS", access:"SECURE ACCESS", title:"Simple, secure site entry\ncentered on your name", desc:"Confirm the worker’s preferred language and site assignment, then start the required safety work right away.", language:"Select language", languageDesc:"Start the service in the worker’s preferred language.", adminDesc:"Site operations and safety management", workerDesc:"Training confirmation and safety tasks", login:"Sign in · identity verification", loginDesc:"Start with the same flow on web and mobile.", steps:["Verify information|Confirm name and minimum information.", "Connect site|Automatically verify the assigned site.", "Entry complete|Issue a worker session."] },
  zh: { os:"现场安全操作系统", access:"安全访问", title:"以姓名为中心的简单\n安全现场进入", desc:"确认工人的首选语言和现场分配后，立即开始必要的安全工作。", language:"选择语言", languageDesc:"以工人的首选语言开始服务。", adminDesc:"现场运营与安全管理", workerDesc:"培训确认与安全工作", login:"登录 · 身份确认", loginDesc:"在网页和移动端以相同流程开始。", steps:["确认信息|确认姓名和最少信息。", "连接现场|自动确认分配的现场。", "进入完成|发放工人会话。"] },
  vi: { os:"HỆ ĐIỀU HÀNH AN TOÀN CÔNG TRƯỜNG", access:"TRUY CẬP AN TOÀN", title:"Vào công trường đơn giản\nvà an toàn theo tên", desc:"Xác nhận ngôn ngữ ưa dùng và công trường được phân công của công nhân, sau đó bắt đầu công việc an toàn cần thiết.", language:"Chọn ngôn ngữ", languageDesc:"Bắt đầu dịch vụ bằng ngôn ngữ ưa dùng của công nhân.", adminDesc:"Vận hành công trường và quản lý an toàn", workerDesc:"Xác nhận đào tạo và công việc an toàn", login:"Đăng nhập · xác minh danh tính", loginDesc:"Bắt đầu theo cùng một quy trình trên web và di động.", steps:["Xác nhận thông tin|Xác nhận tên và thông tin tối thiểu.", "Kết nối công trường|Tự động xác nhận công trường được phân công.", "Hoàn tất vào|Cấp phiên làm việc cho công nhân."] },
  id: { os:"SISTEM KESELAMATAN LOKASI", access:"AKSES AMAN", title:"Masuk lokasi dengan mudah\ndan aman berdasarkan nama", desc:"Konfirmasikan bahasa pilihan dan lokasi kerja pekerja, lalu mulai pekerjaan keselamatan yang diperlukan.", language:"Pilih bahasa", languageDesc:"Mulai layanan dalam bahasa pilihan pekerja.", adminDesc:"Operasional lokasi dan manajemen keselamatan", workerDesc:"Konfirmasi pelatihan dan tugas keselamatan", login:"Masuk · verifikasi identitas", loginDesc:"Mulai dengan alur yang sama di web dan perangkat seluler.", steps:["Verifikasi informasi|Konfirmasikan nama dan informasi minimum.", "Hubungkan lokasi|Verifikasi lokasi yang ditugaskan secara otomatis.", "Masuk selesai|Buat sesi pekerja."] },
  ru: { os:"СИСТЕМА БЕЗОПАСНОСТИ ОБЪЕКТА", access:"БЕЗОПАСНЫЙ ДОСТУП", title:"Простой и безопасный\nвход на объект по имени", desc:"Подтвердите предпочитаемый язык и назначенный объект работника, затем сразу начните необходимые задачи по безопасности.", language:"Выберите язык", languageDesc:"Начните сервис на предпочитаемом языке работника.", adminDesc:"Управление объектом и безопасностью", workerDesc:"Подтверждение обучения и задачи безопасности", login:"Вход · подтверждение личности", loginDesc:"Одинаковый процесс в веб-версии и на мобильном устройстве.", steps:["Проверка данных|Подтвердите имя и минимальные сведения.", "Подключение объекта|Автоматически подтвердите назначенный объект.", "Вход завершён|Создайте сессию работника."] },
};

function fallbackLandingUi(language: string): Record<string, string | string[]> {
  const auth = getT(language);
  return {
    os: "SQ LINK",
    access: "SQ LINK",
    title: auth.chooseRole,
    desc: auth.chooseRoleDesc,
    language: auth.changeLang,
    languageDesc: auth.chooseRoleDesc,
    adminDesc: auth.adminRoleDesc,
    workerDesc: auth.workerRoleDesc,
    login: auth.doLogin,
    loginDesc: auth.chooseRoleDesc,
    steps: [
      `${auth.chooseRole}|${auth.chooseRoleDesc}`,
      `${auth.workerRole}|${auth.workerRoleDesc}`,
      `${auth.adminRole}|${auth.adminRoleDesc}`,
    ],
  };
}

function LandingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLang = useDisplayLanguage();
  const [showRoles, setShowRoles] = useState(false);
  const qrRole = searchParams.get("role");
  const qrSiteId = searchParams.get("site_id");

  useEffect(() => { if (qrRole === "admin") setShowRoles(true); }, [qrRole]);

  const auth = getT(selectedLang);
  const ui = LANDING_UI[selectedLang] || fallbackLandingUi(selectedLang);
  const steps = ui.steps as string[];
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
      <div className="flex items-center gap-4"><BrandLogo compact imageClassName="!w-[124px] max-w-none" /><span className="hidden border-l border-[#d9e1ea] pl-4 text-xs font-black tracking-[.18em] text-[#063789] sm:block">SQ LINK</span></div>
      <span className="flex items-center gap-2 text-[11px] font-bold text-[#526076]"><i className="h-2 w-2 rounded-full bg-[#07835a]" />{ui.os as string}</span>
    </header>

    <section className="mx-auto grid max-w-[1180px] gap-7 px-4 py-7 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)] lg:items-center lg:gap-12 lg:px-12 lg:py-14">
      <div className="order-2 lg:order-1">
        <p className="text-[11px] font-black tracking-[.2em] text-[#0b5ed7]">{ui.access as string}</p>
        <h1 className="mt-3 whitespace-pre-line text-3xl font-black leading-tight tracking-tight text-[#063789] sm:text-4xl">{ui.title as string}</h1>
        <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-[#526076]">{ui.desc as string}</p>

        <div className="mt-5 rounded-xl border border-[#d9e1ea] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] pb-4"><div><h2 className="text-sm font-black">{ui.language as string}</h2><p className="mt-1 text-[11px] text-[#758195]">{ui.languageDesc as string}</p></div><Languages className="h-5 w-5 shrink-0 text-[#0b5ed7]" /></div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {languages.map((language) => { const active = selectedLang === language.code; return <button key={language.code} onClick={() => persistDisplayLanguage(language.code)} className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-lg border px-1 transition ${active ? "border-[#0b5ed7] bg-[#e9f2ff] text-[#063789]" : "border-[#edf1f5] bg-white text-[#526076] hover:border-[#bed7fa]"}`}><Image src={`/flags/${language.iso}.png`} alt={language.name} width={28} height={19} className="h-[19px] w-7 rounded object-cover" /><span className="text-[9px] font-bold leading-tight">{language.name}</span></button>; })}
          </div>
        </div>

        {!showRoles ? <button onClick={() => qrRole === "worker" ? router.push(buildAuthUrl("worker")) : setShowRoles(true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0b5ed7] px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(11,94,215,.2)] transition hover:bg-[#063789] sm:w-auto">{auth.doEnter}<ChevronRight className="h-4 w-4" /></button> : <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={() => router.push(buildAuthUrl("admin"))} className="flex items-center gap-3 rounded-lg border border-[#d9e1ea] bg-white p-4 text-left transition hover:border-[#0b5ed7] hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e9f2ff] text-[#0b5ed7]"><ShieldCheck className="h-5 w-5" /></span><span><b className="block text-sm">{auth.adminRole}</b><small className="mt-1 block text-[11px] text-[#758195]">{ui.adminDesc as string}</small></span></button>
          <button onClick={() => router.push(buildAuthUrl("worker"))} className="flex items-center gap-3 rounded-lg border border-[#d9e1ea] bg-white p-4 text-left transition hover:border-[#07835a] hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#edf9f4] text-[#07835a]"><HardHat className="h-5 w-5" /></span><span><b className="block text-sm">{auth.workerRole}</b><small className="mt-1 block text-[11px] text-[#758195]">{ui.workerDesc as string}</small></span></button>
          <p className="sm:col-span-2 text-center text-xs font-medium text-[#758195]">{auth.chooseRoleDesc}</p>
        </div>}
      </div>

      <div className="order-1 overflow-hidden rounded-xl border border-[#cdd6e2] bg-white shadow-[0_14px_36px_rgba(16,42,67,.13)] lg:order-2">
        <div className="relative min-h-[230px] sm:min-h-[300px]"><picture><source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/access.webp" /><Image src="/images/mobile-v3/website/access.webp" alt={ui.login as string} fill priority className="object-cover" /></picture><div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[10px] font-black tracking-[.18em] text-blue-200">{ui.access as string}</p><strong className="mt-1 block text-xl font-black">{ui.login as string}</strong><span className="mt-1 block text-xs text-slate-100">{ui.loginDesc as string}</span></div></div>
        <ol className="divide-y divide-[#edf1f5] p-4">{steps.map((step, index) => { const [title, description] = step.split("|"); return <li key={title} className="flex gap-3 py-2"><b className="grid h-6 w-6 place-items-center rounded-md bg-[#0b5ed7] text-[10px] text-white">{index + 1}</b><span><strong className="block text-xs">{title}</strong><small className="text-[11px] text-[#758195]">{description}</small></span></li>; })}</ol>
      </div>
    </section>
  </main>;
}

export default function LandingPage() { return <Suspense fallback={<main className="min-h-screen bg-[#eef3f8]" />}><LandingPageInner /></Suspense>; }

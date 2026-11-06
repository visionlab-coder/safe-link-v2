"use client";

import { usePathname } from "next/navigation";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const labels: Record<string, string> = {
  ko: "개인정보처리방침", en: "Privacy Policy", vi: "Chính sách quyền riêng tư",
  zh: "隐私政策", th: "นโยบายความเป็นส่วนตัว", uz: "Maxfiylik siyosati",
  ph: "Patakaran sa privacy", km: "គោលការណ៍ឯកជនភាព", id: "Kebijakan Privasi",
  mn: "Нууцлалын бодлого", my: "ကိုယ်ရေးအချက်အလက် မူဝါဒ", ne: "गोपनीयता नीति",
  bn: "গোপনীয়তা নীতি", kk: "Құпиялық саясаты", ru: "Политика конфиденциальности",
  jp: "プライバシーポリシー", fr: "Politique de confidentialité",
  es: "Política de privacidad", ar: "سياسة الخصوصية", hi: "गोपनीयता नीति",
};

function PublicPrivacyNavigation({ atTop }: { atTop: boolean }) {
  const pathname = usePathname();
  const language = useDisplayLanguage();
  // Do not add scrolling or controls to the operational consoles and chat screens.
  if (/^\/(admin|worker|system|control|root|lab|poc)(\/|$)/.test(pathname)) return null;
  const label = language === "ko" ? labels.ko : `${labels[language] || labels.en} (${labels.ko})`;
  if (atTop) return (
    <div className="hidden border-b border-slate-200 bg-slate-50 px-5 text-right sm:block sm:px-8 lg:px-12">
      <a href="/privacy" hrefLang="ko" className="inline-flex min-h-10 items-center rounded-sm px-2 text-sm font-semibold text-blue-800 underline underline-offset-4 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700">
        {label}
      </a>
    </div>
  );
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-700" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <a href="/privacy" hrefLang="ko" className="inline-flex min-h-12 items-center px-3 font-semibold underline underline-offset-4 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700">
        {label}
      </a>
    </footer>
  );
}

export function PublicPrivacyHeader() {
  return <PublicPrivacyNavigation atTop />;
}

export default function PublicPrivacyFooter() {
  return <PublicPrivacyNavigation atTop={false} />;
}

import type { ReactNode } from "react";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import type { FeatureVisual } from "@/components/ResponsiveFeatureHero";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { getT as getAuthT } from "@/app/auth/translations";

const LAYOUT_UI: Record<string, { operator: string; completed: string }> = {
  ko: { operator: "판교 데이터센터 · 안전관리자", completed: "완료" },
  en: { operator: "Pangyo Data Center · Safety Manager", completed: "Complete" },
  zh: { operator: "板桥数据中心 · 安全管理员", completed: "完成" },
  vi: { operator: "Trung tâm dữ liệu Pangyo · Quản lý an toàn", completed: "Hoàn thành" },
  ru: { operator: "Дата-центр Пангьо · Специалист по безопасности", completed: "Готово" },
};

type Props = {
  visual: FeatureVisual;
  operator?: string;
  action: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * User-provided page visualization HTML의 `webScreen` / `mobileScreen`을
 * 제품 화면으로 이식한 공통 구조다. 브라우저·휴대폰 외곽 프레임은 의도적으로
 * 포함하지 않으며, action과 children에는 기존 기능 컴포넌트를 연결한다.
 */
export default function VisualizationScreenLayout({ visual, operator, action, children, className = "" }: Props) {
  const language = useDisplayLanguage();
  const t = LAYOUT_UI[language] ?? { operator: getAuthT(language).adminRole, completed: getAuthT(language).doEnter };
  const webImage = visual.image === "tbm"
    ? "/images/mobile-v4/web/tbm/03.webp"
    : `/images/mobile-v3/website/${visual.image}.webp`;
  const mobileImage = visual.image === "tbm"
    ? "/images/mobile-v4/mobile/tbm/03.webp"
    : `/images/mobile-v3/android/${visual.image}.webp`;

  return (
    <section className={`bg-[#f5f8fb] text-[#111827] ${className}`}>
      <header className="concept-page-header">
        <BrandLogo compact imageClassName="!w-[88px] max-w-none max-sm:!w-[78px]" />
        <span className="text-xs font-black text-[#063789]">SQ-LINK</span>
        <span className="text-[10px] font-bold text-[#526076] max-sm:hidden">{operator ?? t.operator}</span>
      </header>

      <div className="admin-concept-hero relative h-[min(32vw,288px)] min-h-40 overflow-hidden bg-[#dbe3ec] max-sm:h-[178px] max-sm:min-h-[178px]">
        <picture>
          <source media="(max-width: 639px)" srcSet={mobileImage} />
          <Image src={webImage} alt={visual.title} fill className="object-cover" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(5,22,43,.74)] to-[rgba(5,22,43,.08)]" />
        <div className="absolute inset-x-6 bottom-[22px] text-white max-sm:inset-x-4 max-sm:bottom-[14px]">
          <small className="text-[10px] font-black">{visual.eyebrow}</small>
          <h1 className="my-[5px] text-[25px] font-black leading-[1.15] max-sm:text-[21px]">{visual.title}</h1>
          <p className="text-[11px] font-semibold text-[#e6edf7]">{visual.description}</p>
        </div>
      </div>

      <div className="p-[18px_22px_24px] max-sm:p-[14px]">
        <div className="mb-4 grid grid-cols-3 gap-2.5 max-sm:mb-3 max-sm:gap-1.5">
          {visual.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-[7px] border border-[#d9e1ea] bg-white p-[13px] max-sm:px-[7px] max-sm:py-[9px]">
              <span className="block text-[9px] font-extrabold text-[#758195]">{metric.label}</span>
              <strong className="mt-1 block text-lg font-black text-[#063789] max-sm:text-[15px]">{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="border-y border-[#d9e1ea] bg-white">
          {visual.steps.map((step, index) => (
            <div key={step.title} className="grid min-h-[52px] grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[#edf1f5] px-1 py-2 last:border-b-0 max-sm:min-h-12">
              <span className="grid h-[26px] w-[26px] place-items-center rounded-[5px] bg-[#0b5ed7] text-[10px] font-black text-white">{index + 1}</span>
              <span><strong className="block text-xs">{step.title}</strong><small className="mt-0.5 block text-[9px] text-[#7a8595]">{step.description}</small></span>
              <span className="text-[9px] font-black text-[#07835a]">{t.completed}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 [&>a]:flex [&>a]:min-h-11 [&>a]:w-full [&>a]:items-center [&>a]:justify-center [&>a]:rounded-[7px] [&>a]:border-0 [&>a]:bg-[#0b5ed7] [&>a]:px-4 [&>a]:text-[13px] [&>a]:font-black [&>a]:text-white [&>button]:min-h-11 [&>button]:w-full [&>button]:rounded-[7px] [&>button]:border-0 [&>button]:bg-[#0b5ed7] [&>button]:px-4 [&>button]:text-[13px] [&>button]:font-black [&>button]:text-white">
          {action}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

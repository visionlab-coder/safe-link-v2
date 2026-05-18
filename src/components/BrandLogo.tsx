import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  compact?: boolean;
  showProduct?: boolean;
};

export default function BrandLogo({
  className = "",
  imageClassName = "",
  compact = true,
  showProduct = false,
}: BrandLogoProps) {
  const width = compact ? 208 : 360;
  const height = compact ? 60 : 104;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src={compact ? "/brand/seowon-logo-compact-transparent.png" : "/brand/seowon-logo-transparent.png"}
        alt="SEOWON"
        width={width}
        height={height}
        priority={!compact}
        className={`h-auto w-auto object-contain ${imageClassName}`}
      />
      {showProduct && (
        <div className="hidden sm:flex flex-col border-l border-white/10 pl-3 leading-none">
          <span className="text-[10px] font-black uppercase tracking-[0.34em] text-blue-300/80">
            SAFE-LINK
          </span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Field Safety OS
          </span>
        </div>
      )}
    </div>
  );
}

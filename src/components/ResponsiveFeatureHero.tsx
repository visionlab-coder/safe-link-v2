import Image from "next/image";

type Metric = { label: string; value: string };
type Step = { title: string; description: string };

export type FeatureVisual = {
  image: "access" | "dashboard" | "onboarding" | "nfc-qr" | "health" | "tbm" | "education" | "documents" | "diary" | "live" | "translate" | "esg";
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  steps: Step[];
};

export default function ResponsiveFeatureHero({ visual }: { visual: FeatureVisual }) {
  const imagePath = visual.image === "tbm"
    ? "/images/mobile-v4/web/tbm/03.webp"
    : `/images/mobile-v3/website/${visual.image}.webp`;
  const mobileImagePath = visual.image === "tbm"
    ? "/images/mobile-v4/mobile/tbm/03.webp"
    : `/images/mobile-v3/android/${visual.image}.webp`;

  return (
    <section className="w-full">
      <div className="admin-concept-hero relative min-h-56 w-full overflow-hidden bg-slate-800 sm:min-h-72">
        <picture>
          <source media="(max-width: 639px)" srcSet={mobileImagePath} />
          <Image src={imagePath} alt="" fill priority className="object-cover" />
        </picture>
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/80 via-slate-950/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-screen-2xl p-5 text-white sm:p-8">
          <p className="text-[10px] font-black tracking-[.18em] text-blue-200">{visual.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{visual.title}</h2>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-100">{visual.description}</p>
        </div>
      </div>
    </section>
  );
}

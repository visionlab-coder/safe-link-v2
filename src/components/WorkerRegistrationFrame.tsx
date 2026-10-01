import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, HardHat, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import styles from "./WorkerRegistrationFrame.module.css";
import { workerRegistrationUI } from "@/lib/worker-registration-ui";

export default function WorkerRegistrationFrame({ children, title, mode, backHref, language }: {
  children: ReactNode;
  title: string;
  mode: "temporary" | "upgrade";
  backHref: string;
  language: string;
}) {
  const Icon = mode === "temporary" ? HardHat : ShieldCheck;
  const t = workerRegistrationUI(language);
  return (
    <main className={styles.page} lang={language === "jp" ? "ja" : language === "ph" ? "fil" : language} dir={language === "ar" ? "rtl" : "ltr"}>
      <div className={styles.container}>
        <Link className={styles.back} href={backHref}><ArrowLeft size={18} aria-hidden="true" />{t.back}</Link>
        <div className={styles.brand}>
          <BrandLogo compact className="justify-center" imageClassName="max-w-[152px]" />
          <p className={styles.wordmark}>SQ <span>LINK</span></p>
          <p className={styles.tagline}>{t.workerRole}</p>
        </div>
        <div className={styles.banner}>
          <Image src="/images/mobile-v3/website/access.webp" alt="" fill priority sizes="(max-width: 640px) 100vw, 520px" className="object-cover" />
        </div>
        <div className={styles.card}>
          <div className={styles.heading}>
            <span className={styles.icon}><Icon size={28} strokeWidth={1.8} aria-hidden="true" /></span>
            <div><p className={styles.eyebrow}>SQ LINK · {t.workerRole}</p><h1>{title}</h1></div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

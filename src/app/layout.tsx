export const runtime = "edge";
import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_KR, Noto_Sans_SC, Noto_Sans_TC, Noto_Sans_JP, Noto_Sans_Thai, Noto_Sans_Arabic, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// ─────────────────────────────────────────────────────
// 🌐 Noto Sans 시리즈 — Google "No More Tofu" 프로젝트
//    모든 폰트 SIL OFL 라이선스 (상용 서비스 완전 무료)
// ─────────────────────────────────────────────────────

// 라틴 / 키릴 / 그리스 / 베트남 / 인도네시아 / 우즈베크 / 카자흐 / 러시아
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "vietnamese"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans",
});

// 한국어
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-kr",
});

// 중국어 간체 (중국)
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sc",
});

// 중국어 번체 (대만/홍콩)
const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-tc",
});

// 일본어
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-jp",
});

// 태국어
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-thai",
});

// 아랍어 (사우디/중동)
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-arabic",
});

// 데바나가리 (힌디 / 네팔어)
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-devanagari",
});

export const metadata: Metadata = {
  title: "SAFE-LINK | Field Communication OS",
  description: "Real-time multilingual communication platform for construction sites",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = [
    notoSans.variable,
    notoSansKR.variable,
    notoSansSC.variable,
    notoSansTC.variable,
    notoSansJP.variable,
    notoSansThai.variable,
    notoSansArabic.variable,
    notoSansDevanagari.variable,
  ].join(" ");

  return (
    <html lang="ko" className="dark">
      <body
        suppressHydrationWarning
        className={`${fontVariables} bg-slate-950 text-slate-50 antialiased min-h-screen selection:bg-blue-500/30`}
        style={{
          // 언어별 우선순위 font-family 스택
          fontFamily: `var(--font-noto-kr), var(--font-noto-sc), var(--font-noto-tc), var(--font-noto-jp), var(--font-noto-thai), var(--font-noto-arabic), var(--font-noto-devanagari), var(--font-noto-sans), system-ui, sans-serif`,
        }}
      >
        {children}
      </body>
    </html>
  );
}

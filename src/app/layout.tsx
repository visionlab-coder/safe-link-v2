import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_KR, Noto_Sans_SC, Noto_Sans_TC, Noto_Sans_JP, Noto_Sans_Thai, Noto_Sans_Arabic, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import AuthListener from "@/components/AuthListener";

// ─────────────────────────────────────────────────────
// 🌐 Noto Sans 시리즈 — Google "No More Tofu" 프로젝트
//    모든 폰트 SIL OFL 라이선스 (상용 서비스 완전 무료)
// ─────────────────────────────────────────────────────

// weight 최소화: 400(본문) + 900(굵게)만 로드 → 폰트 파일 50% 절감
// 500/700은 브라우저가 400/900에서 합성 (시각 차이 거의 없음)

const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext", "cyrillic", "vietnamese"],
  weight: ["400", "900"],
  display: "swap",
  variable: "--font-noto-sans",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-noto-kr",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-noto-sc",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-noto-tc",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-noto-jp",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "900"],
  display: "swap",
  variable: "--font-noto-thai",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "900"],
  display: "swap",
  variable: "--font-noto-arabic",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "900"],
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
        {/* 카카오톡 등 인앱 브라우저 외부 실행 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var userAgent = navigator.userAgent.toLowerCase();
                if (userAgent.indexOf("kakaotalk") > -1) {
                  location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
                }
              })();
            `,
          }}
        />
        <AuthListener />
        {children}
      </body>
    </html>
  );
}

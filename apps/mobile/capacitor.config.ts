import type { CapacitorConfig } from "@capacitor/cli";

// 단일 앱 = 배포된 SAFE-LINK 웹앱 전체를 first-party WebView로 호스팅.
// 관리자·근로자 모두 한 앱에서 웹앱 로그인으로 전 기능 사용(라이브 통역·TBM 브로드캐스팅·1:1 대화 포함).
// 웹 PoC 코드를 그대로 재사용 → "절대 안 깨짐" 최대 보장.
// URL은 환경변수로 교체 가능(스테이징/로컬 테스트). 기본값은 Vercel 운영 배포.
const webappUrl = process.env.MOBILE_WEBAPP_URL || "https://safe-link-v2.vercel.app";

const config: CapacitorConfig = {
  appId: "com.safelink.mobile.dev",
  appName: "SAFE-LINK Dev",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // first-party 로 배포 도메인을 로드 → Supabase 세션 쿠키 정상 유지(iframe 3rd-party 문제 회피).
    url: webappUrl,
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;

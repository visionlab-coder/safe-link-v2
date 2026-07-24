import type { CapacitorConfig } from "@capacitor/cli";

// 단일 앱 = 배포된 SQ Link V3 웹앱 전체를 first-party WebView로 호스팅.
// 최종 스토어 업로드 전에는 MOBILE_APP_ID를 회사 명의 bundle/package id로 확정해야 한다.
const appId = process.env.MOBILE_APP_ID || "kr.co.safelink.mobile.dev";
const appName = process.env.MOBILE_APP_NAME || "SQ Link Dev";
const webappUrl = process.env.MOBILE_WEBAPP_URL || "https://app-test.safe-link.co.kr";

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: "dist",
  server: {
    androidScheme: "https",
    // first-party 배포 도메인을 로드해 앱과 웹의 세션/CORS 조건을 동일하게 검증한다.
    url: webappUrl,
    cleartext: false,
    // 원격 로드 실패(네트워크 끊김/서버 도달 불가) 시 로컬 오프라인 안내 페이지 표시.
    // 네트워크 복구 시 자동으로 웹앱에 재진입(public/error.html).
    errorPath: "error.html"
  },
  android: {
    allowMixedContent: false
  }
};

export default config;

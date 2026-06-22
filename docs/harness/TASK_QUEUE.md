# TASK_QUEUE — READY / BLOCKED / DONE

> 한 세션 = READY 1개. BLOCKED·게이트는 손대지 않는다.

## READY

1. S-004 — 모바일 Bearer 인증을 TBM 서명·번역 라우트로 확대
   - Done: 근로자가 모바일에서 TBM 서명(/api/tbm/sign)과 번역(/api/translate)을 Bearer 토큰으로 호출 가능(현재 cookie-only). 공통 CORS·resolveRequestAccessToken 적용.
   - Scope: tbm/sign·translate의 Bearer-aware 인증 + CORS. worker UI 음성·전체채팅 제외.
   - Verify: Bearer 호출 인증 통과, preflight 허용/거부, 웹 cookie 호환, contract smoke, root typecheck/build green
   - Risk: 라우트별 인증 패턴 상이(getCookieUser vs raw parse) 통일 필요, RLS/site 일치

## BLOCKED

- M-004 — iOS 테스트 빌드: macOS/Xcode 또는 CI 경로 결정 필요
- R-001 — 스토어 제출: 개발자 계정·명의·법무·개인정보 승인 필요
- S-003 — 운영 RLS·tenant 변경: 별도 보안 검토와 운영 DB 승인 필요

## DONE

- M-007 @ working-tree — 카메라·QR 스캔 adapter · Verify: BarcodeDetector+getUserMedia QR 스캔, 권한 요청/거부/취소 분기, SAFE-LINK QR 파싱, iOS/미지원 unsupported 명시, QrScanPanel, mobile typecheck+vite build green · Files: apps/mobile/src/lib/capability/qr.ts, app/QrScanPanel.tsx, app/App.tsx · Note: iOS WKWebView는 네이티브 스캐너 후속(M-008 후보)
- M-006 @ working-tree — 근로자 TBM vertical slice · Verify: worker-quick-login 모바일 토큰+CORS, /api/tbm/today(Bearer+RLS site스코프+CORS), 모바일 workerLogin/getTodayTbms+WorkerTbmPanel, endpoint smoke 6/6, root+mobile typecheck/build green · Files: api/auth/worker-quick-login, api/tbm/today, apps/mobile/src/lib/auth/client.ts, app/WorkerTbmPanel.tsx, app/App.tsx
- M-005 @ working-tree — 모바일 admin 로그인 + secure token store · Verify: @capacitor/preferences 저장, adminLogin(mobile)→token 저장, authFetch Bearer 주입, logout 제거, AdminAuthPanel 최소 흐름, mobile typecheck+vite build green · Files: apps/mobile/src/lib/auth/{token-store,client}.ts, app/AdminAuthPanel.tsx, app/App.tsx, styles/app.css · Note: Preferences는 평문 → 상용 전 암호화 백엔드 교체 권장
- S-002 @ working-tree — 모바일 인증 API·CORS 계약 · Verify: preflight 허용(204)/거부(403), 모바일 토큰응답 게이트(X-Safe-Link-Client+허용origin), auth/me 401에도 CORS, 웹 no-CORS 호환, contract smoke 8/8, typecheck green · Files: utils/auth/mobile-cors.ts, api/auth/admin-login, api/auth/me, scripts/mobile-auth-cors-smoke.mjs
- M-003 @ working-tree — 최소 Android Capacitor 셸 구축 · Verify: Vite build, cap sync, Gradle assembleDebug, APK 4,194,299 bytes, package `com.safelink.mobile.dev`, npm audit 0, secret scan clean
- S-001 @ working-tree — Supabase access token fail-closed 검증 기반 · Verify: missing/forged/Auth rejection 401 contract smoke, cookie/Bearer 추출, typecheck/build green
- M-002 @ working-tree — 모바일 아키텍처 ADR과 최소 셸 계약 확정 · Verify: component/data/threat boundary, build command, M-003 파일 범위와 rollback 기준 기록
- M-001 @ working-tree — 모바일 capability 및 제약 감사 · Verify: route/API 조사, capability matrix, 아키텍처 비교, blocker와 다음 READY 기록
- H-001 @ working-tree — Goal + Harness bootstrap · Verify: 설치 검증 결과는 STATUS/STATE에 기록

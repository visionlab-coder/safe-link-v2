# TASK_QUEUE — READY / BLOCKED / DONE

> 한 세션 = READY 1개. BLOCKED·게이트는 손대지 않는다.

## READY

1. M-010 — 실기기 E2E 테스트 가이드 (Android/iOS 수동)
   - Done: 실기기에서 핵심 모바일 시나리오(관리자 로그인→TBM 조회/서명, 근로자 로그인→오늘 TBM→서명→번역, QR/NFC 스캔)를 수동 검증하는 단계별 가이드 + 결과 기록 템플릿 문서.
   - Scope: docs 문서만 추가. 코드 변경 없음. Android는 debug APK, iOS는 빌드 미확보 시 "BLOCKED(M-004)" 명시.
   - Verify: 각 시나리오 사전조건/단계/기대결과/기록란, placeholder check green
   - Risk: iOS 빌드 미확보(M-004 BLOCKED) → iOS 항목은 가이드만, 실행은 보류

## BLOCKED

- M-004 — iOS 테스트 빌드: macOS/Xcode 또는 CI 경로 결정 필요
- R-001 — 스토어 제출: 개발자 계정·명의·법무·개인정보 승인 필요
- S-003 — 운영 RLS·tenant 변경: 별도 보안 검토와 운영 DB 승인 필요

## DONE

- M-009 @ working-tree — NFC 스캔 adapter (모바일) · Verify: Web NFC(NDEFReader) getNfcCapability/scanNfcOnce/parseSafeLinkNfc, unsupported·permission_denied·cancelled·error 분기, URL payload worker/site 토큰 파싱, NfcScanPanel+App 통합, mobile typecheck+vite build green · Files: apps/mobile/src/lib/capability/nfc.ts, app/NfcScanPanel.tsx, app/App.tsx · Note: Android Chrome 전용·HTTPS 필요, iOS는 네이티브 후속(M-004 계열)
- M-008 @ working-tree — 모바일 TBM 서명 캔버스 UI · Verify: 터치 pointer-events 캔버스(DPR·지우기·빈서명 방지), data URL→signTbm 제출, WorkerTbmPanel 조회→서명→제출 완성, mobile typecheck+vite build green · Files: apps/mobile/src/app/SignatureCanvas.tsx, WorkerTbmPanel.tsx
- S-005 @ working-tree — translate 모바일 Bearer+CORS · Verify: X-Safe-Link-Client로 travel-token과 모바일 JWT 구분, 모바일 서명검증, OPTIONS 허용/거부, travel·웹 경로 보존, translate smoke 6/6, root+mobile typecheck/build green · Files: api/translate, apps/mobile/src/lib/auth/client.ts(translateText)
- S-004 @ working-tree — tbm/sign 모바일 Bearer+CORS · Verify: cookie-only 미검증 → resolveRequestAccessToken+verifyAccessToken(서명검증, 보안 강화), OPTIONS preflight 허용(204)/거부(403), 무토큰 401+CORS, 웹 no-CORS 호환, sign smoke 5/5, root+mobile typecheck/build green · Files: api/tbm/sign, apps/mobile/src/lib/auth/client.ts(signTbm) · translate는 S-005로 분리
- M-007 @ working-tree — 카메라·QR 스캔 adapter · Verify: BarcodeDetector+getUserMedia QR 스캔, 권한 요청/거부/취소 분기, SAFE-LINK QR 파싱, iOS/미지원 unsupported 명시, QrScanPanel, mobile typecheck+vite build green · Files: apps/mobile/src/lib/capability/qr.ts, app/QrScanPanel.tsx, app/App.tsx · Note: iOS WKWebView는 네이티브 스캐너 후속(M-008 후보)
- M-006 @ working-tree — 근로자 TBM vertical slice · Verify: worker-quick-login 모바일 토큰+CORS, /api/tbm/today(Bearer+RLS site스코프+CORS), 모바일 workerLogin/getTodayTbms+WorkerTbmPanel, endpoint smoke 6/6, root+mobile typecheck/build green · Files: api/auth/worker-quick-login, api/tbm/today, apps/mobile/src/lib/auth/client.ts, app/WorkerTbmPanel.tsx, app/App.tsx
- M-005 @ working-tree — 모바일 admin 로그인 + secure token store · Verify: @capacitor/preferences 저장, adminLogin(mobile)→token 저장, authFetch Bearer 주입, logout 제거, AdminAuthPanel 최소 흐름, mobile typecheck+vite build green · Files: apps/mobile/src/lib/auth/{token-store,client}.ts, app/AdminAuthPanel.tsx, app/App.tsx, styles/app.css · Note: Preferences는 평문 → 상용 전 암호화 백엔드 교체 권장
- S-002 @ working-tree — 모바일 인증 API·CORS 계약 · Verify: preflight 허용(204)/거부(403), 모바일 토큰응답 게이트(X-Safe-Link-Client+허용origin), auth/me 401에도 CORS, 웹 no-CORS 호환, contract smoke 8/8, typecheck green · Files: utils/auth/mobile-cors.ts, api/auth/admin-login, api/auth/me, scripts/mobile-auth-cors-smoke.mjs
- M-003 @ working-tree — 최소 Android Capacitor 셸 구축 · Verify: Vite build, cap sync, Gradle assembleDebug, APK 4,194,299 bytes, package `com.safelink.mobile.dev`, npm audit 0, secret scan clean
- S-001 @ working-tree — Supabase access token fail-closed 검증 기반 · Verify: missing/forged/Auth rejection 401 contract smoke, cookie/Bearer 추출, typecheck/build green
- M-002 @ working-tree — 모바일 아키텍처 ADR과 최소 셸 계약 확정 · Verify: component/data/threat boundary, build command, M-003 파일 범위와 rollback 기준 기록
- M-001 @ working-tree — 모바일 capability 및 제약 감사 · Verify: route/API 조사, capability matrix, 아키텍처 비교, blocker와 다음 READY 기록
- H-001 @ working-tree — Goal + Harness bootstrap · Verify: 설치 검증 결과는 STATUS/STATE에 기록

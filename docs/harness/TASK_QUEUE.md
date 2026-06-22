# TASK_QUEUE — READY / BLOCKED / DONE

> 한 세션 = READY 1개. BLOCKED·게이트는 손대지 않는다.

> **MC 트랙(최우선)**: 단일 앱이 배포 웹앱 전체를 호스팅(관리자·근로자 전 기능). 핵심 3종 = TBM 브로드캐스팅·라이브 통역·1:1 대화. 라이브/대화 증분은 build-green ≠ 완료 → 실기기 검증 전까지 DEVICE-PENDING.

> **MC-007 순차 결과**: A 배포 완료. B/C는 조사 결과 현 아키텍처에서 빌드 불필요/보류(아래). 다음은 사용자 결정.

1. (사용자 결정) 다음 후속 택1
   - 옵션 1 — 딥링크(B의 진짜 버전): QR/NFC 스캔 시 브라우저 대신 앱 오픈. Android App Links(인텐트 필터 + 도메인 `assetlinks.json` 배치 필요). 중간 난이도.
   - 옵션 2 — FCM 원격 푸시: 앱 종료 시에도 TBM 알림. Firebase 프로젝트 크리덴셜 게이트.
   - 옵션 3 — 오프라인 풀 캐시(C): 서비스워커. 스테일·인증 리스크라 신중 설계 필요(현재 MC-006으로 graceful 처리됨).
   - 옵션 4 — 마무리: MC-007-A 폰 실동작 확인 후 안정화.

## 조사 완료(빌드 불필요/보류)

- MC-007-B (QR·NFC) — N/A: 웹앱에 인앱 스캐너 없음(new NDEFReader·new BarcodeDetector 0건). QR=생성기, 스캔=폰 카메라/OS URL 오픈, NFC=OS URL+서버 API. 브릿지 대상 없음 → 네이티브 스캐너 미빌드(헛코드 방지). 가치 버전=딥링크(옵션 1).
- MC-007-C (오프라인 캐시) — 보류: SW/PWA 부재, 원격 SSR 캐시는 스테일·인증 리스크 + 핵심 온라인 필수 + MC-006이 graceful UX 제공. 풀 캐시는 별도 신중 설계.
   - Note: iOS(M-004) Codex 진행 중 간섭 금지. 잠긴 worktree 폴더(`../slv2-hotfix-*`) 수동 삭제 가능(무해).

## 사용자 확인/액션 대기

- #4 마무리 검증 — 최신 APK(18bf0523) 설치 + 웹 PR #2/#3/#4 배포 반영 후 실기기에서: 한국어(갑시다)·TBM 로컬알림·딥링크(스캔→앱)·오프라인 캐시 확인(E2E T9~T15).
- #2 FCM 원격 푸시 — **사용자 액션 필요**: Firebase 프로젝트 생성 → google-services.json + FCM 서버키 제공 시 구현 진행(앱 종료 상태 푸시). 현재는 인앱 로컬알림(#A)으로 대체 동작.
- MC-005 — Q-001 한국어 수정 폰 반영 확인.

## BLOCKED

- M-004 — iOS 테스트 빌드: macOS/Xcode 또는 CI 경로 결정 필요
- R-001 — 스토어 제출: 개발자 계정·명의·법무·개인정보 승인 필요
- S-003 — 운영 RLS·tenant 변경: 별도 보안 검토와 운영 DB 승인 필요

## DONE

- MC-009 (#3) @ PR #4 (배포됨) / DEVICE-PENDING — TBM 오프라인 캐시(안전 버전) · Verify: localStorage 캐시+오프라인 폴백+배너, 글로벌 SW 미사용, 온라인 무변화(stale 금지), 오프라인 번역 스킵, root tsc green, PR #4 머지→Vercel · Files: src/utils/native/tbm-cache.ts, src/app/worker/tbm/[id]/page.tsx
- MC-008 (#1) @ 9e42051 + APK 18bf0523 (배포됨, PR #3) / DEVICE-PENDING — 딥링크 App Links · Verify: AndroidManifest VIEW 인텐트필터(autoVerify, host safe-link-v2.vercel.app) + public/.well-known/assetlinks.json(디버그 지문), 미들웨어 통과, APK 18bf0523 · Note: 릴리스 빌드는 릴리스 서명 지문 추가 필요
- MC-007-A @ 8350722 (배포됨, PR #2) / DEVICE-PENDING — TBM·메시지 인앱 로컬 알림 · Verify: @capacitor/local-notifications@8.2(APK 689964b0) + feature-detected local-notify.ts + worker/page.tsx realtime 훅(notifyNative), 브라우저 no-op, root tsc green, PR #2 머지→Vercel · Files: src/utils/native/local-notify.ts, src/app/worker/page.tsx, apps/mobile/package.json · Note: 알림 실동작 실기기 확인 필요, 종료상태=FCM 후속
- MC-006 @ working-tree (build-green / DEVICE-PENDING) — 오프라인/네트워크 실패 UX · Verify: Capacitor server.errorPath=error.html + public/error.html(한국어 안내·다시시도·online 자동 재접속), build+cap sync(android assets 반영)+assembleDebug green(APK 74ef9c49), errorPath synced 확인 · Files: apps/mobile/capacitor.config.ts, apps/mobile/public/error.html · Note: 실제 오프라인 전환 동작 실기기 확인 필요
- MC-004 @ f8f4bcf (MERGED, 배포 트리거) — Q-001 한국어 수정 운영 배포 · Verify: PR #1 사용자 승인 후 master 머지(fast-forward, politeness.ts 1파일), origin/master 반영 확인 → Vercel 프로덕션 자동배포 트리거 · Note: 18커밋 통째 머지 회피(미검증 웹 PoC 운영 미반영). 폰 반영 확인=MC-005
- Q-001 @ working-tree — 한국어 존댓말 변환 버그 수정 · Verify: politeness.ts 청유형 '갑시다/합시다'가 '갑시습니다'로 손상되던 것 수정(시다 polite 인식 + catch-all negative lookbehind), politeness-smoke 12/12 + tsc green · Files: src/utils/politeness.ts, scripts/politeness-smoke.mjs · Note: 소스만 변경, 폰 반영은 vercel 재배포 필요
- MC-003 @ working-tree (DEVICE-VERIFIED) — 핵심 3종 2대 실기기 검증 · Verify: 사용자 2폰에서 라이브 통역 양방향·근로자/관리자 로그인·TBM·1:1 기능 정상(한국어 어미 artifact는 Q-001로 수정) · Note: 코드 변경 없는 검증 증분
- MC-002 @ working-tree (DEVICE-VERIFIED) — 단일 앱 셸 게이팅 검증 통과 · Verify: 사용자 안드로이드 실기기에서 관리자 로그인·TBM·일반 기능 정상 작동 확인 → WebView 웹앱 인증·기능 호스팅 입증, server.url 단일-앱-셸 접근 viable 확정 · Note: 라이브통역 2대·근로자·1:1 추가 확인 대기(MC-003)
- MC-001 @ working-tree — 단일 앱 셸 전환 · Verify: capacitor server.url=safe-link-v2.vercel.app로 웹앱 전체 first-party 호스팅(관리자·근로자 전 기능), AndroidManifest 마이크/카메라/알림 권한, MainActivity 런타임 권한 요청, build+cap sync+assembleDebug green · Files: apps/mobile/capacitor.config.ts, android/app/src/main/AndroidManifest.xml, android/.../MainActivity.java · Note: 인증 지속·WebView 마이크 실동작은 MC-002 실기기 검증 필요(미확정)
- M-010 @ working-tree — 실기기 E2E 테스트 가이드 · Verify: 8개 시나리오(T1~T8: 진단·관리자/근로자 로그인·TBM 서명·번역·QR·NFC·오프라인) 사전조건/단계/기대결과/기록란 + 결과 요약 템플릿 + M1 통과기준, placeholder/state check green · Files: docs/harness/MOBILE_E2E_TEST_GUIDE.md · Note: 문서만, iOS는 M-004 BLOCKED, 실기기 실행은 사용자 수행
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

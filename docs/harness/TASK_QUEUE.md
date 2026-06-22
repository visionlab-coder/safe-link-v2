# TASK_QUEUE — READY / BLOCKED / DONE

> 한 세션 = READY 1개. BLOCKED·게이트는 손대지 않는다.

## READY

1. M-006 — 근로자 TBM 첫 vertical slice (모바일)
   - Done: 근로자가 모바일에서 로그인(worker quick-login mobile token) → 오늘 TBM 조회·내용 표시까지 동작. 음성재생·서명은 후속 증분.
   - Scope: worker-quick-login mobile token 계약 확장 + TBM 조회 최소 화면. 서명·번역채팅·음성 제외.
   - Verify: worker 토큰 발급/저장(M-005 store 재사용), TBM 조회 인증 통과, mobile typecheck/build green
   - Risk: worker RLS site 일치, 오프라인/재시도, TBM 실시간 갱신은 별도

## BLOCKED

- M-004 — iOS 테스트 빌드: macOS/Xcode 또는 CI 경로 결정 필요
- R-001 — 스토어 제출: 개발자 계정·명의·법무·개인정보 승인 필요
- S-003 — 운영 RLS·tenant 변경: 별도 보안 검토와 운영 DB 승인 필요

## DONE

- M-005 @ working-tree — 모바일 admin 로그인 + secure token store · Verify: @capacitor/preferences 저장, adminLogin(mobile)→token 저장, authFetch Bearer 주입, logout 제거, AdminAuthPanel 최소 흐름, mobile typecheck+vite build green · Files: apps/mobile/src/lib/auth/{token-store,client}.ts, app/AdminAuthPanel.tsx, app/App.tsx, styles/app.css · Note: Preferences는 평문 → 상용 전 암호화 백엔드 교체 권장
- S-002 @ working-tree — 모바일 인증 API·CORS 계약 · Verify: preflight 허용(204)/거부(403), 모바일 토큰응답 게이트(X-Safe-Link-Client+허용origin), auth/me 401에도 CORS, 웹 no-CORS 호환, contract smoke 8/8, typecheck green · Files: utils/auth/mobile-cors.ts, api/auth/admin-login, api/auth/me, scripts/mobile-auth-cors-smoke.mjs
- M-003 @ working-tree — 최소 Android Capacitor 셸 구축 · Verify: Vite build, cap sync, Gradle assembleDebug, APK 4,194,299 bytes, package `com.safelink.mobile.dev`, npm audit 0, secret scan clean
- S-001 @ working-tree — Supabase access token fail-closed 검증 기반 · Verify: missing/forged/Auth rejection 401 contract smoke, cookie/Bearer 추출, typecheck/build green
- M-002 @ working-tree — 모바일 아키텍처 ADR과 최소 셸 계약 확정 · Verify: component/data/threat boundary, build command, M-003 파일 범위와 rollback 기준 기록
- M-001 @ working-tree — 모바일 capability 및 제약 감사 · Verify: route/API 조사, capability matrix, 아키텍처 비교, blocker와 다음 READY 기록
- H-001 @ working-tree — Goal + Harness bootstrap · Verify: 설치 검증 결과는 STATUS/STATE에 기록

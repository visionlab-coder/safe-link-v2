# STATUS

## Snapshot

- Project: SAFE-LINK V2 Mobile Commercialization
- Last calibrated: 2026-06-22T18:04:41+09:00
- Current branch: `wip/ai-engine-upgrade-20260622`
- Head SHA: `0161079`
- Default branch synced: true (`master` = `origin/master`); wip 미머지(배포 게이트)
- Current track: `mobile-partial`
- Next READY: `MC-003 라이브 통역(2대)·근로자모드·1:1 실기기 확인 마무리`
- **아키텍처 전환(2026-06-22)**: 단일 앱 = 배포 웹앱 전체를 first-party WebView 호스팅(`server.url`). 관리자·근로자 전 기능 한 앱. 상세 `GOAL.md > Architecture Decision`
- **게이팅 검증 PASS(2026-06-22)**: Android 실기기에서 관리자 로그인·TBM·일반 기능 정상(사용자 확인) → 단일-앱-셸 접근 viability 확정
- 최우선 핵심 3종: TBM 브로드캐스팅 · 라이브 통역 · 1:1 대화
- 이번 세션 증분: S-002·M-005~M-010·MC-001·MC-002(device-verified)

## Last Done Increment (DEVICE-VERIFIED — gating PASS)

MC-002 단일 앱 셸 게이팅 검증 통과. 사용자가 안드로이드 실기기에 MC-001 APK 설치 후 확인: **관리자 모드 로그인·TBM 동작, 그 외 기능 정상 작동**. WebView가 웹앱 인증·기능을 정상 호스팅함을 실기기로 입증 → `server.url` 단일-앱-셸(웹 PoC 코드 그대로 재사용) 접근이 viable함을 확정. 남은 명시 확인: 라이브 통역 마이크 2대 양방향, 근로자 모드, 1:1 대화.

## Current State

- Next.js 15, React 19, Supabase, Cloudflare/OpenNext 기반 웹앱
- 관리자/근로자 TBM, 서명, 번역 채팅 등 핵심 웹 흐름 존재
- `apps/mobile` Capacitor 8 Android 프로젝트와 diagnostics 로컬 번들 존재
- 기존 STT/TTS 관련 미커밋 변경이 있으므로 해당 파일은 보호 대상
- 66개 Next API와 service-role route 때문에 백엔드는 서버에 유지해야 함
- `getCookieUser`와 `/api/auth/me`의 JWT payload 신뢰를 제거하고 Auth server 검증으로 교체
- `/api/auth/me`는 모바일 Bearer token과 기존 cookie refresh 경로를 함께 지원
- root package와 사용자 STT/TTS WIP를 보호하기 위해 mobile package는 독립 설치
- Android Studio 2025.3.4.7, JDK 21, 로컬 SDK API 36 build chain 확인
- debug APK(M-003 최초): 4,194,299 bytes, SHA-256 `EF8DF76F1DDBA275D0C8F706833409A9ED88E1818D232E6A5E8152C89971C5AA`
- debug APK(option A 테스트빌드, M-005~M-010+Vercel config): 4,275,450 bytes, SHA-256 `3d3579c9e1ac9787d24999c8aa3bcf7b1b0bffeb375183a96f240db8a07b44b1`, SDK `C:\tmp\android-sdk`
- development package: `com.safelink.mobile.dev`, min SDK 24, target SDK 36
- 상세 근거: `MOBILE_CAPABILITY_AUDIT.md`
- 구현 계약: `ADR-001-MOBILE-ARCHITECTURE.md`

## Open Flags

- 현재 브랜치에 사용자 미커밋 변경 다수 존재
- iOS 빌드에는 macOS/Xcode 또는 외부 CI가 필요할 가능성이 높음
- Android/iOS 개발자 계정과 앱 식별자 소유 주체 결정 필요
- 실제 NFC 요구 수준과 iOS 제약 검토 필요

## Gates Pending

- 개발자 계정 비용과 명의
- 앱 식별자·서명 인증서
- 운영 DB 및 개인정보 변경
- 스토어 제출

## Recent Verification

- `git diff --check`: green
- sensitive-string check: green
- placeholder check: green
- STATE JSON check: green
- `npm.cmd exec tsc -- --noEmit`: green
- `npm.cmd run build`: green after M-003 재실행, 기존 ESLint warning과 workspace root warning은 open flag
- mobile typecheck/build/cap sync/assembleDebug: green
- mobile npm audit: 0 vulnerabilities
- mobile secret identifier scan: clean

## Notes for Next Session

S-002에서 모바일 admin 인증 token 응답과 Capacitor origin CORS 계약을 구현한다. worker 로그인과 모바일 UI 연결은 다음 증분으로 분리한다.

# SAFE-LINK V2 — 범소프트웨어 이관 전 2~3일 TODO

작성일: 2026-06-29
대상 저장소: `visionlab-coder/safe-link-v2`
기준 브랜치: `master`
현재 기준 커밋: `e5b8efdacfbe2dd1e8a43daff151463cc7b3729f`

## 목표

범소프트웨어가 하나의 기준 소스에서 웹·백엔드·Android/iOS 상품화 작업을 시작할 수 있도록, 빌드 가능한 소스와 배포·권한·환경변수·미완성 범위·검증 증거를 전달한다.

완료 기준:

- 깨끗한 clone에서 `npm ci`, TypeScript 검사, 웹 production build가 통과한다.
- Vercel과 Cloudflare가 별도 소스가 아니라 동일 Git SHA의 플랫폼별 배포 대상임을 문서와 버전 API로 확인할 수 있다.
- 현장관리·본사관제·시스템관리·개발자·근로자 역할 경계가 표로 고정된다.
- 실제 비밀값 없이 환경변수 이름, 소유자, 필수 여부, 적용 환경이 정리된다.
- 공급업체가 재사용할 영역과 재구현할 영역, 알려진 미완성·제외 범위가 명시된다.
- 전달물은 Git 추적 파일로만 만들고 SHA-256 목록과 검증 결과를 포함한다.

## 절대 보존 조건

- 현장 PoC의 TBM, 라이브 통역, 1:1 대화, 로그인 동작을 깨지 않는다.
- 사용자 미추적 파일과 기존 WIP를 임의로 삭제·이동·커밋하지 않는다.
- 운영 DB, RLS, 시크릿, Vercel·Cloudflare production 배포를 변경하지 않는다.
- API 키, service-role key, DB 비밀번호, 서명키를 문서·Git·압축파일에 넣지 않는다.
- PR 병합, 스토어 제출, 인증서 발급은 별도 승인 없이는 하지 않는다.

## 우선순위 TODO

### P0 — 인계 전 반드시 완료

| ID | 작업 | 산출물 | Harness 검증 | 예상 |
|---|---|---|---|---:|
| H-01 | 기준 소스와 WIP 분류 | tracked 기준 목록, 제외 목록, 기준 SHA | `git status`, `git ls-files`, 민감정보 검사 | 1.5h |
| H-02 | lint 범위 정상화 | 백업·Android 생성물·배포 산출물 제외, 실제 소스 lint 결과 | `npm run lint`, `npm run build` | 2h |
| H-03 | 배포 버전 식별 | `/api/version` 또는 동등 endpoint, Git SHA/빌드시각 계약 | 단위검사 + Vercel/OpenNext build | 2h |
| H-04 | 웹 CI 추가 | TypeScript, lint, build, 민감정보 검사 workflow | PR/브랜치 GitHub Actions green | 3h |
| H-05 | 배포 환경 계약 | Vercel·Cloudflare env 이름/필수/공개/소유자 표 | 값 미포함 검사, 누락 감지 스크립트 | 2h |
| H-06 | 권한·화면 계약 | `/admin`, `/control`, `/system`, `/root`, `/worker` RBAC 표 | middleware/API/RoleGuard 대조 | 2h |
| H-07 | API·DB 인벤토리 동기화 | 실제 API route 수, migration, Realtime, RLS 상태 | 파일 자동 집계, 문서 수치 일치 | 2h |
| H-08 | 깨끗한 clone 리허설 | 설치·검사·빌드 로그와 알려진 경고 | `npm ci`, `tsc`, lint, build | 2h |
| H-09 | 최종 전달 패키지 | Git tag 후보, 문서 인덱스, 체크섬, 벤더 질문표 | 새 폴더에서 재검증, secret scan | 2h |

### P1 — 시간이 허용되면 완료

| ID | 작업 | 완료 조건 | 예상 |
|---|---|---|---:|
| H-10 | 양 플랫폼 smoke 스크립트 | 홈 200, 인증 API 401, CORS 403, version SHA 동일 | 2h |
| H-11 | 핵심 API 계약 샘플 | 인증·TBM·서명·번역·STT/TTS 요청/응답 예시, 민감값 없음 | 3h |
| H-12 | 화면 캡처 인덱스 | 5개 역할 화면과 핵심 사용자 흐름 매핑 | 2h |
| H-13 | 이관 수락 체크리스트 | 범소프트웨어가 수령·빌드·접속·질의 확인 서명 | 1h |

## 3일 실행 순서

### Day 1 — 기준 소스와 자동 검증

1. H-01: 현재 미추적 파일 580개를 `필수 소스/참고자료/생성물/제외`로 분류한다.
2. H-02: ESLint가 `.codex-backups`, `apps/mobile/android/**/build`, `apps/mobile/dist` 등을 검사하지 않도록 범위를 바로잡는다.
3. H-03: 배포본이 자신의 release SHA를 반환하도록 버전 계약을 추가한다.
4. H-04: 웹 CI를 추가하고 로컬과 원격 검증 결과를 일치시킨다.

Day 1 종료 게이트:

- 기존 PoC 소스 변경은 최소 범위다.
- TypeScript와 production build는 green이다.
- lint 실패가 실제 소스 문제만 보여준다.
- CI가 실패하면 Day 2로 넘기지 않고 원인을 기록한다.

### Day 2 — 계약·권한·플랫폼 정리

1. H-05: 환경변수 계약을 작성한다. 실제 값은 다루지 않는다.
2. H-06: 관리자 화면을 네 계층으로 확정한다.
   - 현장 운영 `/admin`
   - 본사 통합관제 `/control`
   - 플랫폼·현장 관리 `/system`
   - 개발자 비밀관리 `/root`
   - 근로자 앱 `/worker`
3. H-07: 문서의 API 수치(현재 실제 `route.ts` 68개)와 DB migration 목록을 자동 집계 결과로 맞춘다.
4. H-10: Vercel·Cloudflare의 핵심 smoke와 release SHA 비교를 자동화한다.

Day 2 종료 게이트:

- 역할별 허용·금지 기능이 서버 권한과 모순되지 않는다.
- 환경변수 문서에 비밀값이 없다.
- 두 플랫폼의 동일성은 파일 해시가 아니라 release SHA와 기능 smoke로 판정한다.

### Day 3 — 전달 리허설과 패키지 고정

1. H-08: 현재 작업 폴더가 아닌 깨끗한 clone에서 설치·검사·빌드를 재현한다.
2. H-09: Git 추적 파일만으로 전달 패키지를 만든다.
3. H-11~H-13 중 가능한 항목을 완료한다.
4. 범소프트웨어에 아래 4개 결정을 요청한다.
   - 백엔드와 Supabase를 인수·유지할 주체
   - Vercel·Cloudflare 중 primary와 standby
   - 모바일 앱의 API base URL과 운영 도메인
   - 시크릿 전달 채널, 개발자 계정, 서명 인증서 소유 주체

Day 3 종료 게이트:

- 전달 대상 commit/tag가 하나로 특정된다.
- ZIP을 작업 폴더에서 직접 만들지 않는다.
- `node_modules`, `.env*`, 빌드 산출물, 백업, 개인 문서가 포함되지 않는다.
- 범소프트웨어가 문서만 보고 clean clone build를 재현할 수 있다.

## 관리자 화면 리뉴얼 시 전달 원칙

화면 파일을 각각 별도 제품처럼 전달하지 않는다. 하나의 소스 안에서 역할별 업무 모듈로 전달한다.

| 업무 영역 | 현재 경로 | 사용자 | 업체 리뉴얼 방향 |
|---|---|---|---|
| 현장 운영 | `/admin` | 안전관리자·현장관리자·팀장 | 모바일/태블릿 중심 업무 화면 |
| 본사 관제 | `/control` | 본사 관리자 | 다현장 요약·사고·증빙 중심 |
| 시스템 관리 | `/system` | 슈퍼관리자·허용된 본사 담당 | 고객사·현장·계정·권한 관리 |
| 개발 운영 | `/root` | 지정 개발자만 | 일반 메뉴에서 숨기고 별도 보호 |
| 근로자 | `/worker` | 근로자 | Android/iOS 네이티브 우선 |

`/control`과 `/system`은 동일한 본사 포털 셸을 사용할 수 있지만 권한과 API는 분리한다. `/root`는 고객 관리자 화면에 합치지 않는다.

## 이번 2~3일 범위에서 하지 않는 작업

- 운영 RLS 적용 또는 운영 데이터 수정
- 운영 키 교체와 실제 키 전달
- 관리자 UI 전면 재설계
- Android/iOS 네이티브 앱 완성
- FCM/APNs, 앱스토어·플레이스토어 제출
- iOS NFC, 오프라인 동기화, SaaS 과금
- 실험용 온디바이스 STT/TTS의 Cloudflare 완전 지원

이 항목은 범소프트웨어의 아키텍처·계약 결정 후 별도 개발 범위로 넘긴다.

## 첫 실행 Goal

> SAFE-LINK V2의 기존 PoC 동작과 사용자 WIP를 보존하면서 H-01~H-04를 완료한다. 미추적 파일을 분류하고 ESLint 검사 범위를 실제 소스로 제한하며, 배포 release SHA 계약과 웹 CI를 추가한다. `npm ci`, TypeScript, lint, production build, 민감정보 검사, GitHub CI를 모두 통과한 경우에만 완료하고 운영 배포·DB·시크릿은 변경하지 않는다.

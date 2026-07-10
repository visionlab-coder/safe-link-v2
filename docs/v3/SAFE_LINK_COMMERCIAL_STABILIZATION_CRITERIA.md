# SAFE-LINK 상용화 안정화 조건

작성일: 2026-07-07

이 문서는 SAFE-LINK / SQ Link V3 상용화 리팩토링의 고정 기준이다. 인증, 권한, 세션, 현장 격리, AI 비용 통제, 서명, 채팅, 운영 모니터링 작업을 할 때는 이 문서를 먼저 확인하고, 완료 보고 시 각 항목의 적용 여부와 검증 근거를 함께 남긴다.

## 적용 원칙

- 단순 화면 수정이 아니라 상용 SaaS 운영 기준의 보안, 권한, 데이터 격리, 장애 대응, 비용 통제 리팩토링으로 본다.
- 기존 Supabase, Next.js API route, Cloudflare Workers, Service Role 기반 흐름은 그대로 확장하지 않고 Spring Boot API 중심으로 이전한다.
- 비밀값은 문서, 로그, 채팅에 출력하지 않는다. 필요한 경우 `SET`, `EMPTY`, `MISSING` 상태만 기록한다.
- 체크리스트가 완료되었다고 하려면 코드 반영, 빌드/테스트, 로컬 또는 스테이징 검증 근거가 있어야 한다.
- iOS/Android 앱 배포 기준에서는 프론트 도메인보다 Spring Boot API 도메인과 HTTPS, CORS, 모바일 런타임 API base URL이 더 중요하다.

## 안정화 조건

### 1. RLS / 권한 정책 재정비

- 현장, 역할별 데이터 격리가 필요하다.
- 현재 저장소에 RLS 미완성 문제가 명시되어 있으므로 Supabase RLS에만 의존하지 않는다.
- Spring Boot API에서 사용자 역할, 소속 현장, 요청 리소스의 `site_id`를 서버에서 검증한다.

### 2. Role Contract 통일

- UI, API, DB, Seed, 운영 문서의 역할 문자열을 통일한다.
- 기준 역할은 아래를 기본으로 한다.

```text
ROOT
HQ_ADMIN
SITE_ADMIN
SAFETY_MANAGER
WORKER
VIEWER
```

- 레거시 역할명이 남아 있으면 신규 Role Contract로 매핑하거나 제거한다.

### 3. 관리자 권한 셀프 승격 차단

- 회원가입자가 직접 관리자 권한을 선택하는 구조를 금지한다.
- 기존 제품의 관리자 직접 가입 기능은 유지한다. 단, 가입 request의 role, `site_id`, 권한 범위 입력은 신뢰하지 않고 서버가 허용한 기본 role만 부여한다.
- `ROOT`, `HQ_ADMIN`, site permission 확장, role 변경은 초대, 승인, 상위 권한자 부여, 통제된 운영 절차 중 하나로만 처리한다.
- 최초 ROOT 계정 bootstrap 방식은 별도 운영 절차로 제한한다.

### 4. 현장 간 데이터 격리 강화

- `site_id`가 없거나 검증되지 않은 요청이 전체 데이터를 조회하지 못하게 한다.
- 현장 관리자, 안전 관리자, 근로자는 소속 현장 범위 안에서만 데이터 접근이 가능해야 한다.
- 본사/ROOT 권한도 감사 로그가 남아야 한다.

### 5. Service Role 사용 범위 축소

- Service Role은 RLS를 우회하므로 최소 route에서만 사용한다.
- Service Role을 사용하는 모든 호출은 사용자 권한과 현장 검증을 선행해야 한다.
- 신규 핵심 기능은 Service Role 직접 호출 대신 Spring Boot API로 이전한다.

### 6. 인증 쿠키 / 세션 보안 재검토

- 클라이언트에서 읽을 수 있는 세션 쿠키와 토큰 구조를 제거하거나 축소한다.
- XSS 발생 시 토큰 탈취를 막기 위해 HttpOnly, Secure, SameSite 쿠키 기반 서버 세션을 우선한다.
- Spring Security, Spring Session, Redis를 기준으로 로그인, 로그아웃, 내 정보, 세션 만료, CSRF/CORS를 검증한다.
- 브라우저에 노출되는 `NEXT_PUBLIC_*` 값에는 secret, API key, DB password를 넣지 않는다.

### 7. 번역 / STT / TTS 비용 통제

- 외부 AI API 호출은 Spring Boot AI Gateway 뒤로 모은다.
- Google Translate/STT/TTS, Naver Papago, OpenAI 등은 Redis 기반 rate limit과 quota를 적용한다.
- 장애 fallback, timeout, 재시도 제한, 사용량 로그, 비용 추적 기준을 둔다.
- 실시간 번역은 장애와 비용 리스크가 크므로 별도 제한 정책을 둔다.

### 8. 서명 데이터 저장 방식 개선

- 서명 이미지를 DB text/base64로 장기 저장하지 않는다.
- 서명 이미지는 Object Storage에 저장하고 PostgreSQL에는 object key, hash, size, content type, 작성자, 작성 시각, IP/user agent 등 audit metadata를 저장한다.
- 서명 데이터 조회와 다운로드는 권한 검증 후 presigned URL 또는 서버 프록시 방식으로 처리한다.

### 9. 채팅 정합성 보강

- 메시지 전송, 조회, 읽음 처리, 번역 보정은 서버 API 중심으로 관리한다.
- 중복 전송, 읽음 누락, 번역 결과 불일치, 권한 우회를 줄이기 위해 transaction과 idempotency 기준을 둔다.
- 채팅 조회는 `site_id`와 conversation/thread 권한을 함께 검증한다.
- Realtime은 Spring WebSocket 또는 SSE로 이전하는 것을 기본 방향으로 한다.

### 10. 운영 Health Check / Logging 구축

- 배포 전후 API, DB, Redis, Object Storage, 번역, 음성, 알림 상태를 확인할 수 있어야 한다.
- Spring Actuator, Micrometer, OpenTelemetry, 중앙 로그 수집을 기준으로 운영 관측성을 구축한다.
- 배포 후 liveness/readiness, 주요 API smoke test, DB migration 상태, AI vendor 상태, 알림 상태를 확인한다.

## 변경 기술 스택 기준

### Frontend

- Next.js 유지
- React 유지
- TypeScript 유지
- Tailwind CSS 유지
- Motion 기본 사용
- GSAP은 필요한 곳에 제한적으로만 사용

### Backend

- Spring Boot 도입
- Spring Security 사용
- REST API 중심
- WebSocket 또는 SSE 사용
- Spring Actuator 사용
- 인증, 권한, 트랜잭션, 감사 로그, 운영 모니터링은 Spring Boot가 책임진다.

### Database

- PostgreSQL 직접 운영
- Flyway 또는 Liquibase로 schema migration 관리
- Supabase 의존도를 낮추고 schema, migration, 권한, backup 정책을 직접 관리한다.

### Cache / Rate Limit

- Redis 도입
- 로그인, 세션, 번역, STT, TTS, 관리자 기능의 분산 rate limit과 quota에 사용한다.

### Storage

- S3, Cloudflare R2, MinIO 계열 Object Storage 도입
- 서명 이미지, 첨부 파일, 음성 파일은 DB가 아니라 Object Storage에 저장한다.

### Realtime

- Spring WebSocket 또는 SSE 사용
- Supabase Realtime 의존을 줄인다.

### AI / Translation Gateway

- Spring Boot 내부 서비스에서 Google Translate/STT/TTS, Naver Papago, OpenAI 등 vendor를 연동한다.
- vendor 직접 호출을 프론트와 Next.js route에 흩뿌리지 않는다.

### Infra / DevOps

- Docker 사용
- GitHub Actions 또는 사내 CI/CD 사용
- Secret Manager 사용
- 중앙 로그/모니터링 사용

### Testing

- JUnit
- Testcontainers
- Playwright
- API Contract Test

### 운영 모니터링

- Spring Actuator
- Micrometer
- OpenTelemetry
- Log Aggregation

## Supabase / Cloudflare Workers 처리 기준

- Supabase Auth, Realtime, RLS, Service Role 의존은 제거 또는 보조화한다.
- 권한 책임은 Spring Boot API 중심으로 변경한다.
- Cloudflare Workers 백엔드는 제거를 검토한다.
- Workers 환경 우회 코드가 많아 운영 난도가 높으므로 Spring Boot 서버 런타임으로 단순화하는 것을 기본 방향으로 한다.

## 도메인 / 앱 배포 기준

- iOS/Android 앱 배포 시 운영 API 도메인은 필수다.
- 예시 운영 구조:

```text
프론트/관리자 웹: https://safelink.seowon.co.kr
Spring Boot API: https://api.safelink.seowon.co.kr
```

- Next.js 웹은 `NEXT_PUBLIC_SAFE_LINK_API_BASE_URL`로 Spring Boot API를 호출한다.
- 모바일 앱은 `VITE_SAFE_LINK_API_BASE_URL` 또는 모바일 런타임 설정으로 Spring Boot API를 호출한다.
- 실제 도메인은 서원건설의 승인, DNS 설정, 서버 IP, HTTPS 인증서, CORS 설정이 모두 맞아야 동작한다.

## 완료 판단 기준

아래 조건을 모두 만족해야 "상용화 핵심 리팩토링 1차 완료"로 보고한다.

- Spring Boot 백엔드 빌드와 실행이 가능하다.
- 인증, 세션, 권한이 Spring Boot 중심으로 동작한다.
- 관리자 셀프 승격이 차단되어 있다.
- 역할 문자열이 UI, API, DB, seed, 문서에서 통일되어 있다.
- `site_id` 기반 현장 격리가 서버에서 강제된다.
- Service Role 사용 목록과 최소화 근거가 문서화되어 있다.
- HttpOnly/Secure/SameSite 기반 세션 보안이 검증되어 있다.
- AI/번역/STT/TTS에 Redis rate limit과 quota가 적용되어 있다.
- 서명 이미지는 Object Storage + hash + audit metadata 구조로 저장된다.
- 채팅 전송, 읽음, 번역 보정이 서버 API 중심으로 검증되어 있다.
- Actuator Health Check와 로그 확인 절차가 있다.
- Next.js 빌드, Spring Boot 빌드, 핵심 QA, API smoke test 결과가 남아 있다.

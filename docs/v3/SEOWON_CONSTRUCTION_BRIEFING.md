# SAFE-LINK V3 코드 리팩토링 브리핑

작성일: 2026-07-10

대상: 대표 및 프로젝트 참여자

범위: V2 디자인·기능 유지, 내부 코드 리팩토링

## 1. 변경 사항

### 기존 디자인과 기능 유지

- V2의 화면 디자인, 주요 URL, 관리자·근로자 사용 흐름을 유지했다.
- 화면 기능을 새로 추가하거나 사용자 동선을 임의로 변경하지 않았다.
- 기존 Next.js route는 URL·JSON 호환 계층으로 유지하고, 실제 인증·권한·데이터 처리는 Spring Boot가 담당하도록 변경했다.

### 인증·권한 구조 변경

- Spring Security + Redis 기반 HttpOnly 서버 세션으로 전환했다.
- 관리자 회원가입은 즉시 권한을 주지 않고 `PENDING` 상태로 생성한 뒤 상위 관리자가 승인하도록 변경했다.
- Role Contract를 `ROOT`, `HQ_ADMIN`, `SITE_ADMIN`, `SAFETY_MANAGER`, `WORKER`, `VIEWER`로 통일했다.
- 사용자 역할, 현장 소속, 대상 데이터의 `site_id`를 Spring Boot가 검증하도록 변경했다.

### 데이터·파일 저장 구조 변경

- 핵심 업무 데이터를 PostgreSQL + Flyway 구조로 전환했다.
- TBM, 서명, 채팅, QR/NFC, 보고서 검증을 Spring API와 PostgreSQL 중심으로 정리했다.
- 서명·첨부·음성 파일은 Object Storage에 저장하고 PostgreSQL에는 object key, hash, 크기, 작성자, 감사 메타데이터를 저장하도록 변경했다.

### 실시간 기능 변경

- Chat, Live Interpreter, Travel Talk를 Spring SSE 방식으로 변경했다.
- 기존 polling, no-op 채널, Pusher 의존을 제거했다.
- 메시지 읽음 처리, 번역 보정, 실시간 알림을 서버 API 중심으로 관리하도록 변경했다.

### Flitto 대체 실시간 번역 적용

- Flitto 라이선스 종료에 따라 현재 주력 공급자 조합으로 대체 구현을 완료했다.
- 실시간 통역 기본 경로는 `Google STT -> Naver Papago -> Google Translate fallback`이다.
- 음성 출력은 Google TTS를 사용한다.
- Papago 실제 번역과 Google TTS -> STT 왕복 테스트를 통과했다.
- Flitto와 Gemini는 현재 런타임에서 사용하지 않는다.

### 레거시 의존 정리

- Supabase Auth, RLS, Realtime, Service Role 런타임 의존을 제거했다.
- Pusher와 Gemini 런타임 의존을 제거했다.
- 운영 상태 명칭을 `supabase`, `pusher`에서 `postgresql`, `realtime`로 변경했다.

## 2. 남은 변경 사항

현재 확인된 **애플리케이션 코드 리팩토링 잔여 항목은 없다.** 아래 항목은 외부 서비스 활성화, 데이터 이관, 배포, 운영 인프라, 고객사 검수 범위다.

1. OpenAI 결제·사용 한도 활성화
   - API key는 연결됐지만 현재 계정이 `insufficient_quota` 상태다.
   - 텍스트 생성과 OpenAI Vision 운영 테스트는 계정 한도 활성화 후 수행한다.

2. Google Cloud Vision API 활성화
   - Spring fallback 코드는 구현됐지만 현재 Google 프로젝트에서 `SERVICE_DISABLED` 상태다.

3. 운영 데이터 마이그레이션
   - 기존 Supabase 운영 데이터와 파일을 운영 PostgreSQL·Object Storage로 이관해야 한다.

4. 운영 Object Storage 구성
   - S3, Cloudflare R2, MinIO 중 운영 저장소를 확정하고 bucket, region, endpoint, 접근 권한을 설정해야 한다.

5. 운영 도메인·보안 설정
   - HTTPS, Secure cookie, cookie domain, CORS origin, Secret Manager를 운영 값으로 적용해야 한다.

6. 중앙 로그·배포 자동화
   - OpenTelemetry, Log Aggregation, 장애 알림, CI/CD, 백업·복구 정책을 운영 환경에 적용해야 한다.

7. 고객사 UAT
   - 실제 관리자·근로자 계정, 모바일 기기, 현장 네트워크에서 전체 기능을 최종 검수해야 한다.

8. Cloudflare/OpenNext 배포 설정 정리
   - 백엔드 책임은 Spring Boot로 이전했다. Cloudflare/OpenNext·Wrangler 설정은 최종 배포 방식 확정 후 유지 또는 제거한다.

## 3. 안정화 조건

### 1. RLS / 권한 정책 재정비

**조건**

현장·역할별 데이터 격리가 필요하며, 기존 저장소에도 RLS 미완성 문제가 명시돼 있다.

**적용 내용**

Supabase RLS를 V3 권한 기준으로 사용하지 않고 Spring Boot를 권한 판단 지점으로 변경했다. 모든 핵심 API에서 사용자 역할, 현장 소속, 대상 데이터의 `site_id`를 서버가 검증하고 권한이 없으면 요청을 거부한다.

### 2. Role Contract 통일

**조건**

UI, API, DB, Seed, 운영 문서의 역할 문자열이 다르면 관리자·근로자 접근 제어에 문제가 발생할 수 있다.

**적용 내용**

역할을 `ROOT`, `HQ_ADMIN`, `SITE_ADMIN`, `SAFETY_MANAGER`, `WORKER`, `VIEWER`로 통일했다. Backend, Frontend helper, DB constraint, 관리자 승인 API와 운영 문서가 같은 Role Contract를 사용하도록 정리했다.

### 3. 관리자 권한 셀프 승격 차단

**조건**

회원가입자가 관리자 권한을 직접 선택하는 구조를 차단하고 초대·승인 기반으로 권한을 부여해야 한다.

**적용 내용**

공개 관리자 가입은 `PENDING` 계정만 생성하고 로그인 세션이나 관리자 권한을 즉시 발급하지 않는다. 상위 권한자가 승인 API에서 역할과 현장을 지정해야 활성화되며, `ROOT`는 별도의 통제된 bootstrap 절차로만 생성할 수 있다.

### 4. 현장 간 데이터 격리 강화

**조건**

`site_id`가 없는 경우 조회가 전체 현장으로 열릴 수 있는 구조는 SaaS 운영 기준에서 위험하다.

**적용 내용**

명시적인 전역 기준 데이터를 제외한 핵심 업무 요청은 `site_id`가 없으면 거부한다. URL이나 request body의 `site_id`를 그대로 신뢰하지 않고 서버의 site membership과 대상 리소스 현장을 대조하며, 본사·ROOT 예외 접근도 감사 로그를 남긴다.

### 5. Service Role 사용 범위 축소

**조건**

Service Role은 RLS를 우회하므로 최소 route에서만 사용하고 모든 호출에 현장 검증이 필요하다.

**적용 내용**

V3 핵심 런타임에서 Supabase Service Role 직접 호출을 제거했다. 인증·권한·데이터 조회·보고서 검증은 Spring Boot 세션과 site guard를 사용하며, Supabase는 현재 권한 기준으로 사용하지 않는다.

### 6. 인증 쿠키 / 세션 보안 재검토 ★★★★★★★★★★★★★

**조건**

클라이언트에서 읽을 수 있는 세션 쿠키는 XSS 발생 시 토큰 탈취 위험이 크므로 가장 높은 우선순위로 보강해야 한다.

**적용 내용**

브라우저에서 읽을 수 있는 Supabase JWT cookie fallback을 제거하고 Spring Security + Redis 기반 `SAFE_LINK_SESSION` HttpOnly 서버 세션으로 변경했다. CSRF 보호, 세션 만료, 로그아웃, SameSite 정책을 적용했다. 운영 환경에서는 HTTPS와 함께 `Secure` cookie, production domain, CORS origin을 최종 적용해야 한다.

### 7. 번역·STT·TTS 비용 통제 ★★★★★★★

**조건**

외부 AI API는 장애와 비용 위험이 크며, 실시간 번역 특성상 Redis 기반 rate limit과 quota가 필요하다.

**적용 내용**

번역, STT, TTS, Vision 호출을 Spring AI Gateway 내부로 이전했다. Redis rate limit/quota, timeout, 제한된 fallback, 사용자·현장 검증, `ai_usage_logs`, 감사 로그를 적용했다. 실시간 번역은 Google STT, Papago, Google Translate fallback으로 구성하고 실제 번역·음성 왕복 테스트를 통과했다.

### 8. 서명 데이터 저장 방식 개선

**조건**

서명 이미지는 DB text 저장보다 Object Storage + hash + audit metadata 구조가 안전하다.

**적용 내용**

서명 base64/text 저장 경로를 Object Storage 기반으로 변경했다. PostgreSQL `file_objects`에는 object key, SHA-256 hash, MIME type, byte size, 작성자, 상태와 감사 정보를 저장한다. 운영 bucket 구성은 배포 단계에서 적용한다.

### 9. 채팅 정합성 보강

**조건**

메시지 전송, 읽음 처리, 번역 보정을 서버 API 중심으로 관리해야 중복·누락·권한 문제를 줄일 수 있다.

**적용 내용**

메시지 조회·전송·읽음·번역 보정을 Spring API와 PostgreSQL에서 처리한다. thread 참여자와 `site_id`를 검증하고 활성 대화·사용자 알림은 Spring SSE로 전달한다. 기존 화면 URL과 응답 형식은 유지했다.

### 10. 운영 Health Check / Logging 구축 ★★★★★★★★★★★★★★★★

**조건**

배포 전후 API, DB, 번역, 음성, 알림 상태를 배포 현황으로 검증할 수 있어야 한다.

**적용 내용**

Spring Actuator liveness, readiness, AI, storage health와 audit/AI usage log 기반을 구성했다. 로컬 검증에서는 API, PostgreSQL, Redis, AI provider 상태와 핵심 SSE 흐름을 확인했다. OpenTelemetry exporter, 중앙 로그 수집, 대시보드, 장애 알림은 운영 인프라 적용 범위로 남아 있다.

## 4. 변경 기술 스택

### 1. Next.js + React + TypeScript 유지

기존 화면 디자인, 주요 URL, 관리자·근로자 기능 흐름을 유지하기 위해 Frontend core stack을 그대로 사용한다.

### 2. Tailwind CSS 유지

기존 스타일 체계를 유지해 디자인 변경 없이 컴포넌트와 반응형 레이아웃을 관리한다.

### 3. Spring Boot 백엔드 도입

인증, 권한, 트랜잭션, 현장 검증, 감사 로그, AI Gateway, 운영 모니터링을 Spring Boot가 통제한다.

### 4. PostgreSQL 직접 운영

Supabase 의존을 제거하고 schema, migration, 관계, 권한, backup 정책을 개발사가 직접 관리할 수 있도록 PostgreSQL + Flyway 구조로 변경했다.

### 5. Redis 도입

로그인 세션, 번역·STT·TTS quota, rate limit, cache와 실시간 상태 관리에 사용한다.

### 6. Object Storage 도입

서명 이미지, 첨부 파일, 음성 파일을 S3, Cloudflare R2, MinIO 호환 Object Storage에 저장하고 DB에는 metadata만 저장한다.

### 7. Motion 기본 사용

기존 UI를 유지하면서 앱 내부 전환, 모달, 리스트, 버튼 인터랙션에는 React 친화적인 Motion을 사용한다. GSAP은 복잡한 연출에만 제한적으로 사용한다.

### 8. Supabase 제거 또는 보조화

현재 V3 핵심 런타임에서는 Supabase Auth, Realtime, RLS, Service Role 의존을 제거했다. 과거 migration과 운영 데이터는 이관 참고 자료로만 남긴다.

### 9. Cloudflare Workers 백엔드 제거 검토 ★★★★★★

인증·권한·업무 API·AI·실시간 백엔드 책임은 Spring Boot 서버 런타임으로 이전했다. Cloudflare/OpenNext는 Frontend 배포 방식이 확정될 때까지 배포 설정으로만 남겨 두고 최종적으로 유지 또는 제거한다.

## 5. Frontend / Backend / Database 등 구성

### Frontend

**구성**

Next.js + React + TypeScript + Tailwind CSS + Motion + GSAP 제한 사용

**적용 내용**

기존 디자인과 주요 URL·사용 흐름을 유지하며, 보안 판단과 데이터 처리는 Spring API에 위임한다.

### Backend

**구성**

Spring Boot + Spring Security + REST API + SSE + Spring Actuator

**적용 내용**

인증, 세션, 권한, 현장 검증, 트랜잭션, 감사 로그, AI Gateway, 실시간 이벤트를 담당한다.

### Database

**구성**

PostgreSQL + Flyway

**적용 내용**

사용자, 현장 소속, TBM, 서명 메타데이터, 채팅, 사용량·감사 로그를 관리한다. 현재 구현은 Flyway를 사용하며 Liquibase는 사용하지 않는다.

### Cache / Rate Limit

**구성**

Redis

**적용 내용**

Spring Session, 로그인 제한, AI rate limit/quota, cache와 실시간 상태를 관리한다.

### Storage

**구성**

S3 / Cloudflare R2 / MinIO 호환 Object Storage

**적용 내용**

서명, 첨부, 음성 파일을 저장하며 PostgreSQL에는 object key, hash와 감사 metadata를 저장한다.

### Realtime

**구성**

Spring SSE

**적용 내용**

Chat, Live Interpreter, Travel Talk 이벤트를 전달한다. 현재 구현은 SSE를 사용하며 WebSocket은 향후 양방향 연결이 필요한 경우에만 검토한다.

### AI / Translation Gateway

**구성**

Spring Boot + Google Translate/STT/TTS + Naver Papago + OpenAI + Google Cloud Vision fallback

**적용 내용**

실시간 통역은 `Google STT -> Papago -> Google Translate fallback`, 음성 출력은 Google TTS를 사용한다. OpenAI는 텍스트 생성·Vision 우선 경로이며 현재 계정 quota 활성화가 필요하다. Google Cloud Vision은 fallback 코드가 구현돼 있으나 API 활성화가 필요하다. Gemini와 Flitto는 현재 사용하지 않는다.

### Infra / DevOps

**구성**

Docker + GitHub Actions 또는 사내 CI/CD + Secret Manager + 중앙 로그/모니터링

**적용 내용**

코드와 설정 기준은 마련했으며 실제 서버, CI/CD, Secret Manager, 백업, 중앙 로그 구성은 운영 배포 범위다.

### Testing

**구성**

JUnit + Spring Boot Test + Testcontainers + Playwright + API Contract Test

**적용 내용**

현재 Spring Boot test 30개, bootJar, Next.js production build, npm audit, 주요 API/SSE smoke test를 통과했다. Testcontainers, Playwright 전체 화면 회귀, API Contract Test 확대는 운영 전 QA 범위다.

### 운영 모니터링

**구성**

Spring Actuator + Micrometer + OpenTelemetry + Log Aggregation

**적용 내용**

Actuator health와 애플리케이션 audit/usage log는 구현했다. Micrometer exporter, OpenTelemetry 수집기, 중앙 대시보드와 장애 알림은 운영 인프라에서 연결해야 한다.

## 최종 정리

Next.js + React + TypeScript + Tailwind CSS + Motion을 Frontend 표준으로 유지하고, Spring Boot + PostgreSQL + Redis + Object Storage를 Backend 표준으로 재구성했다. 코드 리팩토링은 로컬 기준으로 완료했으며, 남은 항목은 외부 API 계정 활성화, 운영 데이터 이관, 배포 인프라, 중앙 모니터링, 고객사 UAT다.

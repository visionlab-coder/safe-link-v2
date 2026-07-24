# SQ Link V3 클라이언트 입력 정리

상태: V3 기준 요구사항 초안  
범위: 클라이언트 제공 요구사항, 기술 스택, 보안 우려, 운영 필요사항  
최종 수정일: 2026-07-08

## 프로젝트 위치

SQ Link V3는 현재 워크스페이스의 활성 개발 대상이다. 이 V3 프로젝트는 타 회사가 빠르게 만든 기존 프로젝트를 상용화하기 위한 외주 개발 프로젝트다. 실제 레거시 프로젝트는 별도 경로에 있으며, 이 작업 디렉터리 안의 파일을 레거시 원본으로 간주하지 않는다.

현재 워크스페이스에 남아 있는 V2 명칭, PoC 문서, Supabase migration, Workers/OpenNext 설정, route handler는 제품 흐름과 마이그레이션 리스크를 파악하기 위한 참고 자료로만 사용한다. V3 운영 아키텍처로 그대로 복사하지 않는다. V3는 V2를 복제하는 것이 아니라 운영 가능한 SaaS 구조로 재설계한다.

제품 목표는 건설 현장의 외국인 근로자와 관리자를 위한 운영 커뮤니케이션 SaaS다. 시스템은 TBM 전달, 다국어 번역, 근로자 확인/서명, 관리자 모니터링, 1:1 채팅, 현장 단위 데이터 격리, 감사 로그, AI 비용 통제, 운영 모니터링을 지원해야 한다.

## 요구 기술 스택

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Motion
- Backend: Spring Boot, Spring Security, REST API, WebSocket 또는 SSE, Spring Actuator
- Database: 자체 운영 PostgreSQL, Flyway
- Cache / Rate limit: Redis
- Storage: S3, Cloudflare R2, MinIO 또는 호환 Object Storage
- Realtime: 상태/알림은 SSE 우선, 양방향 채팅이나 스트리밍 번역에는 WebSocket 검토
- AI Gateway: Spring Boot 내부 서비스에서 Google Translate/STT/TTS, Naver Papago, OpenAI, 향후 vendor 연동
- Infra: Docker, GitHub Actions 또는 사내 CI/CD, Secret Manager, 중앙 로그/모니터링
- Testing: JUnit, Testcontainers, Playwright, API contract test
- Monitoring: Spring Actuator, Micrometer, OpenTelemetry, Log Aggregation

## 아키텍처 계약

목표 요청 흐름은 다음과 같다.

```text
Browser -> Next.js Frontend -> Spring Boot API -> PostgreSQL / Redis / Object Storage / AI Vendors
```

Next.js는 UI, SSR, 프론트 상태, 필요한 경우 가벼운 BFF 조합만 담당한다. 인증, 권한, 트랜잭션, 감사 로그, 파일 접근 권한, AI 호출 권한은 Spring Boot가 책임진다.

Supabase Auth, Supabase Realtime, Supabase RLS, Service Role 의존, Cloudflare Workers 백엔드 동작은 V3의 권한 기준이 아니다. 레거시 구현 참고 자료로 분석할 수는 있지만, 운영 보안 모델로 복사하지 않는다.

## 보안 요구사항

- Access token을 `localStorage`에 저장하지 않는다.
- 장기 token을 클라이언트 JavaScript가 읽을 수 있는 위치에 저장하지 않는다.
- HttpOnly, Secure, SameSite 기반 cookie session을 사용한다.
- Cookie 인증과 함께 CSRF 방어를 설계한다.
- 실제 role, site permission, session state는 서버 또는 Redis에 저장한다.
- 가입 과정에서 사용자가 관리자 role, `site_id`, 권한 범위를 직접 선택하거나 request body로 조작하지 못하게 한다.
- 기존 제품의 관리자 직접 가입 기능은 유지한다. 이 경우 서버는 공개 가입자를 `PENDING` 계정으로만 생성하고, 클라이언트 입력으로 `ROOT`, `HQ_ADMIN`, 현장 권한 등을 정하지 못하게 한다.
- `ROOT`, `HQ_ADMIN`, 현장 범위 확장, role 변경, site permission 변경은 상위 권한자 또는 통제된 운영 절차에서만 처리한다.
- 신규 근로자는 명시적으로 등록되거나 승인되지 않는 한 `WORKER` 또는 pending 상태로 시작한다.
- role 변경, site permission 변경, 관리자 승인/거절, session 재발급은 audit log로 남긴다.

## Role Contract

초기 V3 role contract는 다음과 같다.

- `ROOT`: 플랫폼 소유자 또는 비상 운영자.
- `HQ_ADMIN`: 여러 현장을 관리할 수 있는 본사 관리자.
- `SITE_ADMIN`: 현장 단위 관리자.
- `SAFETY_MANAGER`: TBM과 안전 업무 중심의 현장 안전 관리자.
- `WORKER`: 하나 이상의 현장에 소속된 근로자 계정.
- `VIEWER`: 읽기 전용 감사자 또는 이해관계자.

이 role set은 UI, API, DB, seed, test, 운영 문서 전반에서 하나의 계약으로 관리한다. 화면, API handler, DB row, 문서 사이에서 role 문자열이 어긋나면 안 된다.

## Site Isolation 요구사항

모든 업무 데이터는 `site_id`로 격리한다. `site_id` 없는 업무 데이터 접근은 기본적으로 거부한다.

서버는 request body의 `site_id`를 그대로 신뢰하지 않는다. 요청 대상 row의 `site_id`를 인증된 session의 허용 site 목록과 비교해야 한다. `ROOT`와 허가된 HQ role을 제외하면 모든 read, create, update, delete는 사용자의 허용 site 범위 안에서만 가능해야 한다.

## 파일 저장 요구사항

서명 이미지, 첨부 파일, 음성 파일은 DB text column에 저장하지 않는다. 파일은 Object Storage에 저장하고 PostgreSQL에는 metadata만 저장한다.

- object key
- SHA-256 hash
- MIME type
- size
- owner user id
- `site_id`
- purpose
- created timestamp
- audit metadata

파일 접근에는 public URL을 사용하지 않는다. Spring Boot가 권한을 검증한 뒤 짧은 수명의 presigned URL을 발급한다.

## AI Gateway 요구사항

번역, STT, TTS, AI chat은 Spring Boot AI Gateway를 통해 호출한다. 프론트엔드가 Google, Papago, OpenAI 등 외부 vendor를 직접 호출하지 않는다.

필수 통제 항목:

- Redis 기반 rate limit과 quota.
- 사용자, 현장, 기능 단위 quota.
- 반복 TBM 문장 또는 반복 번역 cache.
- Vendor 장애 시 circuit breaker와 fallback.
- 모든 AI 호출에 대해 vendor, model, input size, output size, duration, estimated cost를 기록.

## Realtime 요구사항

TBM 서명 상태, 알림, 관리자 dashboard에는 SSE를 우선 사용한다.

1:1 채팅이나 실시간 번역 스트리밍처럼 양방향 동작이 필요한 경우 WebSocket을 사용한다. 다중 서버 확장을 위해 Redis Pub/Sub 또는 message broker를 나중에 붙일 수 있도록 구조를 열어 둔다.

## V2에서 아이디어로 가져올 것

- TBM 작성, 전달, 확인, 서명 흐름.
- 근로자 중심의 TBM 확인 화면과 큰 action UX.
- 관리자 TBM 상태 dashboard.
- 1:1 번역 채팅 개념.
- 건설 용어집과 한국어 정규화 개념.
- 언어 선택과 발음 지원 아이디어.
- PoC checklist 운영 습관.
- Health check 가시화 아이디어.
- 법적 증거성에 도움이 되는 hash/audit chain 개념.

## V2에서 버릴 것

- 사용자가 직접 관리자 role을 선택하는 구조.
- 클라이언트에서 읽을 수 있는 장기 session 또는 token 저장.
- 넓은 Service Role 의존.
- `site_id` 없는 업무 데이터 접근 예외.
- 권한 책임이 Supabase Auth, RLS, Realtime, frontend check에 분산된 구조.
- Cloudflare Workers runtime 우회 코드를 백엔드 기반으로 삼는 구조.
- 서명 이미지나 음성을 DB text로 저장하는 구조.
- 외부 AI API를 quota 없이 직접 호출하는 구조.

## 1차 마일스톤 수락 기준

- 현재 V3 프로젝트 구조를 이해하고 문서화했다.
- 세 개의 V3 문서가 분리되어 있다.
- Role Contract가 정의되어 있다.
- Spring Security session/cookie 정책이 문서화되어 있다.
- 기존 관리자 직접 가입 흐름은 유지하면서, role/site 조작 입력은 서버에서 거부한다.
- 관리자 초대/승인 흐름은 기존 기능을 대체하는 필수 조건이 아니라 향후 운영용 추가 흐름으로 설계되어 있다.
- `site_id` 없는 업무 데이터 접근은 기본적으로 거부된다.
- PostgreSQL/Flyway 초기 schema 초안이 있다.
- Redis rate limit과 quota 정책 초안이 있다.
- Object Storage 정책 초안이 있다.
- `audit_log` 구조가 있다.
- Actuator health check 기준이 있다.

## 1차 구현 경계

첫 구현은 TBM, chat, translation 화면부터 시작하지 않는다. 먼저 운영 기반을 만든다.

- authentication
- authorization
- `site_id` isolation
- audit logs
- Redis rate limits and quota
- object storage abstraction
- Actuator health checks

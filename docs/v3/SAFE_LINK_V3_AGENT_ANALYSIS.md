# SQ Link V3 기술 분석

상태: 초기 기술 분석 및 2026-07-10 구현 결과 반영  
범위: 엔지니어링 판단, 리스크, 레거시 keep/reject 목록, 권장 아키텍처  
최종 수정일: 2026-07-10

## 구현 진행 상태

2026-07-06:

- `backend/`에 Spring Boot backend module을 추가했다.
- Backend는 V3에서 session, role/site authorization, audit logging, AI quota, object storage file metadata, chat transport, health check의 기준 authority가 된다.
- 기존 Next.js/Supabase API surface는 아직 제거되지 않았다. Frontend가 Spring API로 재연결되기 전까지 compatibility code로 본다.

2026-07-07:

- `/auth` 관리자 password login은 V3 Spring Boot auth helper를 먼저 호출하고 Spring `SAFE_LINK_SESSION` authority path를 사용한다.
- Next.js middleware, `/api/auth/me`, client `RoleGuard`는 session authority로 Spring Boot `/api/v1/auth/me`를 사용한다.
- 공개 관리자 signup은 기존 기능으로 유지하되 Spring Boot 세션 기반으로 이전했다. 가입 요청에서 role/site 권한 입력을 받는 self-assignment만 차단한다.
- Worker quick login은 Spring Boot `/api/v1/auth/worker-quick-login`을 통한다. 권한 있는 admin은 `/api/v1/sites/{siteId}/workers`를 통해 V3 worker identity를 만들 수 있다.

2026-07-10:

- 인증, 권한, TBM, 서명, 채팅, QR/NFC, AI, 실시간 통역/Travel 핵심 route를 Spring Boot API 또는 Spring proxy 구조로 이전했다.
- Supabase Auth/RLS/Realtime/Service Role, Pusher, Gemini 런타임 의존을 제거했다. 과거 migration과 Cloudflare/OpenNext 배포 설정은 참고 자료로 남아 있다.
- 실시간 통역 기본 경로는 Google STT + Papago + Google Translate fallback이며, Chat/Live Interpreter/Travel Talk는 Spring SSE를 사용한다.
- 코드 리팩토링은 로컬 기준 완료했으며 OpenAI quota, Google Cloud Vision API 활성화, 운영 배포/데이터 이관/중앙 로그/UAT는 코드 외 조건으로 분리한다.

## 현재 저장소 해석

2026-07-02 기준 확인된 프로젝트 root:

```text
/Users/sieon/Desktop/project/safeLink_v3
```

현재 환경의 `safe-link-v2/` child directory는 authoritative project root가 아니다. 매 세션 시작 시 root 위치를 다시 확인한다.

이 V3 프로젝트는 타 회사가 빠르게 만든 제품을 상용화하기 위한 외주 개발 프로젝트다. 실제 레거시 프로젝트는 별도 경로에 있다. 이 워크스페이스에는 V2-era 이름, PoC 문서, Supabase migration, Cloudflare/OpenNext 설정이 남아 있지만, 이것들은 V3 운영 아키텍처가 아니라 migration risk/reference signal이다.

관찰된 legacy stack:

- Next.js 15 App Router와 React 19.
- Supabase Auth, Supabase REST, Supabase RLS, Service Role 사용.
- Cloudflare/OpenNext deployment script.
- Local fallback이 있는 Upstash Redis rate-limit helper.
- `src/app/api/*` 아래 다수 route handler.
- PoC와 security patch 작업으로 누적된 Supabase migration.
- 기존 TBM, worker, admin, chat, live translation, QR/NFC, quiz, ESG, system route.

이는 feature scope와 UX를 파악하는 근거로는 유용하지만, V3 backend 목표 구조는 아니다.

## V3에 영향을 주는 레거시 관찰

### Role Drift

Legacy role에는 `HQ_ADMIN`, `SAFETY_OFFICER`, `TEAM_LEADER`, `SITE_ADMIN`, `WORKER`, `ROOT`, `HQ_OFFICER`, `SUPER_ADMIN`이 섞여 있다. 일부 setup role string과 저장된 profile role string도 다르다. 빠르게 발전한 PoC에서는 자연스러운 상태지만, V3에는 더 작은 중앙 Role Contract가 필요하다.

V3 결정: 초기 role set은 `ROOT`, `HQ_ADMIN`, `SITE_ADMIN`, `SAFETY_MANAGER`, `WORKER`, `VIEWER`로 고정한다.

### 관리자 Self-Selection 리스크

Legacy setup/profile route는 setup role input을 받아 저장 role로 mapping하고, privileged role에 대한 추가 check도 있었다. Admin signup route도 company domain과 rate limit으로 보호되어 있었다. 완전히 열린 admin signup보다는 낫지만, V3에서는 public role self-selection으로 `ROOT`, `HQ_ADMIN`, 현장 권한을 얻을 수 없어야 한다.

V3 결정: 기존 관리자 직접 가입 기능은 제거하지 않는다. 직접 가입은 서버가 `PENDING` 계정만 만들고, `role`, `site_id`, `account_status` 같은 클라이언트 입력은 거부한다. `ROOT`, `HQ_ADMIN`, 현장 범위 확장, role 변경은 권한 있는 actor 또는 통제된 운영 절차로만 처리한다.

현재 구현 메모: `/api/auth/admin-signup`은 Next.js proxy를 통해 Spring Boot `/api/v1/auth/admin-signup`으로 연결된다. `/api/auth/setup-profile`은 role/site self-assignment 차단용 compatibility surface이고, `/api/auth/check-role`은 Spring Boot `/api/v1/auth/me`로 대체된다. Worker creation은 Spring Boot site worker API가 담당한다.

### Client-Readable Session 리스크

Legacy auth utility는 Supabase cookie를 parsing하고 route handler는 Supabase access token을 검증한다. 일부 compatibility code는 browser/mobile compatibility를 위해 `httpOnly: false` cookie를 설정한다. V3에서는 이 패턴을 거부한다.

V3 결정: Spring Security가 session을 소유한다. Session cookie는 HttpOnly이며 server-controlled다.

### Service Role / 분산 권한 판단 리스크

Legacy route handler는 Supabase Service Role 또는 direct Supabase REST call을 사용하고, RLS, route handler, frontend guard가 모두 authorization에 관여한다. 보안 판단이 너무 많은 곳에 분산된다.

V3 결정: Spring Boot를 authorization decision point로 둔다. PostgreSQL constraint는 integrity를 보조하지만, API authorization을 frontend나 Supabase RLS contract에 위임하지 않는다.

### `site_id` Migration 이력

Legacy migration은 `site_id`가 느슨하게 시작되었다가 나중에 UUID/FK 사용 쪽으로 강화된 흔적을 보여준다. 이는 site isolation이 핵심이며 V3 초반부터 설계해야 한다는 근거다.

V3 결정: 명시적 global reference data를 제외한 모든 business row는 `site_id`를 가진다. `site_id`가 없으면 기본적으로 거부한다.

### File Storage 리스크

Legacy `tbm_ack`는 acknowledgement flow에서 `signature_data`를 text로 저장한다. PoC signature pad에는 가능할 수 있으나, V3에서는 binary/file payload를 Object Storage에 저장하고 PostgreSQL에는 metadata만 둔다.

V3 결정: signature, audio, attachment는 `file_objects`를 통해 참조되는 object storage file로 관리한다.

### AI 비용 / Vendor 리스크

Legacy translation route의 Papago, Google, local engine fallback logic, glossary integration, language UX는 가치가 있다. V3에서는 이를 비용, quota, cache, circuit breaker를 갖춘 formal AI gateway로 이전한다.

V3 결정: 모든 AI call은 Spring Boot gateway를 통하고 `ai_usage_logs`에 기록한다.

## 권장 V3 아키텍처

```text
Browser
  -> Next.js App Router UI
  -> Spring Boot REST/SSE/WebSocket API
  -> PostgreSQL, Redis, Object Storage
  -> AI Vendors through internal AI Gateway
```

### Next.js 책임

- UI rendering과 client interaction.
- 필요한 SSR.
- Local UI state와 progressive enhancement.
- 보안 판단을 소유하지 않는 범위의 optional BFF-style composition.

### Spring Boot 책임

- Authentication과 session lifecycle.
- Authorization과 site guard.
- Role과 membership management.
- Transaction과 domain service.
- Audit logging.
- Object storage authorization과 presigned URL issuance.
- AI gateway와 quota enforcement.
- SSE/WebSocket runtime endpoint.
- Actuator health와 metrics.

### PostgreSQL 책임

- Durable business data.
- Referential integrity.
- Role contract constraint 또는 enum.
- Site membership과 resource ownership relation.
- Append-only audit/usage log.

### Redis 책임

- Server session store.
- Session invalidation list.
- Rate limit counter.
- Quota counter.
- Translation/TBM cache.
- 필요 시 realtime fan-out support.

## V2에서 가져올 것

- TBM create, normalize, translate, deliver, acknowledge, sign flow.
- Worker-first TBM review screen과 큰 action UX.
- Admin TBM status dashboard.
- 1:1 translated chat concept.
- Construction glossary와 Korean normalization concept.
- Language selection과 pronunciation support idea.
- PoC checklist discipline.
- Health-check visibility idea.
- 법적 증거성을 보조하는 hash/audit chain concept.

## V2에서 버릴 것

- V3 primary identity/session authority로 Supabase Auth 사용.
- Core tenant-isolation authority로 Supabase RLS 사용.
- Application request path에서 broad Service Role 사용.
- Backend foundation으로 Cloudflare Workers runtime workaround 사용.
- Client-readable auth cookie 또는 client-readable long-lived token.
- Signup 중 직접 role self-selection.
- Request body `site_id`에 의존하는 business endpoint.
- Signature/audio file을 DB text column에 저장.
- Frontend 또는 route handler가 gateway quota 없이 paid AI vendor를 직접 호출.

## Role Contract 분석

권장 초기 role:

| Role | 목적 | Site Scope |
| --- | --- | --- |
| `ROOT` | Platform bootstrap, break-glass, global operation | all sites |
| `HQ_ADMIN` | Headquarters operational admin | all or assigned organization sites |
| `SITE_ADMIN` | Site admin, membership and local operation | assigned sites |
| `SAFETY_MANAGER` | TBM and safety workflow owner | assigned sites |
| `WORKER` | TBM과 chat을 받는 worker | assigned sites |
| `VIEWER` | Read-only audit/stakeholder access | assigned sites or HQ scope |

구체적인 V3 workflow가 생기기 전까지 `SUPER_ADMIN`, `HQ_OFFICER`, `TEAM_LEADER`, `SAFETY_OFFICER`를 추가하지 않는다. Team leader behavior가 필요하면 먼저 membership attribute 또는 permission set으로 모델링하고, global role string을 늘리는 것은 나중에 판단한다.

## Authorization Model

세 계층을 사용한다.

1. Session identity: 인증된 user id와 session state.
2. Role authority: server-side에서 load한 global role grant와 site membership.
3. Resource guard: target resource `site_id`가 요청 action의 allowed site와 일치해야 한다.

`ROOT`와 일부 HQ role은 site boundary를 넘을 수 있지만, 해당 action도 audit 가능하고 운영자가 확인할 수 있어야 한다.

## Database 설계 메모

외부 identifier가 UUID를 요구하지 않는 한 내부 relational id에는 `BIGINT GENERATED BY DEFAULT AS IDENTITY`를 사용한다. PostgreSQL B-tree index는 equality filter인 `site_id`를 먼저 두고, 그 다음 `created_at`, `published_at` 같은 range/order field를 둔다.

중요 index:

- TBM list: `(site_id, published_at DESC)`
- Acknowledgement status: `(site_id, tbm_notice_id)`
- Audit review: `(site_id, occurred_at DESC)`
- AI cost review: `(site_id, occurred_at DESC)`
- Active membership과 non-revoked grant에 대한 partial index는 query pattern이 고정된 뒤 추가한다.

## Realtime 결정

SSE 우선 사용:

- TBM status dashboard update
- notification stream
- admin monitoring
- health/status panel

WebSocket 사용:

- bidirectional chat
- realtime translation stream
- 향후 voice-room style interaction

다중 instance 부하가 필요해지기 전에는 message broker부터 시작하지 않는다. 나중에 Redis Pub/Sub 또는 broker를 추가할 수 있도록 event abstraction을 깨끗하게 둔다.

## Testing 전략

첫 backend milestone에는 아래 test를 포함한다.

- Role/site authorization decision에 대한 JUnit domain test.
- Auth-required API에 대한 Spring MVC 또는 WebTestClient test.
- Flyway migration과 repository behavior에 대한 Testcontainers PostgreSQL test.
- 가능하면 rate-limit/quota semantic에 대한 Redis integration test.
- Next.js-to-Spring contract에 대한 API contract test.
- 첫 V3 frontend route가 생긴 뒤 Playwright smoke test.

## 운영 모니터링

최소 metric:

- API route별 request count, latency, error rate
- Login success/failure count
- Role/action별 authorization denial count
- Vendor/model/feature/site별 AI call
- Site/month별 estimated AI cost
- Redis rate-limit denial
- Object storage upload/download URL issuance count
- SSE/WebSocket connection count와 disconnect reason

최소 log:

- Structured JSON log
- Request id와 session id hash
- 인증된 경우 actor id
- Scope가 있는 경우 site id
- 민감 operation의 action과 decision

## 첫 구현 권장사항

현재 Next.js route handler를 계속 확장하기보다 깨끗한 Spring Boot module 또는 app boundary에서 시작한다. 최소로 유용한 backend foundation은 다음과 같다.

1. Spring Boot project scaffold.
2. PostgreSQL/Flyway connection.
3. User, role, site, membership, audit schema.
4. Spring Security cookie session skeleton.
5. CSRF policy.
6. Role/site guard service.
7. Redis-backed session and rate limit configuration.

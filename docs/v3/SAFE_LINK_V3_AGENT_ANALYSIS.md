# SQ Link V3 기술 분석

상태: 초기 기술 분석 및 2026-07-10 구현 결과 반영  
범위: 엔지니어링 판단, 리스크, 레거시 keep/reject 목록, 권장 아키텍처  
최종 수정일: 2026-07-10

## 구현 진행 상태

2026-10-21 동시 TBM: 이전 ‘현장당 활성 방송 1개’ 제한을 명시적 사용자 승인으로 변경했다. V045에서 기존 unique index를 제거하고 advisory-lock + DB trigger로 공통/공종 겹침을 차단한다. 새 방송 시작 시 기존 방송 강제 종료를 제거했으며, 현장 접근 권한 및 소유자 제어는 유지/강화한다. 근로자 UI는 site 내 방송 목록에서 exact session ID를 선택하고 폴링/SSE/참여/요약을 해당 ID에 고정한다. 자세한 검증과 운영 롤백 제한은 `CONCURRENT_TBM_CHANNELS.md` 참조.

2026-10-14 생년월일 6자리 후속 변경:

- 로그인 UI 후속 정정: 단일 영숫자 입력칸에서 기존 ID/신규 YYMMDD를 자동 구분하고 모드 선택 체크박스를 제거했다. `scripts/test-worker-login-input.mjs`로 소문자 legacy→LEGACY 정규화/실제 로그인 및 6자리 생년월일 로그인 각각의 API 요청, 200 응답, 세션, 근로자 화면 이동을 검증했다. 반복 전체 가입 테스트는 테스트용 IP 가입 제한(429)에 도달하여, 이번 로그인 UI 검증은 기존 로컬 fixture를 재사용했다. 제한을 해제하거나 운영 설정을 바꾸지 않았다.

- 간편가입 이름 입력 제거 완료: 서버가 phone_last4를 nickname으로 결정하고, 전환 입력의 name/phone은 신규 계정에서 무시하며 DB 값을 사용한다. TEMP→WORKER 역할/현장/홍채/동의/감사 이력 변경은 단일 트랜잭션이다. 같은 사용자 ID와 자격증명을 유지한다.
- 현장명: WorkerSiteLocalizationService가 활성 현장의 서버 원문만 AI Gateway로 번역한다. CSRF 보호된 인증 POST이며 기존 quota/vendor timeout/사용량 로그를 재사용한다. 번역은 site ID marker로 매칭하고 누락·중복·알 수 없는 ID 결과는 저장하지 않는다. site_name_localizations의 source_name 비교로 이름 변경 시 cache를 무효화한다. 실패 시 원문/상태를 반환한다. 등록 현장 권한 자체는 번역 결과가 아닌 submit의 site ID로 검증한다.
- 로컬에는 외부 AI 키를 복사하지 않는다. 번역 연결은 모의 공급자 DB 테스트(19개 외국어+한국어), EN/VI 캐시 UI, 실패 fallback으로 검증하며 실제 운영 공급자의 현장명 번역 품질은 별도 확인 대상이다.
- 최종 검증: 전체 Gradle 테스트 160개 중 158개 성공, 외부 DeepL 실제 호출 2개는 키 없이 실행하여 제외. TypeScript/변경 UI ESLint 성공. Chrome 실제 신규 가입→로그아웃→생년월일 로그인→EN/VI 현장 표시→즉시 전환→동일 사용자 ID/로그인→기존 LEGACY 로그인 성공. 20언어 가입 화면과 TEMP TBM 접근 차단도 검증. 로컬 V040 적용 및 프론트3000/백엔드18084 실행 완료. 운영 미배포.

- 미배포 V040의 `birth_date`는 DATE 대신 nullable VARCHAR(6)이다. YYMMDD는 세기를 알 수 없으므로 실제 출생연도/나이를 추정하지 않고 선행 0을 보존한다. 2000+YY는 달력 유효성 검사에만 사용하며 저장하지 않는다. `000229`는 2000년생일 수 있으므로 허용한다.
- 프론트와 Spring은 정확히 ASCII 숫자 6자리와 실제 월/일 조합을 검증한다. DB도 형식/달력 검증 및 enabled 계정의 `(birth_date, phone_last4)` 중복 차단을 수행한다. 기존 계정의 NULL은 유지한다.
- 6자리 ID와 전화번호 뒤 4자리는 강한 본인 인증이 아니며 동명이 아닌 서로 다른 사용자의 식별자 충돌도 가능하다. 충돌을 임의 계정 선택으로 해결하지 않는다. 운영 도입 전 인증 제한 및 전체 가입/전환 경로 검증이 별도로 필요하다.
- 검증 대상: WorkerBirthDateTest, WorkerUpgradeDatabaseTest, 기존 auth 회귀 테스트, TypeScript 검사 및 20개 언어 안내/JS 달력 검증. 기존 V2 및 운영 DB는 변경하지 않았다.

2026-10-06 전국 TBM:

- HQ_ADMIN/ROOT의 명시적 전국 전파를 별도 API로 구현했다. 기존 SiteGuard를 느슨하게 하거나 가짜 site ID를 사용하지 않으며 V037 그룹-현장 매핑으로 기존 현장별 TBM/서명/라이브 참여 기록을 재사용한다.
- 전국 전파 대상은 시작 시 활성 현장 스냅샷이다. 모든 현장 대상(빈 현장 포함), 기존 활성 방송과 충돌하면 시작을 거절한다. 트랜잭션 커밋 후 SSE를 발행해 롤백된 알림 노출을 방지한다.
- 전국 STT/초안 요약만 명시적 nationwide + global role 검증 후 null site를 허용하며 사용자 quota/audit를 유지한다. 근로자의 번역·TTS는 본인의 기존 site 권한을 사용한다.
- 현장 미소속 본사 발신자 질문 연결은 실제 전국 TBM 대상 현장 관계로만 허용한다. 무관한 본사 관리자 전체를 노출하지 않는다. 운영 부하 및 실제 음성 공급자 테스트는 별도 필요하다.
- 구현·로컬 검증·운영 반영 조건은 `NATIONWIDE_TBM.md` 참조.

2026-10-06 TBM 위험성 평가 참조 목록:

- 첨부 451개 항목은 Spring 버전 관리 리소스로 제공하며 기존 예시 5개와 출처를 구분한다. 관리자 역할만 읽을 수 있는 공유 참조자료로, 현장별 완료 평가/실적과 혼동하지 않는다. DB의 기존 목록·TBM 기록을 변경하지 않음.
- 원본 중점 표시는 숫자 등급에서 재계산하지 않고 `●`만 사용한다. 자동 음성 트리거와 현장별 평가 승인 기능은 이번 작업 범위 아님. `TBM_RISK_ASSESSMENT_LIBRARY.md`에 원본 대조와 테스트 근거 기록.

2026-10-06 영문 이름 정책:

- 후속 요청으로 공통 이름 입력칸에서 비영문 입력·붙여넣기·IME 확정값을 필터링하고 영문 제안 UI/호출을 제거했다. 기존 Spring `/api/v1/auth/romanize-name` helper는 남아 있으나 가입 화면에서 호출하지 않는다. 해당 helper의 CSRF, BFF same-origin 검사, Redis 60회/분 제한, 입력 80자 제한, no-store 보호는 유지한다.
- 사용자가 확인한 영문 이름만 저장하고 Spring `EnglishName`이 API 우회 요청도 검증한다. 기존 비영문 표시명을 동반하는 언어/현장 변경은 허용해 기존 로그인을 깨뜨리지 않는다. 실제 이름을 바꿀 때부터 영문을 요구한다.
- 이름은 사용자가 영문으로 직접 작성·확인한다. 기존 계정/과거 서명 자료를 자동 치환하지 않는다.

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

### 2026-10-19 Free Talk 통합 경계

- 고객 제공 `SQ-LINK_FREE_TALK_20261014 3`의 `/travel`은 V3에 이미 이식된 같은 계열 UI였다. 한 폰 대화·QR 두 폰 대화·동시 통역·음성 성별·학습 표시 흐름을 재사용하고 `/free-talk`와 랜딩 버튼으로 연결한다. 제공 폴더/V2 원본은 수정하지 않는다.
- 기존 travel HMAC 토큰과 Supabase 공유 채널을 새 공개 기능의 인증으로 사용하지 않는다. Spring의 `FreeTalkAccess`가 Redis에 2시간 한정 capability를 발급하고 BFF가 HttpOnly/Secure(production)/SameSite=Strict 쿠키로 보관한다. 브라우저에 handle을 JSON으로 노출하지 않는다.
- BFF는 Origin을 확인하며 전용 cookie만 내부 헤더로 전달한다. 기존 SQ-LINK 계정 cookie·권한·현장 정보를 전달하지 않는다. 내부 secret은 전송 경계 확인용이며, 유효한 guest capability와 서버 방 참여 검사를 추가로 통과해야 한다. 따라서 공개 통역이 기존 TBM·근로자·현장 API 권한을 부여하지 않는다.
- 서버 생성 8자리 방 코드, 호스트 1명/상대 1명, 원자적 Redis join, 만료, 타 방 signal/SSE 차단. SSE는 120초마다 재연결 시 capability를 재검사하고 guest당 기존 연결을 교체한다. 현재 실시간 event bus는 단일 백엔드 프로세스용이다. 다중 인스턴스 운영 전 Redis Pub/Sub 등으로 전달 계층을 확장해야 한다.
- 무료 공개 호출의 비용 방어: guest 생성 IP당 10회/시간, API guest당 600회/분, 유료 호출 guest당 240회/분·3,600회/시간, IP당 7,200회/시간, 서비스 전체 기본 10,000회/24시간. 한 발화가 STT·번역·TTS 여러 호출을 사용함을 고려한다. Redis 오류는 fail-closed. `safe-link.free-talk.daily-call-limit`로 전체 상한 조정 가능. 역번역도 호출 한도를 소비한다. IP는 신뢰하는 역방향 프록시가 덮어쓰는 헤더를 기준으로 하며 전체 상한은 IP와 별개로 적용한다.
- `AiVendorService`/`AiMediaService`의 기존 운영 제공자 설정을 그대로 사용한다. 제공 앱을 Papago로 부르더라도 신규 코드가 Papago를 강제하지 않는다. 유료 요청은 `ai_usage_logs`에 크기·제공자·추정 비용만 기록한다. guest 대화/음성 원본은 DB에 저장하지 않으며 TTS도 POST로 전송해 문장을 URL에 싣지 않는다.
- 번역 직전 활성 DB 용어집 + 기존 `korean-glossary` 경계 규칙 적용. 한국어 STT 원문, 용어 변환문, 최종 번역문을 분리하며 외국어→한국어 경로에도 기존 용어 전처리 적용. 일반 문장 조각 치환, 임의 설명 추가, 불명확한 복수 표준어 추측은 하지 않는다. 용어집 조회 실패 시 성공으로 위장하지 않는다.
- 검증: `npm run build`, TypeScript/대상 ESLint, 백엔드 전체 176건 중 174 통과·2 제외, `tests/free-talk.cjs`, `tests/free-talk-audio.cjs`, 기존 한국어 용어집 API 회귀 검사 통과. `tests/free-talk-browser.mjs`는 production build와 로컬 Spring/Redis를 연결해 랜딩 버튼·QR 입장·독립 브라우저 간 SSE 전달·제3자 접근 차단·방 정원·기존 STT 인증 보존·5개 UI 언어·390px 모바일 화면을 검증했다. AI 제공자 응답은 모의 처리했으며 실기기 마이크 인식률·외국어 번역 품질·Safari 자동재생은 별도 실제 기기 시험 대상으로 남긴다. 운영 DB 변경 및 운영 배포는 이 작업에서 하지 않았다.

현재 Next.js route handler를 계속 확장하기보다 깨끗한 Spring Boot module 또는 app boundary에서 시작한다. 최소로 유용한 backend foundation은 다음과 같다.

1. Spring Boot project scaffold.
2. PostgreSQL/Flyway connection.
3. User, role, site, membership, audit schema.
4. Spring Security cookie session skeleton.
5. CSRF policy.
6. Role/site guard service.
7. Redis-backed session and rate limit configuration.

## 2026-10-14 간편가입 변경 배포 점검

- 배포 범위: 신규 YYMMDD 로그인/재로그인, 기존 영문 로그인 보존, 현장·홍채 ID 입력 후 신규 계정 즉시 전환, 현장명 언어별 표시, 근로자 TBM 전파 버튼 디자인. 공종별 동시 TBM 및 보류 중인 직원 역할 V038/V039는 제외한다.
- 운영 변경 전 V037까지 적용된 DB와 V040의 기존 제약 조건을 확인했다. 임시 가입 기준 계정의 활성 현장 연결은 1개다. 기존 로그인 정보는 41건이며 V040에서 생년월일을 일괄 채우거나 기존 계정을 변환하지 않는다.
- 운영 서버 내부에 `pre-worker-login-20261014-0710.dump` 백업을 생성하고 pg_restore 목록 검사를 통과했다. 실패 시 이전 앱 릴리스로 복귀할 수 있으며 V040은 기존 앱이 무시하는 nullable 열/별도 테이블을 추가한다. 운영 데이터를 덮어쓰는 전체 DB 복원은 별도 판단 없이 수행하지 않는다.
- 배포 직전 Gradle test/bootJar, 기존 CI 프론트 회귀 검사, 실제 로컬 브라우저 영어·생년월일 로그인 검증을 통과했다. 운영 빌드 및 배포 성공은 GitHub Actions와 운영 readiness/화면 확인으로 별도 검증한다.
- TBM 버튼은 전역 테마의 text-white 덮어쓰기 영향을 피하도록 전용 CSS 모듈을 사용한다. 320/390/1280px과 작성 페이지 이동을 확인했으며 임시 근로자의 전파 제한은 유지한다.
# 2026-10-23 근로자 현장 이동 예외

- 사용자 승인으로 WORKER-only 계정의 전체 활성 현장 목록 조회 및 자기 소속 이동을 허용한다. 목록 조회와 실제 데이터 접근은 분리하고, 저장 시 사용자 잠금 후 역할·계정 상태·선택 현장을 재검증한다.
- 이전 소속/서명 원본을 삭제하지 않는다. 이전 활성 WORKER 소속은 REVOKED로 남기고 새 현장만 활성화한다. 기존 NFC 이동 정책처럼 이전 현장 스티커를 비활성화한다. 요청별 계정 갱신 필터가 다른 세션의 오래된 현장 권한을 갱신한다.
- 임시/관리자/복합 역할의 자기 소속 확대는 허용하지 않는다. 별도 DB migration 또는 계정 일괄 변경은 없다.

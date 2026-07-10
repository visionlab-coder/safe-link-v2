# SQ Link V3 구현 상태

최종 수정일: 2026-07-10

## 이번 마일스톤에 적용된 내용

- `backend/` Spring Boot 기반 모듈을 추가했다.
- identity, role contract, site membership, admin invitation, TBM, file object, chat, audit log, AI usage/quota용 PostgreSQL/Flyway schema를 추가했다.
- Redis 기반 Spring Session과 Redis 기반 AI quota counter를 추가했다.
- 서버가 소유하는 `SAFE_LINK_SESSION` HttpOnly cookie 정책을 추가했다.
- CSRF token endpoint와 상태 변경 API의 CSRF 보호를 추가했다.
- backend/frontend helper에 V3 Role Contract를 추가했다: `ROOT`, `HQ_ADMIN`, `SITE_ADMIN`, `SAFETY_MANAGER`, `WORKER`, `VIEWER`.
- 누락된 `site_id`와 cross-site 접근을 거부하는 site guard service를 추가했다.
- 공개 signup에서 관리자 role/site 권한을 직접 선택하지 못하도록 차단했다. 기존 관리자 직접 가입 기능은 Spring Boot `/api/v1/auth/admin-signup`과 Next.js `/api/auth/admin-signup` proxy로 유지하되, 즉시 로그인/권한 부여 없이 `PENDING` 계정만 만들고 권한 있는 관리자의 승인 API에서 role/site를 부여한다.
- 서명/음성/첨부용 object-storage metadata와 presigned URL API를 추가했다.
- Redis quota, usage log, fail-closed vendor 정책을 가진 AI gateway endpoint를 추가했다.
- Chat REST endpoint와 SSE event stream 기반을 추가했다.
- Actuator health group과 storage/AI health indicator를 추가했다.
- 향후 frontend migration을 위한 Next.js V3 API/auth helper module을 추가했다.
- `/auth` 관리자 로그인 경로가 `loginV3()`를 호출하고 Spring Boot `SAFE_LINK_SESSION` 흐름을 만들도록 연결했다.
- Next.js middleware와 `RoleGuard`가 Spring Boot `/api/v1/auth/me`를 우선 사용하도록 변경했다.
- 공개 관리자 signup을 Spring Boot 세션 기반으로 복구하고, `/api/auth/setup-profile`을 통한 관리자 role/site self-assignment를 차단했다.
- 인증 판단과 `site_id` access guard behavior에 대한 backend unit test를 추가했다.
- `worker_quick_login_credentials` 기반 Spring Boot worker quick login API `/api/v1/auth/worker-quick-login`을 추가했다.
- 권한 있는 관리자가 Supabase `nfc_workers` 없이 V3 `WORKER` identity, site membership, quick-login credential을 만들 수 있도록 `/api/v1/sites/{siteId}/workers`를 추가했다.
- Next.js `/api/auth/worker-quick-login`을 Spring proxy로 교체하고 legacy manual `/api/auth/worker-login` Supabase session issuer를 비활성화했다.
- middleware와 `/api/auth/me`에서 Supabase readable-cookie auth fallback을 제거했다. 이제 해당 경로는 Spring Boot `/api/v1/auth/me`만 신뢰한다.
- Next.js server-only helper가 Spring Boot `SAFE_LINK_SESSION`을 확인할 수 있도록 `getV3SessionUser()`를 추가했다.
- 초기 AI route에 Spring Boot `/api/v1/ai/reserve`를 연결한 뒤, 최종적으로 번역·STT·TTS·romanize·vision·quiz 공급자 호출 자체를 Spring Boot AI Gateway 내부로 이전했다. Redis quota와 `ai_usage_logs`는 Spring에서 일관되게 처리한다.
- AI Gateway status endpoint와 Actuator `ai` health detail에 vendor/fallback/quota window 정보를 추가했다. 외부 vendor key 값은 노출하지 않는다.
- Object Storage health는 로컬 storage disabled 상태를 장애로 오해하지 않도록 `UP + LOCAL_FALLBACK` detail로 분리했다.
- middleware의 `/api/quiz` guard 범위를 exact route로 좁혀, 기존 quiz 하위 route의 legacy 동작을 불필요하게 막지 않도록 했다.
- `AGENTS.md`에 V2 read-only 기준 경로와 V3 디자인/기능 보존 규칙을 명시했다.
- 로컬 V3 DB의 `임시 테스트현장`에 quick-login 검증용 `WORKER` 계정을 만들고, Next proxy + Spring session 기반 근로자 로그인을 검증했다.
- 기존 채팅 화면 URL과 응답 형식은 유지하면서 `/api/admin/chat/workers`, `/api/worker/chat/admins`, `/api/chat/messages`를 Spring Boot chat compatibility API로 연결했다. 메시지 조회, 전송, 읽음 처리는 V3 `chat_threads`, `chat_messages`, `chat_message_reads`와 `site_id` guard를 사용한다.
- Next.js V3 proxy helper가 Spring CSRF token endpoint를 거쳐 unsafe method를 호출하도록 추가했다.
- TBM 생성/조회/서명 핵심 API를 Spring Boot compatibility API로 이전했다. 기존 `/api/tbm/broadcast`, `/api/tbm/today`, `/api/tbm/sign`, `/api/tbm/ack` URL과 JSON field는 유지하고, 저장은 V3 `tbm_notices`, `tbm_acknowledgements`, `file_objects`를 사용한다.
- TBM 서명 이미지는 DB text/base64 저장 대신 Object Storage service에 저장하고 `sha256`, mime type, byte size, object key, owner, status metadata를 `file_objects`에 남기도록 바꿨다. 로컬 개발에서는 storage disabled 상태를 유지하면서 파일 기반 fallback으로 smoke test가 가능하다.
- 관리자 TBM 생성/현황 화면과 근로자 TBM 상세 화면의 핵심 데이터 조회를 Spring Boot 세션 기반 Next API route로 연결했다. 화면 디자인과 버튼/서명 흐름은 유지했다.
- Chat direct thread API의 조회, 전송, read receipt, SSE 구독에 `site_id` guard뿐 아니라 thread participant/global role 검증을 추가했다.
- `/api/auth/me`가 V3 `preferredLanguage`를 내려 기존 TBM 언어 흐름의 `preferred_lang` mapping을 유지하도록 보강했다.
- QR 현장 입장 경로를 Spring Boot `/api/v1/qr/site-entry`로 이전했다. QR 스캔 시 V3 `users`, `user_roles`, `site_memberships`, `worker_quick_login_credentials`를 기준으로 근로자를 조회/자동 등록하고, `worker_daily_access`에 당일 입퇴장 상태를 기록한다.
- Next.js `/api/qr/site-entry`는 Spring Boot proxy로 단순화했고, 이 경로의 Supabase Service Role 사용과 browser-readable Supabase session cookie 발급을 제거했다. 세션은 Spring Boot `SAFE_LINK_SESSION`으로만 발급한다.
- QR 입장 API는 CSRF 예외 공개 endpoint로 등록하되, 서버에서 site id를 검증하고 audit log를 남기며, Next.js proxy의 Redis rate limit을 유지한다.
- 관리자 QR 생성 화면의 현장 목록 조회를 Spring Boot `/api/sites/options`로 바꿔 새 QR URL이 V3 numeric `site_id`를 사용하도록 했다.
- 관리자 직접 가입은 승인 대기제로 바꿨다. 가입자는 `PENDING` 상태로만 생성되고 세션이 발급되지 않으며, `/api/v1/admin/accounts/{userId}/approve`에서 상위 권한자가 `SITE_ADMIN`, `SAFETY_MANAGER`, `HQ_ADMIN`, `VIEWER` 중 허용 role과 필요한 `target_site_id`를 검증한 뒤 감사 로그와 함께 승인한다.
- 최초 시스템 관리자용 secret 기반 ROOT bootstrap runner를 추가했다. `SAFE_LINK_ROOT_BOOTSTRAP_ENABLED=true`와 일회성 token/confirm token, email/password가 모두 맞을 때만 활성 `ROOT`가 없다는 조건에서 생성하고, 공개 가입/승인/초대 API에서는 `ROOT` 생성을 계속 차단한다.
- `/system` 관리자 화면에 승인 대기 관리자 목록과 승인 처리를 연결했다. 가입자는 계속 `PENDING` 상태로만 생성되며, 상위 권한자가 role/site를 선택해 승인해야 한다.
- 근로자 NFC/QR compatibility API를 Spring Boot 중심으로 이전했다. `/api/nfc/workers`, `/api/nfc/sticker/*`, `/api/qr/verify`, `/api/nfc/worker-info`, `/api/nfc/worker-preference`, `/api/nfc/site-access-control`, `/api/nfc/site-challenge`, `/api/sites/current-location`은 Next route에서 Spring API proxy로 동작한다.
- V3 PostgreSQL에 worker NFC compatibility schema(`worker_profiles`, `worker_stickers`, `worker_card_lifecycle_events`, `site_access_controls`, `site_daily_challenges`, `worker_qr_token_nonces`)를 추가했다.
- 근로자 QR/NFC 입장은 Supabase browser-readable session을 만들지 않고 Spring Security session을 발급한다. QR nonce 재사용 방지, NFC sticker HMAC 검증, site access control, daily access 상태가 Spring Boot에서 처리된다.
- NFC TBM live session 운영 API를 Spring Boot 중심으로 이전했다. `tbm_sessions`, `tbm_attendance`, `tbm_notification_log` Flyway schema와 목록/생성/상세/종료/NFC tap/알림 로그 API를 추가했고, 기존 Next route는 Spring proxy로 단순화했다.
- 관리자/근로자 채팅 화면에서 직접 DB 접근을 제거했다. 메시지 목록/전송/읽음/번역 보정은 `/api/chat/messages` Spring compatibility API로 처리하고, 활성 대화와 사용자 단위 읽지 않음 알림은 Spring SSE로 갱신한다.
- 4일차 검증으로 Spring Boot test/bootJar, Next.js production build, Actuator liveness/readiness/ai/storage health, AI usage logging, 관리자/근로자 핵심 화면 smoke test를 통과했다.
- 1차 완료 범위와 잔여 리스크를 `docs/v3/SAFE_LINK_V3_PHASE1_COMPLETION_REPORT.md`에 정리했다.
- 2026-07-09 추가 검증으로 Spring Boot `./gradlew test --no-daemon`과 Next.js `npm run build`를 통과했다.
- 2026-07-10 추가 안정화로 Supabase client/server 유틸, Service Role helper, readable Supabase JWT fallback, Supabase Realtime 직접 구독, Supabase package dependency, CSP의 Supabase connect 허용을 제거했다.
- `quiz`, `incentive`, `stop-work`, `live interpreter`, `system summary/log/site archive`, `hq-audit`, `site-briefing`, `swarm-status`, `testbed-health`, `daily-safety-logs`, `glossary`, `pledge`, `ESG report`, `sites/resolve` route를 Spring Boot API 또는 Spring proxy 구조로 이전했다.
- 퀴즈/인센티브/작업중지/라이브통역용 PostgreSQL Flyway schema를 추가했다.
- 작업중지 요청은 Spring Boot에서 site guard, rate limit, routing, audit log, hash-chain append를 처리한다.
- 라이브 통역은 Spring API에 저장하고 현장별·관리자별 Spring SSE 채널로 전달한다. 화면의 2.5초 polling은 제거했다.
- `/system` 운영 화면의 현장 집계, 보안 로그, 현장 생성/수정/삭제는 Spring Boot API로 이전했고, 삭제는 실제 delete 대신 `ARCHIVED` 처리한다.
- `/api/tbm/library`는 Supabase DB 의존을 제거하고 V3 세션 인증 후 기본 안전교육 라이브러리 fallback을 반환한다.
- `travel` 2폰 대화는 Spring SSE 기반 입장·메시지·발화 상태 채널로 이전했다. 기존 no-op 채널과 Pusher 서버/클라이언트 의존 패키지를 제거했다.
- Spring Boot AI vendor gateway `/api/v1/ai/vendor`를 추가했다. Papago, Google Translate, OpenAI prompt 호출은 Spring `AiQuotaService`, site guard, audit log, `ai_usage_logs` 뒤에서 실행된다.
- V3 세션 기준 `/api/translate`, `/api/romanize`, legacy `/api/quiz`, `/api/tbm/ai-tips`, `/api/tbm/briefing-draft`의 텍스트 기반 vendor 호출을 Spring AI vendor gateway로 이전했다. 기존 응답 JSON과 화면 흐름은 유지한다.
- 서원건설 확인 기준으로 테스트용 RTT vendor는 운영/테스트 런타임 코드에서 제거했다. 운영 실시간 통역 기본 경로는 Google STT + Papago + Google Translate fallback이다.
- 2026-07-10 검증으로 Spring Boot `./gradlew test bootJar --no-daemon`과 Next.js `npm run build`를 통과했다.
- Spring Boot 로컬 실행이 루트 `.env.local`을 optional properties로 읽도록 연결했다. 운영 환경변수는 Spring 설정 우선순위에 따라 로컬 파일보다 우선한다.
- 미구성 생성형 AI 경로를 제거하고 텍스트 생성은 `OPENAI_API_KEY`, 이미지 분석은 OpenAI 우선·Google Cloud Vision fallback으로 Spring 내부에서 처리한다. provider health는 Google/Papago/OpenAI 설정 여부를 key 값 없이 boolean으로 표시한다.
- 실시간 STT가 브라우저 오디오의 실제 `sampleRateHertz`를 전달하고, Google `latest_long`이 오류 없이 빈 결과를 반환해도 `default` 모델로 한 번 재시도하도록 보강했다.
- 24kHz OGG/Opus 실제 Google TTS→STT 재인식, Papago 베트남어 번역, Google Translate fallback, `ai_usage_logs` 기록을 검증했다.
- STT 은어 정규화에서 괄호 설명형 표준어를 제외해 `안전모` 같은 정상 발화가 번역 전에 설명문으로 변형되지 않도록 보정했다.
- `/api/stt`, `/api/tts`, `/api/vision` 실제 공급자 호출을 Spring Boot adapter로 이전했다. Next API URL과 응답 형식은 유지하며 Redis quota, site guard, audit log를 Spring에서 적용한다.
- `/api/travel/translate`, `/api/poc/ai-lab/*`의 직접 공급자 호출을 Spring 내부 gateway로 이전했다.
- 보고서 검증의 Supabase Service Role 직접 조회를 제거하고 V3 PostgreSQL/Flyway schema와 Spring 공개 검증 API로 이전했다.
- 운영 상태 필드의 `supabase`, `pusher` 레거시 명칭을 `postgresql`, `realtime`로 정리했다.

## 코드 외 남은 운영 조건

- Web domain과 API domain이 분리될 경우 production cookie-domain/CORS 정책 확정이 필요하다.
- 기존 worker data는 실제 quick-login E2E가 가능하도록 V3 `users`, `user_roles`, `site_memberships`, `worker_quick_login_credentials`로 import해야 한다.
- 현재 검증용 근로자 계정은 로컬 DB 테스트 데이터다. 운영/스테이징에서는 실제 worker import 또는 관리자 등록 API를 통해 생성해야 한다.
- OpenAI key는 설정되어 있으나 현재 계정이 `insufficient_quota`이므로 결제/사용 한도 활성화가 필요하다.
- Google Cloud Vision API는 현재 프로젝트에서 비활성 상태이므로 콘솔에서 API 활성화가 필요하다.
- 운영 Secret Manager, 중앙 로그 수집, 백업, 모니터링 알림, HTTPS/도메인 설정은 배포 환경에서 확정해야 한다.

## 다음 운영 구간

1. Local/staging E2E를 위해 운영 worker identity를 `worker_quick_login_credentials`로 import 또는 관리자 등록 API로 생성한다.
2. OpenAI 결제/쿼터와 Google Cloud Vision API를 활성화한 뒤 텍스트 생성·사진 위험 분석 운영 smoke test를 수행한다.
3. 운영 배포 전 cookie domain, HTTPS, CORS, Secret Manager, 중앙 로그 수집, EC2 systemd/Docker 실행 단위를 확정한다.

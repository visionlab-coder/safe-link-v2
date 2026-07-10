# SQ Link V3 개발 실행 지침

상태: 초기 실행 가이드

범위: 구현 순서, 금지 패턴, 시작 명령, 완료 기준

최종 수정일: 2026-07-10

## 구현 진행 상태

2026-07-06:

- V3 권한 경계를 만들기 위해 `backend/` Spring Boot 기반을 추가했다.
- Role Contract, Flyway schema, Redis session/quota 정책, object-storage metadata, audit log, AI gateway, chat REST/SSE, Actuator health group이 코드에 반영되기 시작했다.
- 기존 Next.js route는 URL/JSON compatibility surface로 유지하고, 인증·권한·DB·AI·실시간 처리는 Spring Boot API가 소유한다. Service Role과 client-readable auth cookie는 런타임 코드에서 제거했다.

## 기본 원칙

이 워크스페이스는 파일명에 V2가 남아 있어도 활성 SQ Link V3 개발 대상이다. 이 프로젝트는 타 회사가 빠르게 만든 제품을 상용화하기 위한 외주 개발 프로젝트다. 실제 레거시 프로젝트는 별도 경로에 있다.

이 워크스페이스 안의 V2 명칭, PoC 문서, Supabase migration, Next.js route, Cloudflare/OpenNext 설정은 사용자가 명시적으로 이전/삭제를 요청하지 않는 한 참고 자료로만 본다. 이를 authoritative legacy source로 간주하지 않는다.

V3에는 레거시 보안 구조를 복사하지 않는다. 기능 흐름과 UX 아이디어는 보존하되, 권한 모델은 새로 설계한다.

## 매 작업 시작 시 실행할 확인

구현 전에 아래를 확인하고, 보안/아키텍처에 영향을 주는 변경 전에는 `AGENTS.md`와 이 문서를 읽는다.

```bash
pwd
git rev-parse --show-toplevel
git status --short
rg --files -g 'AGENTS.md' -g 'README*' -g 'package.json' -g 'pom.xml' -g 'build.gradle*' -g 'settings.gradle*' -g 'src/**' -g 'docs/v3/**'
sed -n '1,220p' AGENTS.md
sed -n '1,220p' docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md
```

`git`이 없는 복사본이나 스냅샷이면 그 사실을 먼저 보고하고, 실제 프로젝트 root와 문서 위치를 다시 확인한다.

향후 Spring Boot app이 추가되었거나 backend 구조를 점검해야 하면 아래도 확인한다.

```bash
rg --files backend api server spring -g 'pom.xml' -g 'build.gradle*' -g 'src/main/**' -g 'src/test/**'
```

## 문서 분리 기준

V3 문서는 다음과 같이 분리한다.

- `docs/v3/SAFE_LINK_V3_CLIENT_INPUT.md`: 클라이언트 제공 요구사항과 제약.
- `docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md`: 실행 순서, 금지사항, 완료 기준.
- `docs/v3/SAFE_LINK_V3_AGENT_ANALYSIS.md`: 기술 판단, 리스크, 레거시 keep/reject 목록, 권장 아키텍처.

Role name, session policy, site isolation, storage policy, AI quota policy가 바뀌면 관련 문서를 같이 갱신한다.

## 구현 순서

1. 프로젝트 구조와 git root를 확인한다.
2. 보존된 V2 자료를 read-only reference로 분석한다.
3. 위 V3 문서를 최신 상태로 유지한다.
4. Role Contract를 고정한다.
5. Spring Security session/cookie behavior를 설계한다.
6. 기존 관리자 직접 가입 호환 흐름을 유지하되, role/site self-assignment 차단과 별도 관리자 초대/승인 흐름을 설계한다.
7. `site_id` 기반 data isolation을 설계한다.
8. PostgreSQL schema와 Flyway migration을 작성한다.
9. Redis session, rate-limit, quota, cache 정책을 설계한다.
10. Object storage file metadata와 authorization policy를 설계한다.
11. `audit_log`와 operational health check를 설계한다.
12. Spring Boot backend foundation을 만든다.
13. Next.js frontend foundation을 만들거나 V3 구조에 맞게 조정한다.
14. Product workflow보다 먼저 authentication, authorization, site guard, audit log, health check를 구현한다.
15. 그 다음 TBM create/deliver/acknowledge/sign을 이전한다.
16. 그 다음 chat과 translation gateway를 구현한다.
17. 이후 test, monitoring, deployment verification automation을 추가한다.

## 금지 패턴

V3에는 아래 패턴을 도입하지 않는다.

- Access token을 `localStorage`에 저장.
- Client-readable long-lived auth token.
- 사용자가 관리자 role을 직접 선택하는 구조.
- Frontend에서 AI vendor를 직접 호출.
- Route handler에 Service Role처럼 모든 권한을 가진 key를 둠.
- Frontend route guard만으로 권한을 판단.
- `site_id`가 없는 business table.
- Session-authorized site scope를 확인하지 않고 request body의 `site_id`를 신뢰.
- Signature, audio, attachment에 public URL 사용.
- Signature image, audio blob, file을 text column에 저장.
- Supabase Auth/RLS/Realtime을 V3 핵심 권한 기준으로 사용.
- Cloudflare Workers workaround code를 backend runtime foundation으로 사용.

## Role Contract 구현 규칙

중앙 enum 또는 value object에는 아래 role만 둔다.

```text
ROOT
HQ_ADMIN
SITE_ADMIN
SAFETY_MANAGER
WORKER
VIEWER
```

같은 role string을 아래 모든 곳에서 동일하게 사용한다.

- Spring enum 또는 value object
- API response schema
- DB check constraint 또는 enum type
- seed data
- UI guard와 label
- test
- 운영 문서

관리자 role은 public signup input으로 선택하게 하지 않는다. 기존 제품에 관리자 직접 가입 기능이 있으면 공개 가입은 `PENDING` 계정 생성까지만 허용하고, 실제 role/site 부여는 권한 있는 관리자의 승인 API 또는 invitation/controlled bootstrap 흐름에서만 처리한다.

`ROOT`, `HQ_ADMIN`, 현장 범위 확장, role 변경, site permission 변경은 아래 중 하나로만 처리한다.

- 권한 있는 관리자의 invitation
- pending account에 대한 approval
- 상위 권한자의 explicit assignment
- 최초 `ROOT`용 controlled bootstrap seed

모든 role assignment와 site permission 변경은 audit event를 남긴다.

## Session / Cookie 정책

Spring Security와 Redis-backed server session 또는 짧은 수명의 session handle을 사용한다.

최소 cookie 정책:

- `HttpOnly`
- non-local 환경에서는 `Secure`
- 기본 `SameSite=Lax`; 호환 가능하면 admin-only surface는 `Strict` 검토
- app path에 scope 제한
- 짧은 idle timeout
- absolute session lifetime
- logout, role change, site permission change, suspicious activity 시 server-side invalidation

Cookie 기반 인증이므로 상태 변경 요청에는 CSRF 방어를 구현한다. 필요에 따라 synchronizer token 또는 double-submit pattern을 사용하고, API 예외는 명시적으로 문서화한다.

운영에서는 access/refresh token을 브라우저에서 읽을 수 있는 쿠키로 발급하거나 인증 fallback으로 사용하지 않는다. QR 근로자 입장을 포함한 인증은 Spring Boot가 발급하는 `SAFE_LINK_SESSION`만 사용한다.

## 관리자 직접 가입 호환 흐름과 초대 / 승인 흐름

기존 제품의 관리자 직접 가입 기능은 제거하지 않는다. 단, 직접 가입 request는 `email`, `password`, 표시명, 언어 같은 identity 입력만 받을 수 있고 `role`, `site_id`, `account_status`, 권한 범위 입력은 거부한다. 서버는 공개 가입자를 `PENDING` 계정으로만 생성하고, 실제 role/site 부여는 권한 있는 관리자의 승인 또는 통제된 bootstrap 절차에서만 처리한다.

초대/승인 흐름은 기존 가입 기능을 대체하는 필수 조건이 아니라, 운영 중 권한 부여와 현장 범위 관리를 위한 추가 흐름이다.

초대/승인 최소 흐름:

1. `ROOT`, `HQ_ADMIN`, 또는 권한 있는 `SITE_ADMIN`이 invitation을 만든다.
2. Invitation에는 target role, target site scope, email 또는 phone, expiry, issuer가 포함된다.
3. 사용자가 invitation을 수락하고 identity/profile setup을 완료한다.
4. 서버가 invitation state를 검증하기 전까지 account는 `PENDING` 또는 제한 상태로 남는다.
5. Approval/activation 시 role과 site membership record를 만든다.
6. Invitation create, accept, approve, reject, expire, revoke는 audit log에 기록한다.

직접 self-registration은 클라이언트가 role/site를 선택하는 방식이어서는 안 된다.

## 최초 ROOT Bootstrap

`ROOT`는 공개 signup, pending approval, invitation으로 만들지 않는다. 최초 시스템 관리자 계정은 Spring Boot 서버 기동 시 아래 환경변수가 모두 명시적으로 설정된 경우에만 생성한다.

```bash
SAFE_LINK_ROOT_BOOTSTRAP_ENABLED=true
SAFE_LINK_ROOT_BOOTSTRAP_EMAIL=<root-email>
SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD=<12자 이상 비밀번호>
SAFE_LINK_ROOT_BOOTSTRAP_TOKEN=<일회성 secret>
SAFE_LINK_ROOT_BOOTSTRAP_CONFIRM_TOKEN=<동일한 일회성 secret>
```

운영 규칙:

- 이미 활성 `ROOT` role이 있으면 추가 생성하지 않는다.
- 같은 email 계정이 이미 있으면 기존 pending 계정 승격으로 오해되지 않도록 실패한다.
- 성공/실패 판단에 secret 값을 로그나 문서에 출력하지 않는다.
- 최초 생성 후 bootstrap 환경변수는 제거하고 재시작한다.

## Site Guard 정책

모든 business API handler는 아래 순서를 따른다.

1. 인증된 server session을 확인한다.
2. 서버 권한 정보 또는 Redis cache에서 role과 allowed site id를 불러온다.
3. target resource를 id로 조회한다.
4. resource `site_id`를 allowed site id와 비교한다.
5. Role이 action을 허용하고 site scope가 맞을 때만 허용한다.
6. 민감 action과 유의미한 denial은 audit event로 기록한다.

Request body의 `site_id`만 믿고 authorize하지 않는다.

## PostgreSQL / Flyway 초안

첫 Spring Boot milestone부터 Flyway를 사용한다. 초기 migration 이름은 결정적이고 검토 가능해야 한다.

```text
V001__create_identity_and_site_core.sql
V002__create_tbm_core.sql
V003__create_chat_core.sql
V004__create_file_objects.sql
V005__create_audit_log.sql
V006__create_ai_usage_and_quota.sql
```

초기 schema 초안:

```sql
CREATE TABLE organizations (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  display_name TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'ko',
  account_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'))
);

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  granted_by BIGINT REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role, granted_at),
  CHECK (role IN ('ROOT', 'HQ_ADMIN', 'SITE_ADMIN', 'SAFETY_MANAGER', 'WORKER', 'VIEWER'))
);

CREATE TABLE site_memberships (
  user_id BIGINT NOT NULL REFERENCES users(id),
  site_id BIGINT NOT NULL REFERENCES sites(id),
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, site_id, role),
  CHECK (role IN ('SITE_ADMIN', 'SAFETY_MANAGER', 'WORKER', 'VIEWER')),
  CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE TABLE admin_invitations (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT,
  phone TEXT,
  target_role TEXT NOT NULL,
  target_site_id BIGINT REFERENCES sites(id),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invited_by BIGINT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by BIGINT REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  decided_by BIGINT REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_role IN ('HQ_ADMIN', 'SITE_ADMIN', 'SAFETY_MANAGER', 'VIEWER')),
  CHECK (status IN ('PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED')),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE tbm_notices (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id),
  created_by BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  source_text TEXT NOT NULL,
  normalized_text TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE file_objects (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id),
  owner_user_id BIGINT REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tbm_acknowledgements (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tbm_notice_id BIGINT NOT NULL REFERENCES tbm_notices(id),
  worker_id BIGINT NOT NULL REFERENCES users(id),
  site_id BIGINT NOT NULL REFERENCES sites(id),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_file_id BIGINT REFERENCES file_objects(id),
  UNIQUE (tbm_notice_id, worker_id)
);

CREATE TABLE chat_threads (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id),
  worker_id BIGINT NOT NULL REFERENCES users(id),
  admin_user_id BIGINT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED'))
);

CREATE TABLE chat_messages (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES chat_threads(id),
  site_id BIGINT NOT NULL REFERENCES sites(id),
  sender_user_id BIGINT NOT NULL REFERENCES users(id),
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT,
  audio_file_id BIGINT REFERENCES file_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id BIGINT REFERENCES users(id),
  site_id BIGINT REFERENCES sites(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  decision TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE ai_usage_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id BIGINT REFERENCES users(id),
  site_id BIGINT REFERENCES sites(id),
  feature TEXT NOT NULL,
  vendor TEXT NOT NULL,
  model TEXT,
  input_size BIGINT NOT NULL DEFAULT 0,
  output_size BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0
);

CREATE TABLE ai_quota_policies (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id BIGINT,
  feature TEXT NOT NULL,
  limit_count BIGINT NOT NULL,
  limit_cost NUMERIC(12, 6),
  window_seconds BIGINT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (scope_type IN ('GLOBAL', 'SITE', 'USER'))
);
```

기본 index 초안:

```sql
CREATE INDEX idx_sites_org ON sites (organization_id);
CREATE INDEX idx_site_memberships_site_user ON site_memberships (site_id, user_id);
CREATE INDEX idx_admin_invitations_status_expiry ON admin_invitations (status, expires_at);
CREATE INDEX idx_tbm_notices_site_published ON tbm_notices (site_id, published_at DESC);
CREATE INDEX idx_tbm_ack_site_notice ON tbm_acknowledgements (site_id, tbm_notice_id);
CREATE INDEX idx_file_objects_site_owner ON file_objects (site_id, owner_user_id);
CREATE INDEX idx_chat_threads_site_worker ON chat_threads (site_id, worker_id);
CREATE INDEX idx_chat_messages_thread_time ON chat_messages (thread_id, created_at);
CREATE INDEX idx_audit_logs_site_time ON audit_logs (site_id, occurred_at DESC);
CREATE INDEX idx_ai_usage_site_time ON ai_usage_logs (site_id, occurred_at DESC);
CREATE INDEX idx_ai_quota_policies_scope_feature ON ai_quota_policies (scope_type, scope_id, feature);
```

## Redis 정책 초안

Redis 책임:

- session store와 server-side session invalidation
- login/signup abuse throttling
- 사용자, 현장, 기능 단위 AI rate limit
- 일/월 단위 quota counter
- 짧은 수명의 translation/TBM cache
- 필요 시 SSE fan-out state 또는 notification cursor

권장 key pattern:

```text
session:{sessionId}
user_sessions:{userId}
rate:{feature}:{scope}:{id}:{window}
quota:{feature}:{siteId}:{yyyyMM}
ai_cache:translation:{sha256(sourceLang,targetLang,text,glossaryVersion)}
sse:last_event:{userId}
```

Production에서는 process-local rate limit fallback으로 조용히 동작하면 안 된다.

## Object Storage 정책 초안

Spring Boot에 하나의 storage abstraction을 만든다. 앱은 S3, R2, MinIO-compatible provider와 함께 동작해야 한다.

최소 operation:

- server-side stream에서 object 저장
- SHA-256 계산 및 저장
- MIME type과 size limit 검증
- business transaction 안에서 PostgreSQL metadata row 생성
- 권한 검증 후 short-lived presigned download URL 발급
- 통제된 admin flow를 통한 delete 또는 quarantine

## Audit Log 초안

먼저 아래 action을 audit한다.

- login success/failure
- logout
- session refresh/revocation
- role grant/revoke
- site membership grant/revoke
- admin invitation create/accept/approve/reject/revoke/expire
- TBM publish
- TBM acknowledgment/signature
- file upload와 download URL issuance
- AI vendor call과 quota denial
- cross-site access authorization denial

Audit row는 append-only로 다룬다. 일반 application flow에서 audit row를 update/delete하지 않는다.

## Actuator Health 기준

Spring Actuator health group을 노출한다.

- `liveness`: app process 생존 여부.
- `readiness`: PostgreSQL, Redis, Object Storage, required secret 사용 가능 여부.
- `ai`: 설정된 vendor가 reachable이거나 의도적으로 disabled인지 확인.
- `storage`: non-production-safe test prefix에서 object put/get/delete smoke check.

Session에 필요한 PostgreSQL 또는 Redis가 unavailable이면 readiness는 fail closed해야 한다.

## 1차 마일스톤 완료 기준

1차 마일스톤은 아래가 모두 만족되어야 완료로 본다.

- 세 개의 V3 문서가 존재하고 최신이다.
- Role Contract가 code와 DB draft에 반영되어 있다.
- session/cookie/CSRF behavior가 문서화되어 있다.
- 기존 administrator signup 호환 흐름과 선택적 approval flow가 문서화되어 있다.
- site guard policy가 문서화되어 있다.
- Flyway draft에 identity, site, TBM, file, audit, AI usage table이 있다.
- Redis policy가 session, rate limit, quota, cache를 포함한다.
- Object storage policy가 DB text file storage를 피한다.
- Actuator health 기준이 문서화되어 있다.

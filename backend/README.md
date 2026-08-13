# SQ Link V3 백엔드

SQ Link V3 상용화를 위한 Spring Boot 백엔드 기반 모듈입니다.

이 모듈은 인증, 권한, 역할/현장 접근 제어, 감사 로그, AI 사용량 제한, Object Storage 메타데이터, 채팅 전송, 운영 Health Check를 담당하는 새로운 서버 권한 계층입니다.

## 대체 대상

기존 Next.js, Supabase, Workers 기반 API route는 마이그레이션 참고 코드로 남아 있습니다.
신규 V3 운영 기능은 Service Role 사용이나 브라우저에서 읽을 수 있는 Supabase 세션 구조를 늘리지 말고, 이 Spring Boot 백엔드 뒤로 이동해야 합니다.

## 로컬 서비스

```bash
cd backend
docker compose up -d
```

로컬 서비스 포트:

- PostgreSQL: `localhost:15432`
- Redis: `localhost:16379`
- MinIO S3 API: `http://localhost:19000`
- MinIO console: `http://localhost:19001`

## 실행

```bash
cd backend
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew bootRun
```

백엔드는 Gradle wrapper를 포함합니다. 로컬과 CI 모두 `./gradlew`를 기준으로 빌드합니다.

## 환경변수 요구사항

런타임 값은 환경변수 또는 `application.yml`의 기본값에서 읽습니다.
로컬 예시는 `backend/.env.example`을 기준으로 확인하고, 실제 비밀값은 저장소에 커밋하지 않습니다.

- 일반 실행 필수: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`
- DB timeout 조정: `DB_CONNECTION_TIMEOUT_MS`, `DB_VALIDATION_TIMEOUT_MS`, `DB_INITIALIZATION_FAIL_TIMEOUT`
- 최초 ROOT bootstrap 1회 실행 시에만: `SAFE_LINK_ROOT_BOOTSTRAP_ENABLED`, `SAFE_LINK_ROOT_BOOTSTRAP_EMAIL`, `SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD`, `SAFE_LINK_ROOT_BOOTSTRAP_TOKEN`, `SAFE_LINK_ROOT_BOOTSTRAP_CONFIRM_TOKEN`
- Object Storage 활성화 시 필수: `SAFE_LINK_STORAGE_BUCKET`, `SAFE_LINK_STORAGE_REGION`, `SAFE_LINK_STORAGE_ENDPOINT`, `SAFE_LINK_STORAGE_ACCESS_KEY`, `SAFE_LINK_STORAGE_SECRET_KEY`
- 외부 AI vendor 호출 활성화 전 필수: provider API key, 사용량 제한, 비용 정책 값
- 비밀번호 재설정 이메일 사용 시: `SAFE_LINK_PASSWORD_RESET_EMAIL_ENABLED=true`, `SAFE_LINK_PASSWORD_RESET_EMAIL_FROM`, `SAFE_LINK_PASSWORD_RESET_AWS_REGION` 및 실행 IAM의 `ses:SendEmail`
- 비밀번호 재설정 SMS 사용 시: `SAFE_LINK_PASSWORD_RESET_SMS_ENABLED=true`, `SAFE_LINK_PASSWORD_RESET_AWS_REGION` 및 실행 IAM의 `sns:Publish`
- 재설정 링크 공개 주소: `SAFE_LINK_PUBLIC_APP_URL` (운영 기본값 `https://app.safe-link.co.kr`)
- 개인정보 보존·삭제 정책 승인 후 계정 탈퇴 활성화: `SAFE_LINK_ACCOUNT_DELETION_ENABLED=true` (기본값 `false`)
- 프론트엔드 API base URL: `NEXT_PUBLIC_SAFE_LINK_API_BASE_URL`

운영에서는 `SAFE_LINK_PASSWORD_RESET_EXPOSE_TOKEN`을 반드시 `false`로 유지한다. SES 발신 주소/도메인 검증, SES sandbox 해제 여부, SNS SMS 월 지출 한도를 확인한 뒤 실제 발송을 활성화한다.

## 최초 ROOT Bootstrap

`ROOT`는 공개 가입, pending 승인, 초대 API로 만들지 않는다. 최초 시스템 관리자 계정은 운영자가 서버 환경변수를 명시적으로 넣어 Spring Boot 기동 시 한 번만 생성한다.

```bash
SAFE_LINK_ROOT_BOOTSTRAP_ENABLED=true \
SAFE_LINK_ROOT_BOOTSTRAP_EMAIL=root@example.com \
SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD='<strong-password>' \
SAFE_LINK_ROOT_BOOTSTRAP_TOKEN='<one-time-secret>' \
SAFE_LINK_ROOT_BOOTSTRAP_CONFIRM_TOKEN='<same-one-time-secret>' \
./gradlew bootRun
```

주의:

- 비밀번호는 12자 이상이어야 한다.
- token과 confirm token이 같아야 한다.
- 이미 활성 `ROOT` role이 있으면 생성하지 않고 skip한다.
- 같은 이메일의 계정이 이미 있으면 self-escalation 방지를 위해 실패한다.
- 최초 생성 후에는 bootstrap 환경변수를 제거하고 서버를 재시작한다.

## Health Check

```bash
curl http://localhost:8080/actuator/health/liveness
curl http://localhost:8080/actuator/health/readiness
curl http://localhost:8080/actuator/health/ai
curl http://localhost:8080/actuator/health/storage
```

`readiness`는 PostgreSQL, Redis, Object Storage 설정에 의존합니다. 로컬 서비스가 내려가 있으면 `liveness`로 애플리케이션 프로세스 기동 여부를 확인하고, `readiness`는 빠진 의존성을 `DOWN`으로 드러내야 합니다.

## 구현된 기반

- HttpOnly 서버 세션 쿠키: `SAFE_LINK_SESSION`
- Redis 기반 Spring Session
- CSRF 토큰 endpoint와 상태 변경 API의 CSRF 보호
- 고정 Role Contract: `ROOT`, `HQ_ADMIN`, `SITE_ADMIN`, `SAFETY_MANAGER`, `WORKER`, `VIEWER`
- PostgreSQL/Flyway schema: 계정, 현장, 초대, TBM, 파일 메타데이터, 채팅, 감사 로그, AI 사용량/쿼터
- 누락된 `site_id`와 다른 현장 접근을 거부하는 Site Guard
- 공개 회원가입에서 관리자 권한을 직접 선택하지 못하게 하는 관리자 초대 API
- Object Storage presigned upload/download URL API
- Redis quota와 fail-closed vendor 정책을 가진 AI gateway 진입점
- 채팅 REST API와 SSE 이벤트 endpoint
- liveness, readiness, AI, storage용 Actuator health group
- Next.js `/auth` 관리자 로그인, middleware, `RoleGuard`의 1차 인증 확인
- Spring Boot worker quick-login API: `/api/v1/auth/worker-quick-login`
- Spring Boot worker registration API: `/api/v1/sites/{siteId}/workers`
- Next.js auth 영역의 Supabase readable-cookie fallback 제거
- Secret 기반 최초 ROOT bootstrap runner
- AWS SES/SNS 기반 비밀번호 재설정 안내와 30분·1회용 재설정 토큰
- 탈퇴 즉시 로그인·역할·현장 권한을 해제하고 개인정보를 가명 처리하는 계정 삭제 API
- ROOT 전용 데이터 보존정책 조회 및 Object Storage 만료 파일 dry-run/삭제 API
- 근로자·TBM 목록의 200건 단위 커서 페이징 API

## 대량 목록 페이징

- 근로자: `GET /api/v1/admin/workers/page?limit=200&cursor={next_cursor}`
- TBM: `GET /api/v1/tbm/compat/notices/page?site_id={siteId}&date=YYYY-MM-DD&limit=200&cursor={next_cursor}`

응답의 `has_more=true`인 동안 `next_cursor`를 다음 요청에 전달한다. 기존 목록 API 응답은 호환성을 위해 변경하지 않았다.

## 아직 남은 일

- STT/TTS/Vision 등 바이너리 vendor adapter는 V3 세션 기준 Spring AI Gateway quota를 먼저 통과하지만, 실제 외부 vendor 호출은 일부 Next compatibility route에 남아 있습니다.
- 기존 Supabase `nfc_workers` 데이터는 운영 E2E 전 V3 `users`, `site_memberships`, `worker_quick_login_credentials`로 이관해야 합니다.
- 운영 전 API domain, HTTPS, Secure cookie, CORS, Secret Manager, 중앙 로그 수집 구성을 확정해야 합니다.

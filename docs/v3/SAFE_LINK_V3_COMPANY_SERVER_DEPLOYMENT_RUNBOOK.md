# SQ Link V3 개인 AWS 테스트 / 회사 서버 이전 런북

작성일: 2026-07-16

이 문서는 현재 개인 AWS EC2에서 검증한 Spring Boot API 서버를 나중에 회사 서버 또는 회사 AWS 계정으로 옮길 때 따라야 할 기준이다.

## 현재 위치

현재 개인 AWS EC2는 운영 서버가 아니다. 단, 단순 개발 테스트가 아니라 회사 서버로 옮기기 전 운영 조건을 최대한 모사하는 스테이징 서버로 사용한다.

```text
목적: 회사 서버 이전 전 운영 유사 스테이징 검증
서버: 개인 AWS EC2
프론트 접속 주소: http://43.200.49.69
API 접속 주소: http://43.200.49.69:8080
실행 방식: systemd 서비스
서비스명: safelink-v3-backend, safelink-v3-frontend
DB/Redis/Storage: EC2 내부 Docker 테스트용
HTTPS/도메인: 미적용
확인된 회사 도메인: safe-link.co.kr
무료 안정화: 로컬 DB 백업, 로그 회전, 수동 헬스체크 적용
```

운영 유사 스테이징의 원칙:

- 실제 고객 운영 데이터는 사용하지 않는다.
- 실제 운영 secret을 채팅, 문서, 로그에 노출하지 않는다.
- 운영과 같은 Spring Boot, PostgreSQL, Redis, Object Storage, systemd, health check 흐름으로 검증한다.
- 가능하면 회사 운영과 같은 도메인/HTTPS/CORS/Secure cookie 조건으로 검증한다.
- 비용이 드는 AWS managed resource(RDS, ElastiCache, S3)는 사용자가 승인한 뒤 구성한다.
- 무료 플랜/크레딧 테스트 중에는 RDS, ElastiCache, S3, Load Balancer, NAT Gateway를 생성하지 않는다.

현재 서버에서 검증한 것:

- Java 21 설치
- Docker / Docker Compose 설치
- PostgreSQL, Redis, MinIO 테스트 컨테이너 실행
- Spring Boot `bootJar` 빌드 성공
- Spring Boot API systemd 서비스 등록
- Next.js frontend standalone build 생성 및 systemd 서비스 등록
- Actuator liveness/readiness 외부 확인
- 프론트 `/`, `/auth` 외부 200 응답 확인
- 로그인 전 `/api/auth/me` 401 응답 확인
- Flyway migration 16개 적용
- PostgreSQL, Redis, MinIO Docker 컨테이너 `unless-stopped` 자동 시작 정책 적용
- PostgreSQL, Redis, MinIO Docker 포트를 `127.0.0.1` 로컬 바인딩으로 제한
- 로컬 PostgreSQL 백업 systemd timer 등록
- 백엔드 로그 `logrotate` 14일 회전 설정
- 수동 운영 헬스체크 스크립트 등록

현재 서버에서 운영 유사 스테이징으로도 아직 부족한 것:

- HTTPS가 아니다.
- IP 주소로 직접 노출되어 있다.
- API는 테스트 편의를 위해 8080 포트도 외부에서 접근 가능하다.
- DB, Redis, Storage가 EC2 내부 Docker 테스트용이다.
- 운영 Secret Manager, 중앙 로그, 외부 백업 저장소, 알림이 없다.
- 실제 운영 데이터와 파일이 없다.

따라서 현재 상태는 `프론트 + API 프로세스 기동 검증 + 무료 범위의 기본 운영 보조 설정 완료` 단계이고, `운영 유사 스테이징 완료`는 아니다.

## 개인 AWS 테스트 서버 운영 보조 설정

2026-07-16 현재 개인 AWS 테스트 서버에는 비용이 추가되지 않는 범위에서 아래 설정을 적용했다.

```text
DB 백업 스크립트: /home/ubuntu/safelink-v3/ops/backup-postgres.sh
DB 백업 위치: /home/ubuntu/safelink-v3/backups/postgres
DB 백업 보관: 7일
DB 백업 timer: safelink-v3-postgres-backup.timer
백엔드 로그 회전: /etc/logrotate.d/safelink-v3
수동 헬스체크: /home/ubuntu/safelink-v3/ops/healthcheck.sh
```

백업 timer 기준:

```text
OnCalendar=*-*-* 18:20:00 UTC
한국 시간 기준: 매일 03:20 KST 전후
RandomizedDelaySec=5m
```

운영 점검 명령:

```bash
/home/ubuntu/safelink-v3/ops/healthcheck.sh
systemctl list-timers --all | grep safelink
sudo systemctl status safelink-v3-postgres-backup.service --no-pager
ls -lh /home/ubuntu/safelink-v3/backups/postgres
sudo logrotate -d /etc/logrotate.d/safelink-v3
```

정상 검증 결과:

```text
frontend: OK
backend-readiness: OK
backend-liveness: OK
postgres: healthy
redis: healthy
minio: running
수동 DB 백업 파일 생성 확인
```

## 운영 이전 원칙

회사 서버 또는 회사 AWS 계정으로 옮길 때는 아래 순서를 지킨다.

1. 회사 서버/회사 AWS 정보 확인
2. 회사 서버에서 PostgreSQL, Redis, Object Storage 연결 가능 여부 확인
3. Spring Boot API만 먼저 올려 Actuator health 확인
4. 도메인/HTTPS/CORS/Secure cookie 적용
5. Next.js 화면의 API base URL을 회사 API 도메인으로 연결
6. 실서비스 기준 QA 시나리오 작성
7. 실제 worker/account/data import 리허설
8. AI vendor key와 quota 확인
9. 스테이징 전체 QA
10. 운영 배포
11. 운영 배포 직후 smoke QA
12. 로그/모니터링/백업 확인

회사 운영 서버는 사용자가 명시적으로 지시하기 전까지 수정하지 않는다.

## 실서비스 기준 QA 단계

QA는 배포 전과 배포 후에 모두 한다. 목적이 다르다.

```text
배포 전 QA: 운영과 같은 조건의 스테이징에서 전체 기능을 검증한다. 여기서 실패하면 운영 배포하지 않는다.
배포 직후 QA: 운영 서버에 올린 직후 핵심 기능만 짧게 확인한다. 장애가 있으면 즉시 롤백하거나 수정한다.
배포 후 안정화 QA: 실제 사용 전후 24~72시간 동안 로그, 백업, 에러, 비용, AI quota를 관찰한다.
```

배포 전 스테이징 QA 조건:

```text
HTTPS 적용
SAFE_LINK_COOKIE_SECURE=true
CORS가 실제 도메인으로 제한됨
운영과 같은 DB/Redis/Object Storage 방식 또는 운영과 동일한 리허설 환경
Supabase 데이터 이전 리허설 완료
실제 역할/현장 구조와 비슷한 테스트 계정 준비
```

필수 QA 시나리오:

1. 인증 / 세션
   - ROOT 로그인
   - 관리자 가입 신청
   - pending 계정 승인
   - 로그아웃
   - 세션 만료
   - 쿠키 `HttpOnly`, `Secure`, `SameSite` 확인

2. 권한 / 현장 격리
   - ROOT, HQ_ADMIN, SITE_ADMIN, SAFETY_MANAGER, WORKER 권한별 화면 확인
   - 다른 현장 데이터 조회 차단 확인
   - 승인되지 않은 계정 접근 차단 확인
   - 관리자 셀프 승격 불가 확인

3. 관리자 주요 기능
   - 현장 생성/수정
   - 근로자 등록
   - QR 생성
   - TBM 생성
   - TBM 진행 상태 확인
   - 관리자 채팅/공지 흐름 확인

4. 근로자 모바일 웹
   - iPhone Safari
   - Android Chrome
   - QR 접속
   - TBM 참여
   - 서명
   - 퀴즈/교육/채팅 확인
   - 작은 화면에서 버튼/텍스트 겹침 없는지 확인

5. 데이터 이전 검증
   - Supabase 원본 건수와 V3 PostgreSQL import 건수 비교
   - 사용자, 현장, 근로자, TBM, 채팅, 서명, 파일 metadata 매핑 확인
   - `site_id` 누락 데이터 처리 확인
   - 이전 대상 제외 데이터 목록 문서화

6. 파일 / 서명 / Object Storage
   - 서명 저장
   - 파일 업로드
   - 권한 없는 파일 접근 차단
   - DB에는 파일 본문이 아니라 object key/hash/metadata만 저장되는지 확인

7. AI 번역 / STT / TTS
   - 번역 정상 호출
   - STT/TTS 정상 호출
   - Redis rate limit 동작
   - quota 초과 시 차단
   - vendor 장애 시 앱 전체 장애로 번지지 않는지 확인

8. 운영 안정성
   - API liveness/readiness 확인
   - DB 백업 생성 확인
   - 백업 복구 리허설
   - 서비스 재시작 후 자동 복구 확인
   - 로그에 secret이 찍히지 않는지 확인

9. 보안 / 네트워크
   - HTTPS 강제
   - HTTP 접속 처리
   - CORS origin 제한
   - API key, DB password, vendor secret 노출 없음
   - DB/Redis/Object Storage 포트 외부 직접 노출 없음

QA 결과는 아래 형태로 남긴다.

```text
QA 일시:
환경: 개인 AWS 스테이징 / 회사 스테이징 / 운영
빌드 버전:
테스트 계정:
통과 항목:
실패 항목:
수정 필요 항목:
운영 배포 가능 여부: 가능 / 불가
```

## 모바일 앱 출시 준비

앱 개발자 계정이 아직 없어도 모바일 앱 준비는 먼저 진행한다. 세부 체크리스트는 아래 문서를 기준으로 한다.

```text
docs/v3/SAFE_LINK_V3_MOBILE_APP_RELEASE_PREP.md
```

현재 모바일 앱 준비 기준:

```text
테스트 웹앱 URL: https://app-test.safe-link.co.kr
테스트 API URL: https://api-test.safe-link.co.kr
현재 앱 폴더: apps/mobile
현재 상태: Capacitor 기반 진단/초기 셸 + Android Gradle 프로젝트 + iOS Xcode 프로젝트 생성 완료
Android 출시 연결 상태: 개발자 계정 수령 후 Application ID, 앱 이름, App Links host, upload key 값만 `apps/mobile/android/release.local.properties`에 넣으면 release readiness 검증 가능
iOS 출시 연결 상태: Apple Developer 계정 수령 후 Bundle ID, 앱 이름, App Links host, Team ID 값을 `apps/mobile/ios/release.local.xcconfig`에 넣으면 release readiness 검증 가능
남은 Android 상태: debug/release 빌드는 Google Android SDK license 수락과 SDK package 설치 필요
남은 iOS 상태: Xcode signing team, provisioning profile, TestFlight archive 생성 필요
```

앱 배포 전 필수 조건:

- `safe-link.co.kr` 하위 테스트/운영 도메인 HTTPS 적용
- `SAFE_LINK_COOKIE_SECURE=true` 조건에서 모바일 로그인 검증
- iOS Bundle ID / Android Application ID 최종 확정
- 앱 아이콘, 스플래시, 스크린샷, 개인정보처리방침, 계정 삭제 URL 준비
- TestFlight / Google Play Internal testing QA
- 모바일 세션 토큰 저장소 암호화 저장으로 교체
- 계정 삭제 요청 시작 경로 구현 및 심사 전 QA
- 스토어 제출 자료는 `apps/mobile/store` 템플릿 기준으로 작성

## 회사 서버에서 먼저 받아야 하는 정보

회사 서버로 옮기려면 아래 값이 필요하다.

```text
1. 회사 서버 접속 방식
   - SSH host 또는 VPN 접속 여부
   - SSH user
   - SSH key 또는 접속 방법
   - OS 종류

2. 회사 서버 네트워크
   - 외부 공개 IP 또는 내부 IP
   - 도메인 사용 여부
   - 방화벽에서 열 수 있는 포트
   - HTTPS 인증서 적용 방식

3. 운영 DB
   - PostgreSQL host
   - port
   - database name
   - username
   - password 입력 방식
   - SSL 필요 여부
   - 회사 DB 방화벽에서 API 서버 IP 허용 여부

4. 운영 Redis
   - Redis host
   - port
   - password 필요 여부
   - TLS 필요 여부

5. 운영 Object Storage
   - S3/R2/MinIO 중 무엇을 쓰는지
   - bucket 이름
   - region
   - endpoint
   - access key / secret key 입력 방식

6. 운영 AI vendor
   - Google Cloud API key
   - Naver Papago client id/secret
   - OpenAI API key
   - quota/결제 활성화 여부

7. 운영 도메인
   - 기본 도메인: safe-link.co.kr
   - 웹 도메인 후보: app.safe-link.co.kr 또는 safe-link.co.kr
   - API 도메인 후보: api.safe-link.co.kr
   - 테스트 웹 도메인 후보: app-test.safe-link.co.kr
   - 테스트 API 도메인 후보: api-test.safe-link.co.kr
   - DNS 관리자: Cloudflare 권한 보유자 확인 필요
```

비밀번호, API key, secret key는 문서나 채팅에 쓰지 않는다. 상태만 `SET`, `MISSING`, `UNKNOWN`으로 기록한다.

## safe-link.co.kr DNS 적용 계획

2026-07-21 기준 확인된 도메인은 `safe-link.co.kr` 이다. DNS 네임서버는 Cloudflare로 확인되었다.

테스트 서버에 먼저 연결할 DNS 레코드:

```text
Type: A
Name: app-test
Value: 43.200.49.69
Proxy status: DNS only

Type: A
Name: api-test
Value: 43.200.49.69
Proxy status: DNS only
```

연결 후 목표 주소:

```text
프론트/앱 테스트 주소: https://app-test.safe-link.co.kr
Spring Boot API 테스트 주소: https://api-test.safe-link.co.kr
```

운영 전환 시 후보:

```text
프론트/앱 운영 주소: https://app.safe-link.co.kr 또는 https://safe-link.co.kr
Spring Boot API 운영 주소: https://api.safe-link.co.kr
```

루트 도메인 `safe-link.co.kr` 은 회사가 별도 홈페이지나 안내 페이지로 사용할 수 있으므로, 테스트 단계에서는 루트 도메인을 바로 변경하지 않고 `app-test`, `api-test` 서브도메인부터 사용한다.

## 회사 서버용 환경변수

회사 서버에서 Spring Boot API가 읽어야 하는 운영 환경변수는 아래 형태다.

```bash
SERVER_PORT=8080

DB_URL=jdbc:postgresql://<company-db-host>:5432/safelink
DB_USERNAME=<SET>
DB_PASSWORD=<SET>

REDIS_HOST=<company-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<SET_OR_EMPTY>

SAFE_LINK_COOKIE_SECURE=true
SAFE_LINK_CORS_ALLOWED_ORIGINS=https://<web-domain>

SAFE_LINK_STORAGE_ENABLED=true
SAFE_LINK_STORAGE_BUCKET=<bucket>
SAFE_LINK_STORAGE_REGION=ap-northeast-2
SAFE_LINK_STORAGE_ENDPOINT=<empty-for-aws-s3-or-endpoint-for-r2-minio>
SAFE_LINK_STORAGE_ACCESS_KEY=<SET>
SAFE_LINK_STORAGE_SECRET_KEY=<SET>

SAFE_LINK_AI_VENDOR_ENABLED=true
SAFE_LINK_AI_FAIL_OPEN_LOCAL=false
GOOGLE_CLOUD_API_KEY=<SET>
NAVER_CLIENT_ID=<SET>
NAVER_CLIENT_SECRET=<SET>
OPENAI_API_KEY=<SET>
```

개인 AWS 테스트 서버와 다른 점:

```text
SAFE_LINK_COOKIE_SECURE=false  -> 운영에서는 true
DB_URL=localhost Docker       -> 운영 DB host
REDIS_HOST=localhost          -> 운영 Redis host
SAFE_LINK_STORAGE_ENABLED=false -> 운영에서는 true
SAFE_LINK_AI_VENDOR_ENABLED=false -> 운영에서는 true, 단 quota 확인 후
```

## 회사 서버 배포 확인 명령

회사 서버에 API를 올린 뒤 최소 확인 명령은 아래다.

```bash
curl -s http://localhost:8080/actuator/health/liveness
curl -s http://localhost:8080/actuator/health/readiness
curl -s http://localhost:8080/actuator/health/ai
curl -s http://localhost:8080/actuator/health/storage
```

도메인/HTTPS 연결 후 외부 확인:

```bash
curl -s https://api.<domain>/actuator/health/liveness
curl -s https://api.<domain>/actuator/health/readiness
```

정상 기준:

```text
liveness: UP
readiness: UP
DB migration: current version 확인
Redis session/quota 가능
storage: 운영 storage 설정 확인
ai: key 값 노출 없이 provider availability 확인
```

## systemd 기준

회사 서버에서도 단순 EC2/VM 배포를 선택하면 systemd 서비스명은 동일하게 둔다.

```text
백엔드 서비스명: safelink-v3-backend
백엔드 환경파일: /etc/safelink/v3-backend.env
백엔드 로그파일: /var/log/safelink/v3-backend.log
백엔드 Jar 위치: /opt/safelink/backend/safe-link-v3-backend-0.1.0.jar

프론트 서비스명: safelink-v3-frontend
프론트 실행 방식: Next.js standalone server.js
프론트 포트: 80 또는 운영 reverse proxy 내부 포트
프론트 공개 API base URL: NEXT_PUBLIC_SAFE_LINK_API_BASE_URL
프론트 서버 내부 API base URL: SAFE_LINK_INTERNAL_API_BASE_URL
프론트 공개 앱 URL: SAFE_LINK_PUBLIC_APP_URL
```

프론트 standalone 서버는 API route와 middleware에서 Spring Boot를 서버 내부망으로 호출해야 한다.
같은 EC2에 프론트와 API를 같이 둘 때는 아래처럼 분리한다.

```text
NEXT_PUBLIC_SAFE_LINK_API_BASE_URL=https://api.safe-link.co.kr
SAFE_LINK_INTERNAL_API_BASE_URL=http://localhost:8080
SAFE_LINK_PUBLIC_APP_URL=https://app.safe-link.co.kr
```

브라우저 번들은 공개 API 주소를 사용할 수 있지만, Next.js 서버 라우트가 같은 EC2의 공인 IP로 되돌아 호출하면 환경에 따라 실패할 수 있다.

운영 명령:

```bash
sudo systemctl status safelink-v3-backend
sudo systemctl status safelink-v3-frontend
sudo systemctl restart safelink-v3-backend
sudo systemctl restart safelink-v3-frontend
sudo systemctl stop safelink-v3-backend
sudo journalctl -u safelink-v3-backend -n 100 --no-pager
sudo journalctl -u safelink-v3-frontend -n 100 --no-pager
tail -f /var/log/safelink/v3-backend.log
```

## 운영 전 차단 기준

아래가 해결되지 않으면 운영 완료로 보지 않는다.

- HTTPS API 도메인이 없다.
- `SAFE_LINK_COOKIE_SECURE=true`가 아니다.
- CORS origin이 실제 웹 도메인으로 제한되어 있지 않다.
- 실서비스 기준 스테이징 QA가 완료되지 않았다.
- 운영 배포 직후 smoke QA가 완료되지 않았다.
- PostgreSQL이 테스트 Docker DB다.
- Redis가 테스트 Docker Redis다.
- Object Storage가 꺼져 있거나 테스트 MinIO다.
- AI vendor quota/결제/장애 제한이 확인되지 않았다.
- 실제 worker/account data import가 없다.
- 중앙 로그/모니터링/알림/백업이 없다.

## 다음 작업 순서

개인 AWS에서 다음으로 할 일:

1. 실서비스 기준 QA 시나리오를 확정한다.
2. 현재 프론트/백엔드 화면 흐름 테스트를 더 진행한다.
3. 운영과 비슷하게 만들기 위해 HTTPS/API 도메인 또는 임시 도메인 적용을 검토한다.
4. `SAFE_LINK_COOKIE_SECURE=true`와 실제 CORS origin 조건으로 검증한다.
5. 비용 승인 전까지 RDS PostgreSQL, ElastiCache Redis, S3, Load Balancer, NAT Gateway를 만들지 않는다.
6. 비용 승인 후에만 RDS PostgreSQL, ElastiCache Redis, S3를 붙여 EC2 내부 Docker 의존 제거를 검토한다.
7. 관리자/근로자 smoke test를 한다.
8. 회사 서버 접속 정보와 DB/Redis/Storage 정보를 받는다.

회사 서버 정보가 준비되면 다음으로 할 일:

1. 회사 서버 접속만 확인한다.
2. 회사 DB/Redis/Storage 연결 가능 여부만 먼저 확인한다.
3. 그 다음 Spring Boot API를 올린다.
4. 마지막에 도메인/HTTPS/Next.js를 연결한다.

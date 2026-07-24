# SQ Link V3 GitHub Actions 운영 배포

## 목적

`refactor/v3-commercialization-20260710` 브랜치에 push되면 GitHub Actions가 frontend와 backend를 테스트·빌드하고 운영 서버에 불변 release로 배포한다. 배포 중에는 release 디렉터리를 새로 만들고 `current` 심볼릭 링크만 교체하므로, 실패한 빌드를 현재 운영 파일 위에 덮어쓰지 않는다.

## 비밀값 관리 기준

### GitHub Actions Secrets

GitHub 저장소 **Settings → Secrets and variables → Actions → Secrets**에 아래 세 값만 넣는다.

| 이름 | 용도 | 비고 |
|---|---|---|
| `SAFE_LINK_DEPLOY_HOST` | 운영 서버 host 또는 IP | 배포 설정을 한곳에 두기 위해 Secret으로 관리 |
| `SAFE_LINK_DEPLOY_USER` | SSH 배포 계정 | 현재 `ubuntu` |
| `SAFE_LINK_DEPLOY_SSH_PRIVATE_KEY` | GitHub Actions 전용 SSH 개인키 | 개인 개발자 PEM 키를 재사용하지 않는다 |

`SAFE_LINK_DEPLOY_SSH_PRIVATE_KEY`는 GitHub Actions 전용으로 새로 발급한다. 공개키만 운영 서버의 `ubuntu` 계정 `authorized_keys`에 등록한다. 이 키는 Actions 외에는 사용하지 않고, 유출 또는 담당자 변경 시 즉시 폐기·교체한다.

### 운영 서버 환경파일

아래 값은 GitHub Actions Secret에 넣거나 Git에 커밋하지 않는다. 운영 서버의 `/etc/safelink/v3-backend.env`에서 유지하고 파일 권한은 root만 읽을 수 있게 한다. 장기적으로는 AWS Secrets Manager, 1Password Secrets Automation, Vault 등 Secret Manager로 이전한다.

- `DB_PASSWORD`, `REDIS_PASSWORD`
- `SAFE_LINK_STORAGE_ACCESS_KEY`, `SAFE_LINK_STORAGE_SECRET_KEY`
- `GOOGLE_CLOUD_API_KEY`, `NAVER_CLIENT_SECRET`, `OPENAI_API_KEY`
- `SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD`, bootstrap token류

`.gitignore`는 `.env*`, `*.pem`, Android/iOS keystore와 local credential 파일을 이미 제외한다. Cloudflare Worker를 계속 쓰는 레거시 경로의 secret은 Cloudflare Dashboard Secret으로 유지하며, V3 Spring Boot 운영 비밀값의 저장소가 아니다.

## 최초 1회 서버 준비

1. GitHub Actions 전용 ED25519 키 쌍을 발급한다.
2. 공개키를 `/home/ubuntu/.ssh/authorized_keys`에 추가한다.
3. 이 저장소의 `scripts/deploy/install-server-ci-deploy.sh`와 `scripts/deploy/activate-release.sh`를 서버에 복사한다.
4. 서버에서 `sudo bash install-server-ci-deploy.sh`를 한 번 실행한다.
5. 위 세 GitHub Actions Secret을 등록한다.
6. 대상 브랜치에 push하여 첫 배포를 실행한다.

설치 스크립트는 서비스가 immutable release의 `current` 링크를 실행하도록 바꾸고, GitHub Actions SSH 계정에는 `/usr/local/sbin/safelink-v3-activate-release <git-sha>`만 비밀번호 없이 실행할 권한을 부여한다. 임의 `sudo` 권한을 주지 않는다.

## 배포 검증과 롤백

workflow는 배포 뒤 다음을 확인한다.

- `/actuator/health/readiness`가 `UP`
- 비로그인 `/admin` 요청이 `https://app.safe-link.co.kr/auth`로 이동

현재 release와 최근 네 개 release를 서버에 남긴다. 롤백은 관리자가 `current` 링크를 이전 release로 바꾼 뒤 두 서비스를 재시작하는 운영 절차로 수행한다. GitHub Actions가 배포 중 secret 값을 출력하지 않도록 workflow 로그에는 환경 변수 내용을 출력하지 않는다.

## V3 안정화 기준과 현재 구현 상태

기존 V3 문서에는 요청한 안정화 방향이 이미 명시되어 있다.

- `SAFE_LINK_COMMERCIAL_STABILIZATION_CRITERIA.md`: RLS/권한, 세션, Redis quota, object storage, audit, health 기준
- `SAFE_LINK_V3_CLIENT_INPUT.md`: Next.js/Spring Boot/PostgreSQL/Redis/Storage/AI Gateway 표준과 Supabase/Workers 축소 원칙
- `SAFE_LINK_V3_COMPANY_SERVER_DEPLOYMENT_RUNBOOK.md`: 서버 환경변수, HTTPS, CORS, health 및 QA 절차

이 workflow는 그중 **Docker/GitHub Actions 또는 사내 CI/CD**, 배포 직후 health 확인, secret 분리를 실제로 채운다. RLS·현장 격리·AI vendor 교체·Object Storage 운영 전환은 별도 코드와 인프라 검증이 남아 있으며, workflow가 그것들을 자동으로 완료시키지는 않는다.

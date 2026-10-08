# SQ Link V3 GitHub Actions 운영 배포

## 목적

GitHub Actions의 `Deploy SQ Link V3 production` workflow는 `refactor/v3-commercialization-20260710` 브랜치 push 또는 수동 실행으로 frontend와 backend를 테스트·빌드하고 운영 서버에 불변 release로 배포한다. 이 브랜치에 push하기 전 운영 배포 권한과 백업 상태를 확인한다. 배포 중에는 release 디렉터리를 새로 만들고 `current` 심볼릭 링크만 교체하므로, 실패한 빌드를 현재 운영 파일 위에 덮어쓰지 않는다.

## 2026-10-08 iPhone PDF 다운로드 전용 보완 배포

- 사용자 승인: 운영에서 PDF만 미리보기로 열린다는 제보 후 PDF 수정만 배포. 이전 운영 기준은 `f393d2c0d389e2267cb228eca7c0797da51ba1c1`이며 직전 Actions `37719193260`은 성공했다.
- 범위: `ExportPreview.tsx`의 PDF 다운로드 Blob만 `application/octet-stream`으로 감싸고 PDF 링크의 새 탭 target을 제거한다. PDF bytes/파일명/확장자/공유용 MIME은 보존한다. 서버 업로드·파일 저장 API·백엔드·DB·APK·관리자/가입/권한 변경은 없다.
- 검증: 운영 기준에 이번 수정만 복사한 격리 빌드·타입·린트 통과. `tests/glossary-export-browser.mjs`를 Chrome/WebKit 1280/390/320px에서 실행하여 다운로드 MIME, PDF 헤더/파일명, 공유/다운로드 bytes 동일성, 추가 탭 없음, 다른 형식 다운로드 및 실패 복구를 확인했다. 배포 전 소스가 검증한 격리 소스와 동일함을 재확인했다.
- 물리 iPhone Safari의 시스템 확인창은 별도 단말 검증이 필요하다. 자동화 download 이벤트를 실제 기기의 확인창/저장 완료 증거로 표현하지 않는다.
- 사전 확인: 운영 API readiness `UP`, 원격/로컬 기준 SHA 및 직전 성공 Actions 일치. 로컬 운영 SSH 인증이 없어 활성 방송·최신 백업을 직접 재확인하지 못했으며 DB 변경은 없다. 기존 workflow는 변경 없는 백엔드도 재빌드·재시작한다.
- 완료 판단: 이 수정 커밋의 Actions 활성화/스모크 성공과 운영 로그인/인증 이동/API 상태를 확인한다. 장애 시 이전 운영 실행본으로 복귀하며 DB와 미완료 로컬 작업은 보존한다.

## 2026-10-08 iPhone Safari 내보내기 후속 배포

- 사용자 승인: iPhone Safari 내보내기 후속 수정 배포. 이전 운영 기준은 `19a2a8a0c9788e53999ea663237550d25d3447c9`이다.
- 포함: 공통 파일 미리보기, 파일 생성 후 자동 다운로드 요청, 같은 파일의 수동 다운로드 재시도, 지원 기기의 공유/파일 저장 기능, 20개 언어 안내와 관련 테스트. 9개 관리자 내보내기 화면은 공통 기능에 생성 파일을 반환하도록만 변경한다.
- 제외: 관리자·직원 분류, 가입·권한, V038/V039, 채팅 소음감지 배치 및 헤더 높이 작업. 백엔드 코드·DB·계정·현장 연결·APK 변경 없음. 기존 workflow는 변경 없는 백엔드도 테스트·빌드·재시작한다.
- 검증: 운영 기준 커밋에 내보내기 변경만 복사한 격리 소스로 운영 빌드(타입/린트 포함)를 확인한다. Chrome/WebKit의 1280/390/320px 테스트에서 미리보기, PDF/XLSX/DOC/HWP 다운로드, 자동 요청 차단 후 직접 탭 재시도, 공유 취소·실패 처리, 다국어 안내를 확인했다. 9개 내보내기 화면의 PC 파일 생성 검사와 운영 CSP 적용 빌드 검사도 통과했다.
- 한계: 물리 iPhone Safari의 저장 확인창은 직접 검증하지 않았다. 자동 요청이 제한되면 사용자가 다운로드 또는 공유/파일 저장을 눌러야 하며 저장 완료를 자동으로 단정하지 않는다. 기존 PDF 이미지 기반 형식과 DOC/HWP HTML 호환 형식은 유지한다.
- 배포 전: 원격 브랜치와 직전 성공 Actions의 SHA 일치, API readiness `UP` 확인. 로컬 운영 SSH 인증이 없어 활성 방송·최신 서버 백업을 직접 재확인하지 못했으며 이번 배포에는 DB 변경이 없다. 이전 백업 기록은 아래에 보존한다.
- 완료 판단: 이 변경만 커밋·push한 후 해당 SHA의 Actions 활성화/스모크 테스트 성공과 공개 운영 상태를 확인한다. 장애 시 이전 운영 실행본으로 복귀하고 DB는 보존한다.

## 2026-10-08 내보내기 수정 한정 배포

- 사용자 승인: 내보내기 수정만 우선 배포. 관리자·직원 분류, 가입·권한 변경은 추가 기획 후 진행한다.
- 포함: 공통 내보내기 메뉴 클릭/터치·키보드 조작, 용어집 헤더 겹침 수정, PDF 실제 파일 생성, 모바일 Blob 다운로드 수명 보완, 서명 이미지 검증·포함, 관련 테스트와 PDF 의존성.
- 제외: 관리자/근로자 분류·가입·권한 작업, V038/V039, 채팅 소음감지 배치, 헤더 높이 문제. 백엔드 코드·DB 구조·계정·현장 연결·APK는 변경하지 않는다. 기존 배포 workflow는 변경 없는 백엔드도 다시 빌드·재시작한다.
- 배포 기준: 이전 운영 커밋 `207fa5e75566d762488800d1e506bf660f28bcda`와 내보내기 파일만 별도 복사해 운영 설정의 `npm run build` 성공(타입/린트 포함). 전체 작업 디렉터리의 미완료 변경을 빌드에 섞지 않았다.
- 브라우저 검증: `tests/glossary-export-browser.mjs`를 위 격리 소스에서 Chrome 및 WebKit, 1280/390/320px로 실행하여 모두 통과. 메뉴 겹침·터치·키보드, PDF/XLSX/DOC/HWP 다운로드, 서명 이미지, 긴 행·마지막 행 유지, 오류/재시도·빈 목록을 가상 데이터로 확인했다. 실제 휴대폰 검증을 대신하지 않는다.
- 제한: PDF는 이미지 기반으로 텍스트 검색/복사를 지원하지 않으며 DOC/HWP는 기존 HTML 호환 형식이다. `tests/all-exports-browser.mjs`는 진단 도구로서, 별도 페이지의 작은 화면 메뉴 잘림과 `/control` 미구현 버튼까지 해결되었다는 의미가 아니다.
- 배포 전 공개 상태: API readiness `UP`, 로그인 페이지 200, 직전 Actions 성공 및 원격 브랜치 SHA 일치 확인. 로컬 운영 SSH 인증이 없어 현재 release 링크·활성 방송·최신 백업은 이번 실행에서 직접 확인하지 못했다. 이전 백업 기록은 아래 10/6 절에 보존되어 있으며 이번 배포에는 DB 변경이 없다.
- 완료 판단: 이번 커밋의 GitHub Actions 성공과 배포 후 공개 health/인증 이동/수정된 정적 파일 반영을 확인한 뒤 보고한다. 실패 시 이전 운영 커밋으로 복귀하며 미완료 로컬 작업은 보존한다.

## 2026-10-06 전체 변경 운영 배포

- 사용자 승인: 미커밋 변경 전체 push 및 프론트·백엔드·DB 배포, 테스트 화면 제공.
- 범위: HQ/ROOT 전국 TBM 라이브·최종 전파/발신자 질문 연결, 영문 이름 입력 제한, TBM 위험성 평가 목록과 밝은 카테고리 UI. 기존 임시→정식 전환 승인 정책을 새로 변경하지 않는다.
- V037은 전국 TBM 그룹/현장 연결 테이블만 추가한다. 기존 회원·현장 소속·서명·TBM 기록을 일괄 수정하거나 삭제하지 않는다. 배포 실패 시 이전 실행본으로 복귀하되 새 테이블/자료는 보존한다.
- 사전 확인: 두 운영 서비스 active, readiness UP, Flyway V036 성공, 최근 15분 활동한 활성 방송 0건. 이전 release `e7103d752cc4070311bdc1b5a559ab3fe3ca93e7`.
- 백업: `/home/ubuntu/safelink-v3/backups/nationwide-20261006-sytIE3/database.dump` 9,957,445 bytes, pg_restore 목록 확인 성공. SHA256 `818ba1bdd0aacf56b8f21d0f7fcda951d2200b6125e1b67be4776fff2dbae2d1`. 같은 권한 제한 디렉터리에 이전 release 경로 보관.
- 로컬: 타입 검사, 변경 파일 ESLint, 프론트 단위 18개, 백엔드 실행 99개 통과. 기존 Testcontainers 13개는 로컬 Docker 탐지로 skip이며 GitHub Actions에서 다시 실행한다. 전국 DB 테스트 7개는 별도 PostgreSQL로 실제 실행했다.
- 격리 브라우저: 전국 TBM 실제 BFF/DB/SSE·참여/미참여·질문 연결, 영문 입력/IME/붙여넣기·20개 언어 화면, 위험성 평가 목록 확인. 실제 음성 품질과 서명 스토리지/OS 푸시는 검증 범위에서 제외.
- 운영 더미 계정 생성/실제 전국 방송 테스트는 하지 않는다. 로컬 전용 HQ/근로자 더미는 3100/18081에서만 제공되고 운영 JAR에는 sandbox 소스셋을 포함하지 않는다. APK 네이티브 변경·재빌드 없음.
- Actions 성공, 실행 release SHA, V037 성공, readiness 및 운영 페이지 반영을 확인한 뒤 완료 보고한다.

## 2026-10-02 TBM 참여 구분·초안 정정 배포 준비

- 사용자 승인: 보류하던 프론트·백엔드·DB 변경 전체 운영 배포. 동작 명세는 `TBM_REALTIME_DELIVERY.md`의 최신 절을 따른다. 방송 종료는 요약 생성, 최종 전파는 관리자 브로드캐스트 클릭으로 구분한다.
- V035는 활성 TBM 참여 기록, V036은 버전이 있는 실시간 수정 초안 테이블만 추가한다. 기존 공지·서명·계정은 변경하지 않는다. 이전 실행본으로 롤백할 때 추가 테이블은 보존하며 운영 데이터 전체 복원은 자동 수행하지 않는다.
- 배포 전: 최근 15분 활동 활성 방송 0건, 프론트/백엔드 서비스 active, 마이그레이션 V034까지 성공. 이전 릴리스 `3a7ddc7e79bf11d58d4a9187253b21fa067d3a22`.
- DB 백업 `/home/ubuntu/safelink-v3/backups/tbm-draft-20261002-9Bcw0T/database.dump` (9.5MB). 서버 내 권한 제한, pg_restore 목록 검사 성공. SHA256 `1d3ed363b8d11409626d82535648ac2ee28d81c675445accc2f11ac40a4ac3a4`. 이전 릴리스 경로도 같은 디렉터리에 보존.
- 로컬 검증: 백엔드 테스트 91개(실패/건너뜀 0)와 bootJar, 타입/변경 파일 ESLint, 프론트 전파·서명 테스트 13개 통과. 최신 코드의 격리 브라우저에서 초안 수정 SSE/누락 polling/종료 후 수정/재입장/참여자·미참여자 서명 분기 통과.
- GitHub Actions에서 standalone 프론트와 백엔드를 다시 빌드한 후 배포한다. APK 네이티브 변경·재빌드 없음. 운영 성공은 Actions 결과, release 경로, readiness, V035/V036 성공을 별도로 확인한다.

## 2026-10-01 배포 범위와 제외 사항

- 사용자 요청: 현재 미커밋 변경 전체를 커밋·push하고 프론트/백엔드를 함께 운영 반영한다.
- 대상: TBM 실시간 전송, 종료 후 편집 가능한 요약, 수신 요약 표시, 발송 관리자 질문 연결, 라이브 용어집 보완, 임시 근로자 가입/잠금 화면 및 기존 승인 기반 정식 전환.
- 로컬 더미 전환 도구는 소스와 함께 보관하지만 `enrollmentSandbox` 소스셋은 운영 bootJar에 포함되지 않는다. Docker 테스트 데이터/환경파일/키/로컬 산출물은 커밋 및 배포하지 않는다.
- 운영 즉시 정식 전환, 임시 근로자 재로그인, 근무지 자동 변경, 현장별 임시가입 초대는 미완료. 즉시 전환 체험은 127.0.0.1:3100 전용이며 운영은 관리자 승인 방식이다. 임시가입은 설정된 sponsor의 테스트 현장 연결 방식이 유지된다.
- APK 네이티브 코드 변경 없음. APK 재빌드가 아닌 운영 웹/API 배포이며, 기존 APK 파일은 그대로 유지한다.

## 비밀값 관리 기준

### 2026-10-02 TBM 종료·요약·서명 배포

- 사용자 승인: TBM 연속 흐름 수정분을 프론트/백엔드 함께 배포하고 변경 전후를 안내한다.
- 변경 전: 종료 후 요약은 작성 화면에 생성되지만 최종 전파는 별도이며, 근로자 화면의 새 공지 수신/서명 청취 조건이 라이브 종료와 연결되지 않았다.
- 변경 후: 종료 시 마지막 STT 큐 처리 후 서버가 원문과 요약을 별도 저장하고 자동 전파한다. 근로자는 같은 방송 ID의 요약을 같은 화면에서 번역·확인하고 직접 서명한다. 전체 음성을 다시 듣는 단계는 라이브 참석 연속 흐름에서 제외한다.
- 기존 일반 공지 청취 조건, 현장/발송자 권한, 임시 근로자 제한, 서명 저장소 유지. 새 마이그레이션/키/공급자/APK 변경 없음.
- 배포 전 확인: 최근 15분 이내 활동한 활성 방송 0건, 기존 release `d3fd23f15bfb2d333084d3c9a4a66fef4d6e5c18`, 두 서비스 active.
- 로컬 검증: 백엔드 88개 통과(건너뜀 0), 프론트 11개 테스트 통과, 타입/ESLint 검사 통과. 중국어 근로자 화면에서 요약 이벤트 유실 polling 복구·번역 실패 후 재시도·확인 및 서명 브라우저 검사 통과.
- 배포용 standalone 패키징은 GitHub Actions의 깨끗한 체크아웃에서 재검증한다. 성공한 빌드만 운영에 전송한다. 성공 여부는 해당 커밋의 Actions 실행과 운영 `current` release, readiness로 확인한다.

### GitHub Actions Secrets

GitHub 저장소 **Settings → Secrets and variables → Actions → Secrets**에 아래 세 값만 넣는다.

| 이름 | 용도 | 비고 |
|---|---|---|
| `SAFE_LINK_DEPLOY_HOST` | 운영 서버 host 또는 IP | 배포 설정을 한곳에 두기 위해 Secret으로 관리 |
| `SAFE_LINK_DEPLOY_USER` | SSH 배포 계정 | `safelink-deploy` 전용 제한 계정 |
| `SAFE_LINK_DEPLOY_SSH_PRIVATE_KEY` | GitHub Actions 전용 SSH 개인키 | 개인 개발자 PEM 키를 재사용하지 않는다 |

`SAFE_LINK_DEPLOY_SSH_PRIVATE_KEY`는 GitHub Actions 전용으로 새로 발급한다. 공개키만 운영 서버의 `safelink-deploy` 계정 `authorized_keys`에 등록한다. 이 계정은 release 활성화 명령만 `sudo`로 실행할 수 있으며 임의 관리자 명령은 실행할 수 없다. 이 키는 Actions 외에는 사용하지 않고, 유출 또는 담당자 변경 시 즉시 폐기·교체한다.

### 운영 서버 환경파일

아래 값은 GitHub Actions Secret에 넣거나 Git에 커밋하지 않는다. 운영 서버의 `/etc/safelink/v3-backend.env`에서 유지하고 파일 권한은 root만 읽을 수 있게 한다. 장기적으로는 AWS Secrets Manager, 1Password Secrets Automation, Vault 등 Secret Manager로 이전한다.

- `DB_PASSWORD`, `REDIS_PASSWORD`
- `SAFE_LINK_STORAGE_ACCESS_KEY`, `SAFE_LINK_STORAGE_SECRET_KEY`
- `GOOGLE_CLOUD_API_KEY`, `NAVER_CLIENT_SECRET`, `OPENAI_API_KEY`
- `SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD`, bootstrap token류

`.gitignore`는 `.env*`, `*.pem`, Android/iOS keystore와 local credential 파일을 이미 제외한다. Cloudflare Worker를 계속 쓰는 레거시 경로의 secret은 Cloudflare Dashboard Secret으로 유지하며, V3 Spring Boot 운영 비밀값의 저장소가 아니다.

## 최초 1회 서버 준비

1. 이 저장소의 `scripts/deploy/install-server-ci-deploy.sh`와 `scripts/deploy/activate-release.sh`를 서버에 복사한다.
2. 서버에서 `sudo bash install-server-ci-deploy.sh`를 한 번 실행해 제한된 `safelink-deploy` 계정을 만든다.
3. GitHub Actions 전용 ED25519 키 쌍을 발급한다.
4. 공개키를 `/home/safelink-deploy/.ssh/authorized_keys`에 추가한다.
5. 위 세 GitHub Actions Secret을 등록한다.
6. 대상 브랜치를 push한 뒤 GitHub Actions에서 `Deploy SQ Link V3 production`을 수동 실행한다.

설치 스크립트는 서비스가 immutable release의 `current` 링크를 실행하도록 바꾸고, GitHub Actions 전용 `safelink-deploy` 계정에는 `/usr/local/sbin/safelink-v3-activate-release <git-sha>`만 비밀번호 없이 실행할 권한을 부여한다. 임의 `sudo` 권한을 주지 않는다.

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

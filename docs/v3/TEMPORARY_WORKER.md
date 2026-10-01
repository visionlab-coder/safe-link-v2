# 임시 근로자 — 2026-09-28 구현 상태

## 2026-10-01 격리된 즉시 전환 체험 환경

- 사용자 승인: 운영과 분리한 로컬 DB에 더미 정보를 준비하여 임시→정식 전환을 직접 테스트한다. 운영 DB/릴리스/권한 정책 수정 및 배포는 하지 않았다.
- 접속: `http://127.0.0.1:3100/auth/temporary?lang=ko`. 기존 localhost:3000은 운영 API 연결을 유지한다. 혼동 방지를 위해 모든 테스트 화면에 노란 배너가 표시된다.
- 테스트용 PostgreSQL(55439), Redis(56389), 백엔드(18081), 프론트(3100)는 127.0.0.1에만 바인딩. DB 이름 `sq_enrollment_sandbox`, 데이터 볼륨 `sq-enrollment-sandbox_enrollment-db`. 운영 데이터/키는 복사하지 않는다. AI vendor 호출은 비활성화되어 있어 음성 품질/실제 방송 테스트 환경은 아니다.
- 더미 1: 이름 `테스트근로자1`, 전화 `01000009001`, 현장 `로컬 가입 테스트 현장`, 홍채 ID `99001001`. 더미 2는 각 끝자리만 2로 바꾸면 된다. 1~6번은 사용자 직접 가입용으로 비워두었다. 7·8번은 검증 중 정식 전환, 9번은 임시 상태로 남았다.
- 가입→임시 홈 잠금 확인→상단 정식 근로자 전환 링크→같은 이름/전화+테스트 현장/홍채 ID+동의→전환 완료→근로자 화면 이동. 전환 후 안내된 로그인 ID와 전화 뒤 4자리로 재로그인한다. 임시 상태에서의 재로그인 미완료 사항은 그대로이며, 가입 후 로그아웃하지 않고 전환까지 진행한다.
- 구현: Gradle `enrollmentSandbox` 소스셋에만 포함한 `EnrollmentSandboxUpgradeService`. 운영 `main`/`bootJar`에는 포함되지 않음. 정확한 로컬 DB URL/DB 이름/Redis/바인딩 검사 후 더미 계약을 seed하며 서버 재시작 시 데이터 삭제 없음.
- 임의 입력 승격이 아니라 로그인한 계정의 이름/전화와 서버에 준비된 더미 계약의 이름/전화/현장/홍채 ID가 일치할 때만 자동으로 더미 관리자의 기존 승인 트랜잭션을 실행한다. 별도 `sandbox.fixture.auto_transition` 감사 로그를 기록한다. 실제 하이정보 검증이나 운영 즉시 전환 구현을 완료한 것으로 간주하지 않는다.
- 실제 브라우저에서 더미8 임시 가입과 전환 완료 표시를 확인. `tests/enrollment-sandbox-smoke.mjs`로 더미7 동의 누락/다른 홍채/이름/전화/현장 거부, TEMP chat 403, 같은 user ID의 WORKER 전환 및 chat 200, 중복 전환 거부 확인. 스모크는 기존 검증 계정을 지우지 않으므로 동일 슬롯 재실행 시 중복 가입으로 실패한다.
- 검증: WorkerUpgradeTest/TemporaryWorkerTest 통과, TypeScript/수정 TS 파일 ESLint 통과, 운영 bootJar에 sandbox 클래스 미포함 확인.

재실행(프로젝트 루트, 서로 다른 터미널에서):
```bash
docker compose -f backend/compose.enrollment-sandbox.yml up -d
node scripts/enrollment-sandbox.mjs backend
node scripts/enrollment-sandbox.mjs frontend
```
종료는 각 터미널 Ctrl+C 후 `docker compose -f backend/compose.enrollment-sandbox.yml stop`. 볼륨은 보존되며 삭제/초기화는 자동으로 하지 않는다.

## 목표 및 범위
- 후속 발주처 확인: 관리자 대리 등록은 유지, 기존 등록자는 유지, 신규 직접 가입자는 임시→정식 전환. `/auth` 근로자 로그인 화면에 가입 버튼 연결. 사용자가 API 제공 전 관리자 확인·승인 방식을 승인하여 아래 정식 전환 기능 추가.
- 사용자 승인: 임시 근로자는 라이브 통역만 이용. 나머지 기능 잠금. 개인정보 동의 필수.
- 테스트 현장: 운영 DB 읽기 조회로 seann3113@gmail.com(user 1449)의 유일한 ACTIVE 소속이 site 2, QA 자동검증 현장 20260724임을 확인. 기존 계정/현장 데이터 변경 없음.
- TEMP_WORKER 역할을 Spring/DB/프런트 계약에 추가. 정식 WORKER 역할은 함께 부여하지 않음.

## 구현
- 가입 주소 `/auth/temporary`, 전용 홈 `/worker/temporary`, 라이브 `/worker/live`.
- 이름/전화/통역 언어/필수 동의. 동의 버전과 시각을 DB에 저장.
- 현장은 서버 sponsor-email의 유일한 활성 소속을 조회해 결정. 다중/미연결은 실패 처리. 클라이언트 site/role 입력은 사용하지 않음.
- 인증된 임시 사용자 API는 allowlist 방식 차단. TBM, 서명, 채팅, 파일, 관리자, 프로필 변경 차단. live 및 필요한 번역/STT/TTS와 로그아웃만 허용.
- 라이브 발언은 해당 현장에 활성 방송이 있는 관리자 대상으로만 허용.
- 기존 전화번호를 입력해 기존 사용자를 인증하거나 승격하지 않음. 중복 가입은 실패.
- CSRF 유지, 가입 횟수 Redis 제한, HttpOnly 기존 세션 및 세션 ID 회전 사용.

## 2026-09-28 정식 전환 후속 구현
- 사용자 승인에 따라 API 연동 전에는 현장 관리자가 근로계약 정보를 대조·승인한다. 하이정보 API 연동은 아직 하지 않음.
- 근로자 `/worker/upgrade`: 이름·전화·현장·숫자 홍채 ID·필수 개인정보 동의 → PENDING. 신청만으로 역할/현장 권한은 변경하지 않음.
- 관리자 `/admin/workers/upgrades`: ROOT/HQ_ADMIN 또는 해당 현장 SITE_ADMIN만 조회/승인/반려 가능. 계약 확인 체크는 서버에서도 필수. 반려 시 사유 입력, 근로자는 수정 재신청 가능.
- 승인 트랜잭션: 같은 user_id의 TEMP_WORKER 역할 회수, WORKER 부여, 임시 소속 회수 및 확인된 대상 현장 WORKER 소속 연결. 기존 정식 근로자/관리자 대리 등록 경로는 변경하지 않음.
- 홍채 ID는 문자열로 저장하여 앞자리 0 보존. 승인된 번호 중복 방지. 원본 번호/전화는 감사 로그에 기록하지 않음. 동의 버전·시각, 승인자·시각·검증 방식은 기록.
- 사용자 행 잠금 및 상태 재검증으로 동시 승인/반려/재신청 경합을 제어. 다른 현장으로 재신청된 경우 결정 직전 현장 권한 재검증. 무효 현장·정식 계정 재신청·미확인 승인 차단.
- 신청 revision을 관리자 결정 요청과 대조하여 반려 후 재신청된 내용을 예전 확인 체크로 승인하지 못하게 함.
- 승인된 계정은 기존 근로자 로그인과 호환되는 고유 로그인 이니셜(`W`+사용자ID의 36진수) 발급. 승인 결과에서 안내하며 전화번호 뒤 4자리로 기존 로그인 가능. 임시 상태의 재로그인은 아래 미완료 사항 유지.
- V034 migration 필요. 별도 재가입/기존 계정 일괄 변환/자동 승인 없음. 향후 API 검증도 동일 상태 전환 및 감사 기준을 지켜야 함.

## 아직 운영 출시 전 필요한 작업
- 현재는 신규 가입 직후의 서버 세션 사용만 구현. 로그아웃/세션 만료 후 재인증(휴대전화 인증 또는 기기 인증) 방식은 미구현. 이름+전화만으로 기존 계정에 재로그인하는 우회는 만들지 않음.
- 가입/잠금 화면은 한국어 초안. 지원 언어별 UI 번역 및 운영 개인정보 안내(보유 기간 포함) 확정 필요.
- 현장별 서명된 QR 초대 발급은 미구현. 현재 테스트 가입 URL은 승인된 단일 테스트 현장용.
- 로컬 프런트는 운영 API를 참조한다. 아래 후속 배포로 V033/V034 및 백엔드 반영 완료. 운영 프런트 배포는 별도이며 현재 새 화면은 로컬 개발 서버에서 확인한다.

## 검증
- TemporaryWorkerTest: 필수 동의 및 버전, 이름/전화 형식, API allowlist.
- TypeScript noEmit 검사 통과.
- 전체 백엔드 테스트 및 추가 화면 ESLint 검사 통과. 정식 근로자 API 접근은 유지하고 임시 근로자만 차단하는 필터 테스트 포함.
- DB migration 및 실제 가입→세션→라이브 E2E는 별도 검증 필요. 구현 전체 완료/운영 사용 가능으로 보고하지 않음.
- 후속 WorkerUpgradeTest 및 WorkerUpgradeDatabaseTest 추가. 격리 PostgreSQL에서 신청 시 권한 유지, 확인 체크 필수, 승인 및 소속 전환, 반려·재신청, 이전 revision 차단, 타 현장/비활성 현장 차단, 전화번호/홍채 번호 중복 시 트랜잭션 전체 롤백 검증.
- Docker 29 로컬 테스트는 구버전 Testcontainers 호환을 위해 실행에 한해 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44`와 `DOCKER_HOST=unix:///Users/sieon/.docker/run/docker.sock` 지정. 운영 환경 설정은 변경하지 않음.

## 2026-09-28 운영 백엔드·DB 반영
- 사용자 명시 요청으로 운영 백업(safelink-v3-backup.service Result=success, ExecMainStatus=0) 후 배포.
- 릴리스: `manual-temporary-worker-20260928`. 이전 `manual-tbm-summary-bullets-20260928` 보존, 프런트 산출물은 이전 릴리스 그대로 유지. 백엔드만 재시작.
- JAR SHA256: `271e68f0c47bff8fb639f78ac0ec004b1651946384826f5c764d9042f6745a61`.
- Flyway V033 temporary worker, V034 worker upgrade requests success=true 확인. 외부 API readiness UP 확인.
- 로컬 3000 `/api/auth/temporary-worker`에 동의 누락 요청을 보내 HTTP 400 `privacy_consent_required` 확인: Next BFF→운영 신규 API 연결 정상. 검증용 운영 계정은 생성하지 않음.
- 로컬 가입 화면은 서버 오류/동의 누락/번호 형식/등록 불가 등의 응답을 구분하여 표시하도록 수정. 타입·ESLint 통과.
- 실제 신규 가입 성공부터 라이브 수신까지 사용자 단말 E2E 검증은 아직 별도. 위 기존 미완료 항목(임시 상태 재인증, 다국어/개인정보 안내 확정)은 이번 배포로 해결됐다고 간주하지 않음.

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

### 2026-10-19 공종 선택·프리토크 배포 준비

- 사용자 요청으로 공종 복수 선택과 프리토크 버튼 단위 음성 전송을 함께 배포한다. 프론트·백엔드·V042를 동일 릴리스로 반영하며 공종 단위 동시 방송은 포함하지 않는다.
- 배포 직전 운영 활성 방송 0건을 확인했다. `safelink-v3-backup.service` 성공 및 `safelink-20261019T045834Z.dump`/동일 시각 객체 백업 완료를 확인했다.
- 배포 전 회귀 단위 검사 23건 통과. CI에서 프론트 production build와 백엔드 전체 테스트/bootJar를 다시 실행한다. 아래 개별 기능 검증은 로컬 검증이며 운영 반영 완료 여부는 배포 실행 결과로 판단한다.
- 직전 운영 릴리스는 `5b963c60b37dcc028f30b3dd8436acfb5efc564b`. 실패 시 이전 실행본으로 복귀하고 V042의 추가 컬럼/저장 데이터는 보존한다. 배포 후 readiness, 두 서비스, 실행 SHA와 V042 적용을 확인한다.

### 2026-10-19 프리토크 버튼 단위 음성 메시지

- 폰 하나로 대화/일반 대화는 마이크 시작부터 사용자가 종료할 때까지 STT 결과를 모으고, 마지막 녹음 조각과 진행 중인 인식 요청까지 기다린 뒤 한 번만 번역·전송한다. 중간 침묵으로 메시지를 보내지 않는다.
- 유료 음성 API의 길이 제한과 기존 비용 통제를 유지하기 위해 내부 STT 청크 처리는 그대로 두고 UI 메시지 경계만 바꾼다. 공통 `useCloudSTT`, TBM, 별도 동시통역 모드의 실시간 전송 방식은 변경하지 않는다. 백엔드 계약/DB 변경은 필요 없다.
- 처리 중 중복 클릭/텍스트 전송을 막고, 화자 전환 전에 이전 화자의 인식·전송을 완료하여 언어가 섞이지 않게 한다. 서버의 2,000자 전송 제한을 넘는 경우 원문을 입력창에 보존하고 편집을 안내한다.
- 검증: TypeScript, 변경 파일 ESLint, `tests/free-talk.cjs`, `tests/free-talk-audio.cjs`, `tests/free-talk-voice-turn-browser.mjs`. 브라우저 검사는 합성 음성과 모의 유료 API로 침묵 뒤 녹음 유지, 문장별 미전송, 종료 시 마지막 조각 포함 일괄 전송, 연속 클릭 잠금, 상대 언어 전환을 검사한다. 실제 휴대폰 마이크/STT 정확도 검증과 구분한다.

### 2026-10-19 TBM 공종 복수 선택

- 사용자 지정 16개 공종을 TBM 작성 화면의 전파 대상 위에서 복수 선택한다. `거푸집`과 `거푸집-형틀` 등 유사 이름도 요청대로 별개로 유지한다. 공종은 사용자 역할/현장 소속이 아닌 TBM의 메타데이터다.
- V042는 `tbm_notices`, `live_broadcast_sessions`에 `trade_types` JSON 배열을 추가한다. 기존 자료/구버전 요청은 빈 배열로 호환하며 임의 공종을 붙이지 않는다. API는 16개 허용값만 받고 중복 값을 제거한다.
- 일반 전파는 선택값을 저장한다. 라이브는 시작 시 선택값을 고정하고 최종 전파 시 서버가 저장된 세션에서 가져온다. 전국 방송도 각 현장별 세션/최종 TBM에 같은 공종을 전달한다. 재시도는 기존 문서와 공종을 덮어쓰지 않는다.
- 관리자 이력/서명 현황, 근로자 수신/라이브 화면에 공종을 표시한다. 원문·요약·음성 내용에는 공종 설명을 삽입하지 않는다. 기존 현장 접근 권한, 전국 전파 권한, 임시 근로자의 전파 차단은 유지한다.
- 이번 범위의 ‘중복 체크’는 복수 선택이다. 공종별 동시 방송/참여 방 선택/대상자 필터 기능은 포함하지 않으며 기존 현장별 방송 충돌 방지는 그대로다.
- 실행본 반영은 프론트/백엔드/V042를 함께 진행한다. 롤백 시 추가 컬럼을 삭제하지 않고 이전 앱이 무시하게 두어 저장된 공종을 보존한다.
- 검증: `TbmTradesTest`, `LiveTbmCompletionDatabaseTest`, `NationwideTbmDatabaseTest`, `tests/tbm-trades.cjs`, `tests/tbm-live-broadcast.cjs`, TypeScript/ESLint. `node scripts/test-tbm-trades-local.mjs`는 루프백 웹/API/테스트 DB만 사용해 모바일 복수 선택→일반 전파→이력/수신→라이브→최종 요약 표시를 검증하고 해당 실행의 fixture만 정리한다.
- 2026-10-19 검증 결과: 백엔드 183건 중 181건 통과, 외부 DeepL 실호출 2건은 설정에 따라 제외. 프론트 단위 회귀 21건, TypeScript/ESLint, 실제 경로의 Next production 빌드 통과. 로컬 API/DB를 연결한 공종 브라우저 검사와 기존 일반/라이브 TBM·서명 회귀 검사를 모두 통과했다. 운영 배포는 아직 하지 않았다.

### 2026-10-19 TBM 5분 무활동 자동 종료

- 사용자 요청: TBM 시작 후 마지막 발화 감지·텍스트 전송·실제 초안 변경부터 5분간 활동이 없으면 서버가 종료한다. 브라우저의 단순 접속·상태 조회·동일 초안 재전송은 연장하지 않는다. 소음이 발화로 감지되는 경우는 무활동으로 판정되지 않을 수 있다.
- V041 `last_activity_at`와 실제 전송/변경 트리거, 발화 감지 API 갱신을 사용한다. 서버 스케줄러가 15초마다 검사하므로 5분 경과 후 보통 15초 이내 종료된다. 일반 라이브/1:1은 변경하지 않고 `tbm_` 세션만 처리한다.
- 전국 TBM은 어느 자식 현장에든 최근 활동이 있으면 전체를 유지하고, 모두 유휴이면 부모 STOPPED와 자식 종료를 한 트랜잭션으로 처리한다. 시작 잠금 및 부모→현장 순서 잠금으로 전파·수동 종료와 경합을 제어한다. 자동 종료 감사 기록과 커밋 후 SSE를 남긴다.
- 관리자 5초/근로자 3초 상태 확인으로 이벤트 누락을 복구한다. 자동 종료 뒤 마이크를 정리하고 초안·원문·참여 기록을 보존하며 최종 전파를 자동 실행하지 않는다. 요약 검토 후 기존 전파 경로를 유지한다.
- 검증: `NationwideTbmDatabaseTest`의 무활동·활동 연장·전국 원자 종료·종료 후 전파·권한·재시작·반복 실행 검사, `tests/tbm-live-broadcast.cjs`, TypeScript. 운영 정리: 사용자 승인으로 10/14 sk.park 전국 TBM 1건/38개 자식만 종료, 데이터 삭제 없음, 감사 로그 보존.

### 2026-10-15 TBM 최근 발송 이력 복원

- 사용자 요청에 따라 관리자 TBM 작성 화면은 날짜 제한 없이 최신 10건을 표시한다. `/api/v1/tbm/compat/notices`의 `date` 생략/빈 값은 전체 기간 조회이며, 명시한 날짜는 기존 한국 시간 하루 범위를 유지한다.
- 정렬은 V2와 동일하게 생성 시각 내림차순이며 같은 시각은 ID 내림차순이다. 현장 선택/소속 검증, 조회 상한, 기기별 이력 숨기기, 날짜 지정 현황 및 페이지 API는 변경하지 않는다. 데이터 삭제·이관·스키마 변경은 없다.
- 검증: `TbmRecentHistoryTest`, `NationwideTbmDatabaseTest.recentHistorySpansDatesKeepsLatestTenAndSiteIsolation`, `node --test tests/tbm-admin-publication.cjs`. 별도 PostgreSQL 컨테이너에서 13건으로 과거 기록 포함·최신 10건·현장 격리·날짜 지정·원본 보존을 확인한다.

### 2026-10-15 프로필 설정 다국어

- `/auth/setup`의 표시 문구와 언어 선택은 `useDisplayLanguage` 하나를 기준으로 한다. 이전 URL의 `lang`이 마지막 선택 언어를 덮어쓰지 않도록 한다.
- `src/lib/profile-setup-{base,ui}.ts`에서 20개 언어의 역할·입력 안내·현장 선택·자동 로그인·탈퇴·오류 문구를 관리한다. 일본어/필리핀어 별칭도 지원한다.
- 공종의 알려진 선택값은 화면에서만 번역하며, 저장용 한국어 식별값과 자유 입력 내용은 유지한다. 현장명·사용자명 데이터는 자동 변경하지 않는다.
- 모바일 단계 전환 중 포커스가 바깥 컨테이너를 가로 스크롤하지 않도록 배경 장식의 잘라내기는 `overflow-clip`을 사용한다. 영어·베트남어·일본어·아랍어에서 카드 위치 및 화면 캡처를 확인한다.
- 역할·소속 권한, DB 스키마, 프로필 API 계약은 변경하지 않았다. 기존 `preferred_lang` 전달 경로를 사용한다.
- 회귀 검사: `node --test tests/profile-setup-i18n.test.cjs`, `node scripts/test-profile-setup-i18n.mjs`, TypeScript 및 변경 파일 ESLint. 브라우저 테스트는 루프백 서버와 모의 API만 사용하며 운영 계정을 수정하지 않는다. 20개 언어의 근로자/관리자 단계, 저장 요청 언어, 오류 안내, 공통 언어 이벤트, 새로고침을 확인한다.

### 2026-10-14 간편가입 및 즉시 전환 (아래 과거 승인 정책보다 우선)

- 생년월일이 등록된 신규 계정만 이번 명시 승인된 즉시 전환을 사용한다. 생년월일 미등록 기존 계정의 로그인·전환 정책은 유지한다. 그룹웨어 검증 우회 플래그가 아니라 신규 가입 정책의 변경이다.
- 테스트용 별도 worktree의 `scripts/worker-login-local.compose.yml`을 `docker compose -p sq-worker-login -f scripts/worker-login-local.compose.yml up -d`로 실행한다. `./gradlew bootJar` 후 `node scripts/worker-login-local.mjs backend` / `frontend`를 사용한다. DB는 55441, Redis 56391, API 18084, 웹 3000의 루프백 전용이다.
- `scripts/worker-login-local-seed.sql`은 DB 이름이 `worker_login_test`일 때만 실행 가능하다. 운영 데이터/비밀값을 복사하지 않으며 별도 승인 우회 컨트롤러도 사용하지 않는다. 다국어 현장명 일부는 명시적 로컬 fixture이고 외부 번역 공급자 실증과 구분한다.
- 브라우저 회귀: `node scripts/test-worker-login-browser.mjs`. 매번 로컬 테스트 사용자 1명과 동의/전환 이력을 추가한다. 테스트 산출물: `outputs/worker-login-qa/`.
- 운영 배포 시 프론트/백엔드/V040을 함께 적용한다. 보류된 직원 역할 V038/V039는 번들링하지 않는다. 이후 해당 기능 배포 시 미배포 migration 버전을 V040보다 높게 다시 배정해야 한다. 운영 V040 적용 전에는 이 작업본 프론트를 운영 API에 연결하지 않는다.

### 2026-10-01 임시→정식 전환 격리 테스트

- 더미 즉시 전환은 `backend/src/enrollmentSandbox`의 별도 Gradle 소스셋에서만 실행한다. 운영 승인 절차를 끄는 플래그나 공개 우회 API를 추가하지 않는다.
- 테스트 코드/더미 데이터는 운영 JAR·DB에 포함하지 않는다. 실행 방법과 고정 루프백 포트, 검증 범위는 `TEMPORARY_WORKER.md`의 2026-10-01 절을 따른다.
- 3100 테스트 프론트는 별도 `.next-enrollment` 산출물을 사용한다. 3000 서버의 `.env.local`을 수정하거나 테스트 목적으로 운영 계정을 생성하지 않는다.

### 2026-10-01 프론트·백엔드 연동 기능 완료 기준

- 사용자 요청: 프론트 화면만 바꾸고 필요한 백엔드 실행본 반영을 빠뜨리지 않는다. 코드 수정, 실행 환경 연결, 실제 API 응답, 화면 연결까지 한 작업으로 확인한다.
- 로컬 화면이라고 로컬 백엔드를 쓴다고 가정하지 않는다. 시작할 때 API 대상이 로컬/운영 중 어디인지 비밀값 노출 없이 확인한다.
- 운영 반영이 필요한 경우 요청 범위와 운영 영향을 확인하고, 테스트·백업·롤백·배포 후 상태 점검을 함께 수행한다. 실행본 미반영 상태는 ‘사용 가능’으로 보고하지 않는다.
- TBM 질문 연결은 발송자 `created_by` / 현재 방송 `started_by`를 사용하며, 임의의 첫 관리자나 다른 현장 관리자로 대체하지 않는다.

### 2026-09-17 프로필 저장 및 작업 현장

- V030 `user_profile_details`에 직책·공종·연락처·현장 표시명·작업 현장 ID를 저장한다.
- 작업 현장 선택은 소속/권한 부여가 아니다. ROOT/HQ_ADMIN은 활성 현장, 그 외 역할은 기존 소속 현장만 선택할 수 있다. 역할은 기존 승인 흐름만 변경한다.
- `/auth/me`의 `profileDetails.activeSiteId`는 조회 시 권한과 현장 활성 상태를 재검증한다. `siteIds`는 기존 소속 목록을 유지한다.
- Next.js compatibility profile의 `site_id`, STT/TTS/vision은 검증된 작업 현장을 우선 사용하며, 실제 API 실행 시 Spring SiteGuard가 다시 검증한다.
- 로그인 호환 요청의 빈 필드는 기존 프로필을 지우지 않는다. 이전 감사 로그의 선택값은 일괄 자동 복원하지 않는다. 사용자 승인 시 계정·마지막 명시적 현장 선택·현장 활성 상태를 검증하고 해당 계정의 작업 현장만 감사 로그와 함께 복원한다. 역할과 소속 권한은 변경하지 않는다.
- 프런트와 V030 적용 백엔드를 함께 반영해야 한다. 검증: AuthServiceTest(본사 선택/현장 범위 차단/권한 유지/비활성 현장 차단), 전체 Gradle 테스트, ESLint.

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

2026-09-28 사용자 요청으로 `TEMP_WORKER` 역할 추가. 가입·권한 차단 및 미완료 운영 검증 범위는 [TEMPORARY_WORKER.md](TEMPORARY_WORKER.md) 참고. 정식 WORKER 권한을 함께 부여하지 않는다.

정식 전환은 사용자 승인에 따라 `worker_upgrade_requests`의 신청/동의 기록과 현장 관리자의 계약 확인을 거친다. 요청 본문의 현장/홍채 ID만으로 권한을 부여하지 않으며, 승인 시 사용자 잠금·신청 revision·승인자 현장 권한 재검증 후 같은 계정을 트랜잭션으로 전환한다. 기존 정식 계정과 관리자 등록 흐름은 유지한다.

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
SAFE_LINK_ROOT_BOOTSTRAP_PASSWORD=<10자 이상 비밀번호>
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

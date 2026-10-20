# SQ Link V3 GitHub Actions 운영 배포

## 2026-10-20 근로자 오늘 공종 선택 배포 준비

- 사용자 승인: 근로자가 매일 최초 접속 시 오늘 공종을 선택하고, 해당 공종 및 현장 공통 TBM을 우선 확인한다. 복수 선택·당일 변경·기타 공종 별도 조회를 지원하며 기존 로그인과 임시 근로자 제한을 유지한다.
- 기준 release/원격 HEAD: `b4624c7f9d08af2fe88538ff2eda646a7f246689`. 사전 운영 확인: 두 서비스 active, 활성 방송 0건, `safelink-v3-backup.service` Result=success / ExecMainStatus=0.
- V044는 근로자·현장·KST 날짜별 선택을 저장하는 별도 테이블만 추가한다. 기존 TBM·서명·역할·현장 배정은 수정하지 않으며 V043 기존 알림 숨김 스크립트는 재실행하지 않는다. 이전 앱으로 롤백하더라도 추가 테이블과 선택 기록은 보존한다.
- 로컬 검증: 백엔드 193건 중 191건 통과/외부 DeepL 실호출 2건 제외, TypeScript/ESLint, 공종 교집합·KST 날짜·20개 언어 단위 검사, 실제 로컬 API 저장·현장 권한 및 브라우저 선택·날짜 변경·라이브 종료/서명 회귀 확인. 운영 실사용 계정으로 시험 발송·서명은 생성하지 않는다.
- Actions에서 프론트 빌드와 백엔드 테스트를 재실행한 뒤 실제 release SHA, V044, readiness, 인증 경로를 확인한다. 공종별 복수 동시 라이브 세션 구조 변경은 이번 범위에 포함하지 않는다.

## 목적

GitHub Actions의 `Deploy SQ Link V3 production` workflow는 `refactor/v3-commercialization-20260710` 브랜치 push 또는 수동 실행으로 frontend와 backend를 테스트·빌드하고 운영 서버에 불변 release로 배포한다. 이 브랜치에 push하기 전 운영 배포 권한과 백업 상태를 확인한다. 배포 중에는 release 디렉터리를 새로 만들고 `current` 심볼릭 링크만 교체하므로, 실패한 빌드를 현재 운영 파일 위에 덮어쓰지 않는다.

## 2026-10-20 기존 알림 숨김·당일 알림 운영 반영

- 완료: `b4624c7f9d08af2fe88538ff2eda646a7f246689`, Actions `39383672608` 성공. 운영 V043 성공, readiness UP, `/auth` HTTP 200 확인. 일회성 SQL로 기존 237건 숨김 및 건별 감사 237건 생성, 남은 표시 대상/활성 TBM 모두 0건 확인.
- 원문 237건의 숨김 컬럼 제외 체크섬과 서명 61건 체크섬이 작업 전후 동일하다. 로컬 백엔드 191건 중 189건 통과/외부 DeepL 실호출 2건 제외, 실패 0건. 신규 발송 표시·숨김 복구·관리자 이력·직접 조회·서명 보존 회귀 통과. 실사용자 계정으로 운영 시험 발송/서명은 생성하지 않았다.
- 사용자 승인: 모든 현장 기존 TBM 홈 알림을 숨기고 신규 발송은 정상 표시한다. 앞서 승인한 KST 당일 미서명 조회를 함께 반영한다. 원문·서명·관리자 최근 10건·권한은 유지한다.
- 운영 기준 release는 `8ec6056dbe211091daff6df292f0f2b445845dca`. 운영 DB 확인 기준은 `2026-10-20 06:57:22.579613+00`, 발송 237건/최대 ID 1379/서명 61건/활성 TBM 0건이다. `safelink-v3-backup.service` Result=success, ExecMainStatus=0 확인.
- V043은 NULL 기본값의 표시 전용 컬럼만 추가한다. 새 버전 활성화 후 별도 `scripts/hide-existing-tbm-notifications-20261020.sql`을 실행해야 기존 알림이 숨겨진다. 배포 중 새로 발송된 TBM은 대상에 포함하지 않는다. 숨김 적용 건별 감사 기록을 보존한다.
- 앱 롤백은 추가 컬럼을 보존하되 구버전에서 숨김을 무시할 수 있으므로 주의한다. 숨김 자체 복구는 사용자 승인 후 해당 감사 ID의 표시 컬럼만 NULL로 돌린다. 내용/서명을 삭제하지 않는다.

## 2026-10-20 TBM 개별 알림·프리토크 20개 언어 배포 준비

- 사용자 승인으로 TBM 미서명 개별 알림/1~3열 배치/공종 20개 언어 표시와 앞서 요청한 프리토크 20개 언어 확장을 프론트·백엔드 함께 배포한다. 관리자 권한 개편, 공종별 동시 라이브 생성, DB migration, 공급자/키 변경, 운영 계정·서명 데이터 변경은 제외한다.
- 기준 SHA: `6b630b03066c417ca8b2c54292bce3fccfddf900`. 원격 브랜치, 직전 성공 Actions `39202249842`, 운영 current 링크가 일치한다. 운영 두 서비스 active, readiness UP, 활성 방송 0건을 확인했다.
- 사전 백업: 기존 `safelink-v3-backup.service` 성공(2026-10-20 06:25:00 UTC). DB·객체 저장소 백업 manifest: `safelink-20261020T062458Z.manifest`. 이전 실행본은 롤백 후보로 유지한다.
- 로컬 검증: 백엔드 188건 중 186건 통과/외부 DeepL 실호출 2건 제외, TypeScript/ESLint, 기존 TBM·프리토크 회귀, 320/390/1280px 알림 1~9개 배치 및 16개 공종×20개 언어 브라우저 검사. 실제 휴대폰 음성 정확도 시험과 구분한다.
- Actions의 깨끗한 체크아웃에서 frontend build 및 backend test/bootJar를 다시 실행한다. 성공 후 활성화·readiness·인증 리다이렉트 및 실제 current SHA를 확인해야 운영 반영 완료로 판단한다. 기존 배포 절차에는 서비스 재시작이 포함된다.

## 2026-10-19 TBM 무활동 자동 종료 / 최근 이력 복원

- 사용자 요청: 10/14 sk.park 전국 방송 종료, 이후 TBM 5분 무활동 자동 종료. 앞서 요청한 날짜 제한 없는 최근 10건 복원도 포함한다. 보류된 관리자 권한/직원 분류는 제외한다.
- 운영 수동 정리: 정확한 전국 방송 ID `tbm_1791942812180_59ssck` 및 소유자 1463, 최근 5분 활동 없음, 자식 38개를 트랜잭션 내 확인하고 STOPPED 처리했다. 감사 기록을 남겼으며 원문·요약·서명 삭제는 없다. 이후 활성 방송 0건 확인.
- V041은 활동 시각 컬럼과 번역/초안 변경 트리거를 추가한다. 스케줄러는 TBM만 15초 주기로 확인하며 5분 유휴 전국 부모/현장 자식을 함께 종료한다. 이전 실행본으로 롤백 시 이 추가 스키마는 유지한다.
- 백업: `/home/ubuntu/safelink-v3/backups/tbm-idle-20261019-EA9s3V/database.dump` (10,234,300 bytes), `pg_restore --list` 성공, SHA256 `1272681947683d08abe51fbaf5437e7d591b649cc78132b13d3322d3e9f512ae`. 직전 운영 SHA `f0d43a2abf66f90f6fc9ed82757de8a921d9e2e6`.
- 검증: 백엔드 171개 중 169개 성공/2개 skip/실패 0, 프론트 단위 15개 성공, 타입·변경 파일 ESLint 성공. `scripts/test-tbm-idle-local.mjs`로 로컬 실제 DB/API/스케줄러와 무음 가상 마이크의 시작→종료→재시작 가능 상태 확인. `tests/tbm-live-handoff-browser.mjs`로 종료 SSE 누락·원문 보존·요약 검토·서명/미참여자 청취 조건 확인. 운영에 시험 방송/더미 계정은 생성하지 않는다.
- 완료는 해당 커밋의 Actions 성공, 실제 release SHA·V041·readiness·스케줄러 오류 없음 확인 후 판단한다.

## 2026-10-13 DeepL 전환 배포

- 사용자 승인: Flitto 제거 후 DeepL 음성인식·텍스트 번역 교체 및 운영 배포. 기존 TTS/요약 공급자는 유지하며 미지원 언어는 `AI_PROVIDER_COMPARISON_TEST.md`의 Google 경로를 사용한다.
- 현재 운영 서버는 `43.202.226.137`이다. `app.safe-link.co.kr`/`api.safe-link.co.kr` DNS, 운영 `current` SHA, 서비스 active를 함께 확인했다. 과거 문서의 `43.200.49.69`는 이전 테스트 서버이므로 운영 변경 대상으로 사용하지 않는다.
- 사용자가 제공한 키 디렉터리의 회사 서버 키로 정상 관리자 접속 확인. Actions 전용 키를 추출하거나 권한 제한을 우회하지 않는다. 개인키·DB 비밀번호·API 키 값은 문서/로그에 기록하지 않는다.
- 포함: DeepL Voice/Text 프론트·백엔드 연동, 공급자별 캐시, 언어별 Google 예외, 일반 문장 보존/복합용어 우선/전달용 단일 표제어를 적용하는 기존 용어집 수정 및 회귀 시험. 관리자·직원/가입/권한 개편, V038/V039, 소음감지 UI, APK는 제외한다.
- 기준 release: `0086c90d3c50aedaefbb078eb652d9bac38e1be9`. DB Flyway V037 성공. 최근 15분 시작 또는 번역 이벤트가 있는 활성 방송 0건 확인.
- 사전 백업: `/home/ubuntu/safelink-v3/backups/deepl-20261013-d0gl2yca` (root 전용)에 DB dump, 이전 release, 환경파일 보관. dump 10,141,878 bytes, SHA256 `4eb80e6e9c293c50dc9b02b7f769a93269b5b4958808aed4bf337e7d23ada00d`, pg_restore 목록 확인 성공.
- 운영 연결 시험: 서버에서 새 키의 DeepL 번역 응답 성공. 키는 root 전용 대기 환경파일에만 준비했으며 릴리스 전환 때 공급자 둘을 `deepl`로 설정한다. 실패 시 이전 release와 환경파일을 함께 복원한다.
- 검증: 운영 HEAD에 위 변경만 복사한 격리 소스의 Next production build(타입/린트 포함), AI/용어집 JUnit 및 bootJar, glossary 32쌍/940 부분문자열 방지, API 계약, 라이브 용어집, DeepL 라우팅 시험 통과. 외부 폰트 다운로드 오류는 임시 빌드 캐시를 분리해 재시도 후 성공했다. 전체 DB 시험은 Actions에서 재검증한다.
- DBeaver는 SSH tunnel을 사용한다. SSH host `43.202.226.137:22`, user `ubuntu`; DB host `localhost`, port `15432`, database/user `safelink`. 비밀번호는 운영 환경파일의 `DB_PASSWORD`를 안전하게 확인하며 공개 포트/방화벽/DB 계정을 추가하지 않는다.
- 완료 여부는 해당 SHA의 Actions 결과, 운영 release/서비스/readiness, 실제 서버 번역 공급자 응답을 확인한 뒤 갱신한다. 실제 현장 마이크·언어별 정확도 시험은 별도다.

## 2026-10-12 TBM 선택 언어 음성인식 배포

- 완료: `0086c90d3c50aedaefbb078eb652d9bac38e1be9`, Actions https://github.com/visionlab-coder/safe-link-v2/actions/runs/38228422594 성공. 사용자가 승인한 `seann3113` 계정으로 push했다. 2026-10-12 18:17 KST 운영 readiness `UP`, `/auth` 200, 비로그인 `/admin`→`/auth` 307 확인. 실제 휴대폰 마이크·인식 정확도는 별도 시험이 남아 있다. 로컬 빌드의 chunk hash는 CI와 달라 그 URL로 운영 JS 동일성은 검증하지 못했으며 배포 성공 근거는 해당 SHA의 릴리스 활성화/스모크 성공이다.

- 사용자 승인: 선택한 언어가 TBM STT에 전달되지 않는 문제의 수정분을 프론트/백엔드 함께 배포한다. 이전 성공 운영 SHA는 `f8d342ec8f2fdd193c7ef715df6e2035ffec2482`(Actions `37720521996`)이다.
- 포함: 선택 언어 STT 및 비동기 청크 언어 유지, 인식 원문 화면 표시, 권한/쿼터 검증된 한국어 초안 번역 API, 변환 실패 원문 보존·재시도·불완전 전파 차단. 기존 한국어 TBM 저장/요약/수신 계약을 유지한다.
- 제외: 미완료 관리자·직원/가입/권한 개편, V038/V039, 용어집 치환 개편, 소음감지 UI 및 APK. DB migration, 계정·현장 연결, 공급자 선택 및 키는 변경하지 않는다.
- 기존 API의 한국어 초안 계약 때문에 외국어 발화는 원문→한국어 초안 변환을 거친다. Flitto RTT와 별도로 기존 Papago/Google 텍스트 경로(또는 설정된 번역 공급자)를 사용하며 변환 지연·비용이 발생할 수 있다. 한국어 입력은 추가 번역을 호출하지 않는다.
- 검증은 운영 HEAD에 이 수정만 포함한 격리 산출물로 수행한다. 공급자 모의 응답을 이용한 언어 전달/권한/오류 처리 시험은 실제 언어별 음성 정확도나 휴대폰 마이크 시험을 대신하지 않는다.
- 배포는 기존 Actions의 테스트·빌드·불변 릴리스 활성화·readiness/인증 이동 점검을 사용한다. 서버에 이전 릴리스가 보존된다. 운영 SSH 접근은 별도 제공되지 않아 활성 방송/최신 DB 백업을 직접 재확인하지 못했다. 서비스 재시작이 포함되며 무중단 배포로 표현하지 않는다.

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

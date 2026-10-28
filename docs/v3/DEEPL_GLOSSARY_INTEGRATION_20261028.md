# DeepL 용어집 연결 — 2026-10-28

## 후속 운영 배포 승인

- 사용자가 운영 반영을 승인했다. AWS 현재 릴리스 `62466579a89f6353da06a27d70b5e7447a0dbd80`와 원격 배포 브랜치가 일치함을 확인했다. 온프레미스 이전·DNS 변경은 포함하지 않는다.
- 배포 직전 활성 방송 0건 및 기존 백업 서비스 성공을 확인했다. AWS 기존 키의 연결용 사전 접근/4개 언어 항목 수 확인 후 `scripts/deploy/configure-deepl-glossary.py --configure`로 ID/revision만 설정했다. 기존 env는 `/etc/safelink/deepl-glossary-before-20261028/`에 root 전용으로 백업했다. 키 값/계정/DB 스키마 변경 없음.
- GitHub Actions의 전체 검사·빌드 성공 후 기존 배포 경로로 반영한다. 모바일/온프레미스 미완료 변경은 제외한다. 운영 성공 여부는 별도 배포 결과 기록을 따른다.

## 목표와 적용 범위

한국어 현장용어 → SQ Link 한국어 표준어 변환은 유지한다. 그 뒤 DeepL로 번역할 때 한국어→영어·일본어·베트남어·중국어에 지정 용어집을 적용한다. UI·권한·회원가입·V2 코드는 바꾸지 않는다. 역방향/다른 언어쌍에는 이 용어집을 보내지 않는다.

최초 구현 단계는 코드 수정과 VM100의 실제 클라이언트 시험이며 운영 미배포 상태였다. 후속 운영 반영은 위 승인 절차와 별도 배포 결과로 구분한다.

## 확인한 원인과 설계

- 기존 `DeepLClient.translate`는 `/v2/translate`에 `glossary_id`를 보내지 않았다. DeepL 웹 계정에 등록되어 있다는 사실만으로 SQ Link 번역에 적용되지 않는다.
- STT·1:1 대화·프리토크·TBM 경로에서 한국어 표준화가 먼저 진행된다. 원본의 `간조 → calculation`만 연결하면 `셈`으로 바뀐 입력에는 일치하지 않을 수 있다.
- 원본을 수정하지 않고 별도 연결용 용어집에 현장용어와 표준어를 함께 등록했다. 예: `간조 → calculation`, `셈 → calculation`. 한국어 표시/저장 내용을 다시 현장용어로 되돌리지 않는다.
- 일반 문장을 훼손할 수 있는 기존 정책의 동음어는 제외한다. 동일 표준어에 서로 다른 외국어 뜻이 겹치면 임의 선택하지 않고 해당 연결 항목을 제외한다. 제외/누락 항목은 일반 번역으로 처리되며, 지정 용어가 강제 적용되는 것으로 보장하지 않는다.
- 설정된 용어집의 API 오류를 숨기고 용어집 없이 재시도하지 않는다. 설정 ID·내용 revision을 번역 캐시 구분값에 포함해 이전 번역 결과가 재사용되지 않게 한다.

## 원본 및 생성 자원

원본: `01_SQ-LINK_용어집_KO-EN-VI-ZH-JA`

- 원본 ID: `52f898a5-98d7-4538-b907-46a645fb5136`
- 운영에서 사용하던 키로 원본 API 접근 및 다운로드 CSV와 전체 항목 일치 확인.
- 원본 한국어 고유 용어 472개: EN 471 / JA 472 / VI 472 / ZH 472.
- `ky`의 영어 항목은 원본에 없음. SQ Link 전용 QA 항목 `qa혼합용어728`도 원본에 없음.
- 원본 DeepL 용어집, SQ Link DB 용어집은 수정하지 않음.

연결용: `SQLink-standard-bridge-6433ebc83455814a`

- ID: `7201ad79-923a-4cf1-8d6d-9a2d150ce45c`
- revision: `6433ebc83455814a5af578d30b3da3839a0093eb2cd6ec97b91f9f8ae2dc1638`
- 별칭 포함 등록 수: EN 828 / JA 830 / VI 830 / ZH 830. 고유 현장용어 수와 다름.
- 생성 후 API로 4개 사전의 전체 항목을 다시 조회하여 생성 계획과 일치 확인.
- 일반 문장 보호 제외 4개: 가다, 가도, 가리, 시다. 다른 정책상 동음어는 이번 원본에 없음.
- 번역 충돌 제외 표준어 11개: 가불, 각목, 견적, 마무리, 먹선, 먹줄, 모르타르, 스페이서, 입방미터, 자투리, 플랜지. 예: 모르타르에 cement paste와 mortar가 겹침. 원본의 서로 다른 현장용어 연결은 유지하되, 모호한 공통 표준어 연결은 하지 않음.
- 제외 내역은 15개 입력 × 4개 언어 = 60건. 발주사 확정 후 새 revision의 연결용 용어집으로 갱신한다.

## 변경 파일과 실행 절차

1. `AiProperties` / `application.yml`: 서버 전용 용어집 ID·revision 설정.
2. `DeepLClient`: KO→EN/JA/VI/ZH 요청에만 ID 적용. jp/ja, zh-CN 등 기존 별칭 유지.
3. `AiGatewayController`: 용어집 버전을 반영한 캐시 분리.
4. `scripts/deepl-glossary-plan.py`: CSV·활성 SQ 용어·정책으로 결정적 생성 계획과 제외 목록 작성. API의 실제 전달어/정책 버전이 다르면 중단.
5. `scripts/deepl-glossary-remote.py`: VM100의 기존 승인 키를 그 자리에서 사용. 기본은 원본 대조만 수행, `--create`에서 별도 사전 생성. 같은 이름이 이미 있으면 내용을 검증해 재사용. 원본 수정/삭제 API 없음.
6. `scripts/DeepLGlossarySmoke.java` / `run-deepl-glossary-smoke.py`: 새 빌드의 실제 Java 클라이언트로 시험. Spring 앱·DB는 시작하지 않음. 키는 로컬 PC로 복사하거나 결과에 기록하지 않음.

배포 시 **백엔드**에 다음 설정이 함께 필요하다. ID는 인증키가 아니며, API 키는 기존 비밀 저장소에서 유지한다.

```dotenv
DEEPL_GLOSSARY_ID=7201ad79-923a-4cf1-8d6d-9a2d150ce45c
DEEPL_GLOSSARY_REVISION=6433ebc83455814a5af578d30b3da3839a0093eb2cd6ec97b91f9f8ae2dc1638
```

기본 ID가 비어 있으면 기존 동작이다. 원본 ID를 대신 넣으면 표준어 별칭·충돌 제외가 적용되지 않는다. 배포 전 해당 서버 키로 연결용 사전 접근을 확인한다. 롤백은 이전 앱/설정으로 복귀하며, 원본/연결용 사전은 삭제하지 않는다.

## 검증 증빙

- 실제 DeepL 호출 28건: 5개 단어 × 4개 언어 = 20건 모두 지정 번역과 정확히 일치. 일반/부정·조건 문장 2개 × 4개 언어 = 8건 모두 응답 성공, 결과를 읽어 원래 의미 유지 확인.
- `간조`, `셈` 모두: EN calculation / JA 勘定 / VI tính toán / ZH 计算.
- `거푸집`: formwork / 型枠 / ván khuôn / 模板.
- `망치`: hammer / ハンマー / búa / 锤子.
- `평탄화`(나라시의 전달어): leveling / 均し / san phẳng / 找平.
- “들어가도 됩니까? 작업 시작합시다.” → EN “May I come in? Let's get started.”. JA/VI/ZH에서도 출입 질문과 작업 시작 의미 유지.
- “거푸집을 해체하지 마세요. 안전모가 없으면 들어가지 마세요.” → EN “Do not engage in formwork dismantling. Do not enter without a safety helmet.”. JA/VI/ZH에서도 금지/조건 의미 유지.
- 시험은 합성 텍스트로 진행했다. 마이크 실기기 STT, 실제 사용자 화면의 전체 왕복 경로, 전체 472개 용어의 문맥별 번역 정확도 검증을 대신하지 않는다. 원문 음성인식 오류를 용어집 연동만으로 해결한다고 보장하지 않는다.
- AI Java 단위 테스트 및 기존 Korean glossary/translate/STT/free-talk/TBM 회귀 검사 통과. 연결 계획 단위 검사에 정책 불일치 중단 검사 포함.
- 전체 백엔드 검사: 179건 중 148 통과, 29 skipped, Docker 미검출로 DB 통합 테스트 2건 초기화 실패 (`NationwideTbmDatabaseTest`, `TbmPendingNoticesTest`). 전체 성공으로 보고하지 않는다. `bootJar`는 생성 성공.

로컬 증빙: `outputs/deepl-glossary-20261028/{audit-report,bridge-report,plan,live-results}.json`.
VM100 증빙: `/home/safelink/sqlink-migration/deepl-glossary-20261028/`.

## 유지보수

용어/표준어 정책이 바뀌면 CSV·SQ 목록을 다시 읽어 계획을 생성하고 충돌을 검토한다. 새 사전과 revision을 함께 적용하고 동일 문장 회귀 검사를 반복한다. 이번 연결용 사전은 스냅샷이며 발주사의 원본 편집을 자동 동기화하지 않는다.

공식 계약 참고: [DeepL 번역 요청](https://developers.deepl.com/api-reference/translate/request-translation), [다국어 사전 생성](https://developers.deepl.com/api-reference/multilingual-glossaries/create-a-glossary), [사전 항목 조회](https://developers.deepl.com/api-reference/multilingual-glossaries/retrieve-glossary-entries).

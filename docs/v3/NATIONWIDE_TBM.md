# 본사 관리자 전국 TBM

2026-10-06 사용자 승인: 현장 소속이 없는 본사 관리자도 전국 TBM 가능.

## 사용 흐름

1. `/admin/tbm/create`에서 본사 관리자는 `전국 전체 현장`을 기본 대상으로 본다. ROOT도 전국을 선택할 수 있다.
2. 대상 현장 수 확인 후 전국 전파 확인란을 체크한다. 현재 현장 연결이 있는 경우 기존 단일 현장 선택도 가능하다.
3. `TBM 방송 시작`으로 기존 STT/통역을 사용한다. 직접 초안을 입력해 일반 TBM 전파도 가능하다.
4. 녹음 종료 후 기존 초안·요약 검토/수정 흐름을 유지한다. 최종 `TBM 브로드캐스트`로 각 현장에 최종 원문·요약이 저장된다.
5. 라이브 참여자는 같은 TBM 화면에서 요약 확인 후 서명, 미참여자는 기존 음성 완청 절차를 거친다. 참여 기록은 서명 그 자체가 아니다.
6. 기존 질문하기는 실제 해당 현장에 전국 TBM을 보낸 관리자와만 연결된다. 다른 현장의 대화 열람 권한은 부여하지 않는다.

## 권한과 데이터

- HQ_ADMIN/ROOT 전용 `/api/v1/tbm/nationwide/{targets,sessions,speaking,translations,draft,stop,summary,broadcast}`. BFF는 `/api/tbm/nationwide/...`.
- 사이트 연결 없는 계정도 가능하며 기존 계정/site_membership을 일괄 수정하지 않는다.
- 대상은 시작/일반 전파 시점의 `sites.status=ACTIVE` 전체. 비활성 현장은 제외, 근로자가 없는 활성 현장은 포함. 라이브 시작 이후 새로 생긴 현장은 진행 중 그룹에 추가하지 않는다.
- V037 `nationwide_tbm_broadcasts/targets`가 원래 라이브·TBM ID를 현장별로 연결한다. 근로자는 기존 자신의 site SSE/API만 사용한다.
- 발신자만 그룹 조작 가능. 사이트 관리자가 전국 방송의 하위 세션을 중단하거나 덮어쓸 수 없다.
- 기존 현장 방송이 하나라도 활성화되어 있으면 전국 방송 시작을 거절한다. 전국 방송 도중 현장 방송 시작도 거절한다. 방송 동시 병합/우선순위 강제 중단은 이번 범위가 아니다.
- DB 작업은 트랜잭션으로 처리하며 시작·전파 재시도는 동일 그룹 ID로 중복을 방지한다. 전국 시작 네트워크 응답 유실 시 클라이언트도 같은 ID로 재시도한다. 페이지 새로고침 후 방송 제어 복구 기능은 별도이며 운영 전 확인 필요.
- `LiveInterpreterEventBus.publishAfterCommit`은 트랜잭션 확정 후 발행한다. 이미 afterCommit 내부에서 호출하는 기존 초안/요약 컨트롤러는 즉시 발행 `publish`를 유지한다.
- STT와 초안 요약만 `nationwide=true`, `siteId=null`을 허용하고 HQ_ADMIN/ROOT를 재검증한다. 사용자 quota와 audit/AI usage 유지, 임의 현장에 비용 귀속하지 않는다. 다른 AI API는 기존 현장 검증을 유지한다.
- 인식·번역 공급자를 변경하거나 레이턴시 개선을 보장한 변경은 아니다. 현장 수에 따른 DB fan-out/동시 번역 부하는 운영 규모로 별도 부하 테스트 필요.

## 구현 파일

- Backend: `tbm/NationwideTbmController.java`, `NationwideTbmAccess.java`, V037, `AiGatewayController`, `LiveInterpreterController/EventBus`, `ChatController/Repository`.
- Frontend: `src/app/admin/tbm/create/page.tsx`, 전국 BFF, `src/utils/tbm-live-broadcast.ts`, `src/app/api/stt/route.ts`, `src/utils/ai/v3-ai-gateway.ts`, `src/lib/tbm-nationwide-ui.ts`.
- 기존 사이트별 TBM 화면/원문·요약/참여·서명 데이터 계약을 재사용한다. V2 코드는 수정하지 않았다. 전국 대상 UI/API는 이번 명시적 추가 기능이다.

## 검증

- `SQ_NATIONWIDE_TEST_DB=1 ... ./gradlew test bootJar`: 전용 로컬 `127.0.0.1:55439/sq_nationwide_test`만 스키마 초기화한다. 운영/가입 샌드박스 DB를 테스트 초기화 대상으로 사용하지 않는다.
- `NationwideTbmDatabaseTest`: 실제 PostgreSQL에서 미소속 HQ fan-out, 타현장 격리, 소유자 검증, 충돌, 대상 스냅샷, 중복 방지, 롤백, 라이브/미참여 구분, 발신자 질문 권한 검증.
- `NationwideTbmAiTest`, `LiveInterpreterEventBusTest`: 명시적 전국 AI 권한/quota 및 커밋·롤백 이벤트 검증.
- 기존 일부 Testcontainers 테스트는 이 호스트의 Docker 자동 탐지 문제로 skip됨. 전국 DB 테스트는 전용 DB를 사용하여 skip 없이 실행했다.
- TypeScript, 대상 ESLint, `node --test tests/tbm-admin-publication.cjs tests/tbm-live-broadcast.cjs` 통과.
- `node tests/tbm-nationwide-browser.mjs`: 로컬 실제 프론트/BFF/백엔드/Postgres/SSE 연결. HQ siteIds=[], 두 현장의 별도 세션/요약, 일반 전파/재시도, 역할 차단, 참여/미참여 구분, 모바일 가로 넘침 검증. 더미 계정/현장만 사용한다.
- 음성 API와 서명 스토리지는 샌드박스에서 비활성화되어 실제 마이크 인식/음성 재생 품질/서명 파일 저장/푸시 알림(OS)은 이번 테스트로 검증한 것이 아니다.

## 실행/반영 상태

- 로컬 격리 프론트 `http://127.0.0.1:3100`, 백엔드 `http://127.0.0.1:18081`에 V037과 최신 코드 반영.
- 기존 3000 프론트의 운영 API 연결 설정은 변경하지 않는다. 그 서버에서 전국 기능을 검증하면 아직 새 API가 없는 운영을 호출할 수 있다.
- 로컬 전용 더미 HQ: `nationwide-hq@example.invalid` / `LocalTbmTest!2026`. 운영에 없는 공개 테스트 값. 소속 현장 없음.
- 실행: `node scripts/enrollment-sandbox.mjs backend` 및 `frontend`. 샌드박스 seed는 loopback DB/Redis 조건을 검증하며 운영 jar에 포함되지 않는다.
- 운영 배포/계정 권한 변경/실제 전국 방송은 수행하지 않았다. 반영 시 DB V037을 먼저 적용하는 새 백엔드 배포 후 프론트를 배포한다. 롤백 시 신규 테이블과 생성된 기록을 삭제하지 않는다. 이전 백엔드와 새 프론트를 섞어서 배포하지 않는다.

# SQ Link V3 Agent Instructions

이 파일은 SQ Link V3 작업을 시작할 때 먼저 읽는다. 이 프로젝트의 목적과 경계를 까먹지 않기 위한 고정 실행 지침이다.

## Project Identity

- 해당 V3 프로젝트는 타회사에서 바이브코딩한 프로젝트를 상용화하기 위해 디벨롭하는 외주 프로젝트다.
- 레거시 프로젝트는 다른 경로에 별도로 존재한다.
- 레거시 기준 경로는 `/Users/sieon/Desktop/project/safelink/safe-link-v2` 이다.
- V3 작업 경로는 `/Users/sieon/Desktop/project/safelink/safeLink_v3` 이다.
- 현재 프로젝트 내부에 V2 명칭, PoC 문서, Supabase/Workers 코드가 남아 있어도 그것을 실제 레거시 원본으로 간주하지 않는다.
- V3 작업은 상용화 기준으로 보안, 권한, 운영, 모니터링, 데이터 격리 구조를 재설계하는 방향으로 진행한다.
- 레거시에서 가져올 것은 기능 흐름과 UX 아이디어이며, 인증/권한/세션/Service Role/Workers/Supabase 의존 구조를 그대로 복사하지 않는다.

## Legacy Preservation Rule

- V2 코드는 절대 수정하지 않는다. V2는 읽기 전용 기준 확인용으로만 사용한다.
- V3의 화면 디자인, 문구, 회원가입/로그인/설정 흐름, 현장 선택 방식, 관리자/근로자 주요 기능 동작은 V2를 기준으로 유지한다.
- 안정화 작업은 내부 구현, 보안, 권한, 세션, API, DB 구조 개선에 한정한다.
- UI/UX 또는 기능 흐름 변경이 필요해 보이면 먼저 사용자에게 이유와 영향 범위를 설명하고 승인받는다.
- V3 수정 전후에는 가능한 범위에서 V2와 비교해 기능 차이가 생기는지 확인한다.
- V2의 불안전한 인증/권한/세션/Service Role/Supabase 구조는 그대로 복사하지 않는다.

## Required Startup Routine

매 작업 시작 시 다음을 먼저 실행하거나 그에 준하는 확인을 한다.

```bash
pwd
git rev-parse --show-toplevel
git status --short
rg --files -g 'AGENTS.md' -g 'README*' -g 'package.json' -g 'pom.xml' -g 'build.gradle*' -g 'settings.gradle*' -g 'src/**' -g 'docs/v3/**'
sed -n '1,220p' AGENTS.md
sed -n '1,260p' docs/v3/SAFE_LINK_COMMERCIAL_STABILIZATION_CRITERIA.md
sed -n '1,220p' docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md
```

`git`이 없는 복사본/스냅샷이면 그 사실을 먼저 보고하고, 현재 실제 프로젝트 루트와 문서 위치를 다시 확인한다.

## V3 Document Set

- `docs/v3/SAFE_LINK_V3_CLIENT_INPUT.md`: 사용자/클라이언트 제공사항과 요구사항.
- `docs/v3/SAFE_LINK_COMMERCIAL_STABILIZATION_CRITERIA.md`: 상용화 안정화 조건, 목표 기술 스택, 완료 판단 기준.
- `docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md`: 구현자가 따라야 할 실행 순서와 금지사항.
- `docs/v3/SAFE_LINK_V3_AGENT_ANALYSIS.md`: 기술 판단, 리스크, 레거시에서 가져올 것과 버릴 것.

작업 중 보안, 권한, 운영, 레거시 경계에 관한 판단이 바뀌면 위 문서들을 함께 갱신한다.

## Commercial Stabilization Rule

상용화 리팩토링, 인증, 권한, 세션, RLS, Service Role, 현장 격리, AI 비용 통제, 서명 저장, 채팅 정합성, Health Check, Logging, iOS/Android 앱 배포, 도메인/API base URL 작업을 할 때는 `docs/v3/SAFE_LINK_COMMERCIAL_STABILIZATION_CRITERIA.md`를 수락 기준으로 사용한다.

완료 보고 시에는 단순히 "적용됨"이라고 쓰지 말고, 어떤 파일/설정/테스트로 검증했는지 근거를 함께 남긴다. 비밀값은 절대 출력하지 않고 `SET`, `EMPTY`, `MISSING` 상태만 보고한다.

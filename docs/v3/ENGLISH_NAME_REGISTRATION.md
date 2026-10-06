# 영문 이름 등록 — 2026-10-06

## 동작

- 관리자 가입에 영문 이름 입력을 추가. 임시 가입, 정식 전환, 관리자 근로자 등록/NFC 발급, 내 정보 수정도 `EnglishNameField` 공유.
- 후속 요청 반영: 입력 단계에서 비영문/숫자/이모지 차단, 붙여넣기 및 IME 확정값도 필터링. 자동 영문 변환/후보 영역/‘이 영문 이름 사용’ 버튼과 API 호출 제거. 직접 영문 이름 입력 → 이름 확인 체크 → 기존 개인정보 동의/가입 절차. 이름 수정 시 확인 상태 해제.
- 영문 A–Z, 공백, 하이픈, 아포스트로피, 마침표 허용; 80자 이내. 서버가 대문자/공백을 정리하여 display_name 저장. 숫자가 든 로그인 ID는 별도이며 기존 인증 계약 유지.
- 20개 선택 언어 안내. 필리핀 앱 코드 `ph`와 `tl`, 일본 `jp`/`ja` 별칭 처리.
- 기존 계정은 자동 변경하지 않음. 기존 이름 그대로의 언어/현장 변경은 유지하며 실제 이름 수정부터 정책 적용. 과거 서명/기록/역할/현장을 수정하지 않음.

## 서버 및 비용

- `EnglishName`: 임시 등록·전환 신청/승인·관리자 가입/초대·근로자 등록/수정·자기 프로필 변경 검증. 가입 이름을 이메일이나 로그인 이니셜로 대체하는 fallback 제거.
- 기존 ICU4J 로컬 변환 helper는 남아 있으나 공통 이름 입력 화면에서 호출하지 않음. 영문 이름 직접 입력이 현재 가입 UX임.
- 공개 helper만 허용, TEMP에도 이 경로만 추가. CSRF 예외 없음. BFF same-origin/본문 크기 제한, 서버 글자 수/문자 제한, Redis atomic 60회/분, no-store. Redis 실패는 fail-closed. 이름을 rate-limit key나 로그에 기록하지 않음. 외부 AI 비용·API 키 필요 없음.
- 참고: https://unicode-org.github.io/icu/userguide/transforms/general/ (문자 전사와 번역은 다름).

## 검증 / 실행 범위

- backend 전체 테스트 98개, 실패/skip 0 (JUnit + Docker Testcontainers, 2026-10-06). 영문 검증, 등록/전환 거부, 로컬 제안, CSRF, 기존 이름의 언어 변경 보존 포함.
- `node --test tests/english-name.cjs tests/worker-registration-ui.cjs`: 5개 통과. 입력 필터 및 실제 앱 언어 목록과 비교.
- TypeScript 및 수정 파일 ESLint 통과.
- 최종 `./gradlew test bootJar` 통과. `tests/enrollment-sandbox-smoke.mjs`에서 영문 더미 계정의 개인정보 동의 필수, 임시 역할 제한, 잘못된 정보 거부, 동일 계정 정식 전환 및 중복 전환 거부 확인. 즉시 전환 검증은 격리 sandbox 정책이며 운영 승인 정책을 변경한 것이 아님.
- `tests/english-name-browser.mjs`: 로컬 3100 BFF→18081 Spring→격리 DB에서 비영문 입력/IME/붙여넣기 차단, 제안 버튼·호출 없음, 수정→확인 무효화→가입→영문 저장, 기존 helper 보안, 20언어 모바일 화면을 검사. 테스트 계정은 로컬 DB에만 유지.
- 실행: `node scripts/enrollment-sandbox.mjs backend` / `frontend`. 접속 `http://127.0.0.1:3100/auth/temporary?lang=ko`. 3000/운영 환경변수는 변경하지 않음. 3100은 이름/가입 검증용 격리 환경으로 실제 현장 방송/운영 계정 테스트가 아님.
- 운영에는 아직 배포하지 않음. 프론트와 백엔드를 함께 배포해야 공개 가입 helper와 서버 검증이 함께 반영됨. 신규 DB migration 없음.

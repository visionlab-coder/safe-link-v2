# SQ Link V3

SQ Link는 건설 현장의 TBM 안전교육, 근로자 확인/서명, 실시간 통역, 번역 채팅을 제공하는 현장 커뮤니케이션 애플리케이션이다.

## 현재 상태

- 기존 Next.js 화면 디자인, 주요 URL, 관리자/근로자 기능 흐름을 유지했다.
- 인증, 권한, 현장 격리, 트랜잭션, 감사 로그, AI quota, 실시간 이벤트는 Spring Boot가 처리한다.
- 데이터는 PostgreSQL/Flyway, 세션과 rate limit/quota는 Redis, 서명/첨부 메타데이터는 Object Storage 구조를 사용한다.
- 실시간 통역 기본 경로는 Google STT + Papago + Google Translate fallback이다.
- STT, TTS, Vision, 번역 공급자 호출은 Spring Boot 내부 AI Gateway에서 처리한다.
- Chat, Live Interpreter, Travel Talk의 실시간 갱신은 Spring SSE를 사용한다.
- Supabase Auth/RLS/Realtime/Service Role, Pusher, Gemini는 현재 V3 런타임 기준으로 사용하지 않는다.
- Cloudflare/OpenNext 설정과 과거 migration/PoC 문서는 배포 전환 참고 자료로만 남아 있다.

코드 리팩토링 범위는 로컬 기준으로 완료했다. 운영 배포, 기존 운영 데이터 이관, OpenAI quota 활성화, Google Cloud Vision API 활성화, 운영 Secret/도메인/중앙 로그 구성은 코드 외 운영 조건이다.

## 기술 스택

- Frontend: Next.js + React + TypeScript + Tailwind CSS + Motion
- Backend: Spring Boot + Spring Security + REST API + SSE + Spring Actuator
- Database: PostgreSQL + Flyway
- Session / Cache / Rate Limit: Redis
- Storage: S3 / Cloudflare R2 / MinIO 호환 Object Storage
- AI Gateway: Google STT/TTS/Translate + Naver Papago + OpenAI
- Testing: JUnit + Spring Boot Test + Next.js production build

## 주요 기능

1. 관리자 로그인, 승인 대기 가입, 역할/현장 권한 관리
2. 근로자 quick login, QR/NFC 현장 입장
3. TBM 작성, 배포, 확인, 서명, 현황 조회
4. 관리자-근로자 번역 채팅과 읽음 처리
5. 실시간 통역과 Travel Talk 2폰 대화
6. AI 번역/STT/TTS/Vision quota 및 사용량 기록
7. 보고서 발급/해시 검증
8. Actuator 기반 API/DB/Redis/Storage/AI 상태 확인

## 로컬 실행

요구사항:

- Node.js 20+
- Java 21
- PostgreSQL
- Redis
- 선택 사항: S3/R2/MinIO 호환 Object Storage

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
./gradlew bootRun
```

기본 주소:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Health: `http://localhost:8080/actuator/health`

환경변수와 실행 명령은 `docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md`와 `backend/README.md`를 따른다. API key나 DB 비밀번호를 문서와 저장소에 기록하지 않는다.

## 검증

```bash
npm run build
npm audit

cd backend
./gradlew test bootJar --no-daemon
```

2026-07-10 기준 Next.js production build, Spring Boot test/bootJar, 전체 npm audit를 통과했다. Google TTS -> STT, Papago 번역, Live/Chat/Travel SSE, 보고서 발급/검증 smoke test도 통과했다.

## 기준 문서

- `docs/v3/SAFE_LINK_V3_IMPLEMENTATION_STATUS.md`: 실제 구현 상태와 코드 외 잔여 조건
- `docs/v3/SAFE_LINK_V3_PHASE1_COMPLETION_REPORT.md`: 검증 결과와 완료 판단
- `docs/v3/SAFE_LINK_COMMERCIAL_STABILIZATION_CRITERIA.md`: 상용 안정화 기준
- `docs/v3/SAFE_LINK_V3_DEVELOPER_COMMANDS.md`: 개발/검증 명령과 금지 패턴
- `docs/v3/SEOWON_CONSTRUCTION_BRIEFING.md`: 대표 및 팀 브리핑 요약

## 운영 전 별도 작업

- 운영 PostgreSQL/Redis/Object Storage 준비와 기존 데이터 이관
- OpenAI 결제/사용 한도 활성화
- Google Cloud Vision API 활성화
- HTTPS, production cookie, CORS, 도메인 설정
- Secret Manager, 중앙 로그, 백업, 모니터링/알림, CI/CD 구성
- 실제 고객 계정과 기기를 이용한 전체 UAT
- 배포 방식 확정 후 Cloudflare/OpenNext/과거 환경변수 정리

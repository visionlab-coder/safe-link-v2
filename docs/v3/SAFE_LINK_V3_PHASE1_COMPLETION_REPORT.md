# SAFE-LINK V3 상용화 리팩토링 1차 완료 보고

검증일: 2026-07-10

## 기준

- V2는 수정하지 않고 V3만 변경했다.
- 화면 디자인, 주요 URL, 관리자/근로자 기능 흐름은 유지했다.
- 외부 API key 값은 확인하거나 출력하지 않았다.
- 운영 Supabase SQL, 운영 Storage, 운영 외부 vendor 호출은 승인 없이 적용하지 않았다.

## 4일차 적용 범위

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| Google/Naver/OpenAI/실시간 번역 호출 위치 확인 | 완료 | `src/app/api/translate`, `stt`, `tts`, `romanize`, `vision`, `quiz`, `travel/translate`, `poc/ai-lab`, `tbm/*`, `agents/*` 확인 |
| Spring Boot AI Gateway 중심 정리 | 완료 | 번역/romanize/TBM AI draft는 `/api/v1/ai/vendor`, STT/TTS/Vision은 Spring 전용 adapter를 사용하며 quota/audit/usage log를 Spring에서 처리 |
| Redis rate limit/quota | 완료 | `AiQuotaService`가 Redis key `rate:{feature}:{scope}:{minute}`로 제한 |
| AI 사용량/비용 추적 | 완료 | `ai_usage_logs`에 feature/vendor/model/input/output/duration/estimated_cost 저장 |
| Health Check/logging/fallback | 완료 | Actuator `liveness`, `readiness`, `ai`, `storage` group 확인. vendor/storage disabled는 `UP + mode detail`로 분리 |
| Next.js 빌드 | 완료 | `npm run build` 통과 |
| Spring Boot 빌드/테스트 | 완료 | `./gradlew test bootJar --no-daemon` 통과 |
| 관리자/근로자 핵심 화면 QA | 완료 | 관리자 login/admin/TBM create, 근로자 quick-login/worker/chat HTTP 200 확인 |

## AI 호출 정리 결과

Spring Boot AI Gateway adapter를 적용한 V3 핵심 route:

- `src/app/api/translate/route.ts`
- `src/app/api/stt/route.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/romanize/route.ts`
- `src/app/api/vision/route.ts`
- `src/app/api/quiz/route.ts`

동작 기준:

- Next route는 기존 URL/JSON 계약을 유지하는 proxy이며 실제 외부 AI vendor 호출은 Spring Boot 내부에서 실행한다.
- Spring Boot는 사용자 역할, site 접근, Redis quota, audit log, usage log를 처리한다.
- travel/PoC 호환 route도 Spring 내부 gateway로 이전했으며 직접 vendor 호출은 남기지 않았다.

## MOCK / fallback 분리

| 영역 | 현재 로컬 상태 | 운영 전 필요 |
| --- | --- | --- |
| AI vendor | 로컬 `.env.local` 기준 `SAFE_LINK_AI_VENDOR_ENABLED=true`, Gateway mode `VENDOR_ENABLED` | 운영에서는 Secret Manager와 서버 환경변수로 동일 설정 |
| Object Storage | `SAFE_LINK_STORAGE_ENABLED=false`, storage mode `LOCAL_FALLBACK` | S3/R2/MinIO bucket, region, endpoint, access secret 설정 |
| Google/Naver/OpenAI | Google TTS/STT, Papago, Google Translate 실제 호출 PASS. OpenAI key는 설정됐으나 계정 quota 부족 | OpenAI 결제/사용 한도 활성화 후 텍스트·Vision 호출 검증 |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Spring Boot test | PASS |
| Next.js build | PASS |
| Actuator liveness | UP |
| Actuator readiness | UP |
| Actuator ai | UP |
| Actuator storage | UP |
| Spring login + AI reserve | 200 |
| AI usage log 저장 | PASS |
| Next `/api/translate` Gateway logging | PASS |
| 24kHz OGG/Opus 실시간 STT | PASS, Google STT 자막 반환 |
| Papago 번역 + Google 역번역/fallback | PASS |
| AI provider health detail | Google `true`, Papago `true`, OpenAI `true`(quota 별도) |
| 관리자 login + `/admin` + `/admin/tbm/create` | 200 |
| 근로자 quick login + `/worker` + `/worker/chat` | 200 |
| 비로그인 admin/worker 보호 | `/auth` redirect 확인 |
| Live Interpreter SSE | PASS |
| Chat 사용자 알림 SSE | PASS |
| Travel Talk SSE | PASS |
| 보고서 발급/해시 검증 | PASS |
| npm audit | 취약점 0건 |

## 남은 리스크

| 리스크 | 설명 | 다음 조치 |
| --- | --- | --- |
| 외부 AI 계정 활성화 | OpenAI는 `insufficient_quota`, Google Vision은 API 비활성 상태다. 코드 경로와 fallback은 Spring에 구현돼 있다. | OpenAI 결제/한도와 Google Cloud Vision API를 활성화한 뒤 운영 smoke test |
| legacy/PoC direct call 재유입 | `/api/travel/translate`, `/api/poc/ai-lab/*`를 포함한 Next route의 직접 vendor 호출을 제거했다. | Spring Gateway 경유 여부를 정적 검색과 smoke test로 계속 검증 |
| 실제 vendor 장애 테스트 | Google TTS→STT, Papago, Google Translate 실제 호출은 검증했다. OpenAI는 `insufficient_quota`, Google Vision은 API 비활성 상태를 확인했다. | 결제/콘솔 활성화 후 staging에서 fallback, timeout, quota 초과 검증 |
| 중앙 로그/관측성 | Actuator와 usage/audit log 기반은 있으나 OpenTelemetry/중앙 로그 수집은 미완성이다. | OTEL exporter, log aggregation, alert rule 추가 |
| 운영 도메인/CORS/cookie | 로컬은 HTTP 기준이다. 운영은 HTTPS, Secure cookie, CORS origin 확정 필요. | API domain, frontend domain, mobile base URL 확정 |

## 1차 완료 판단

상용화 핵심 리팩토링 1차 범위는 로컬 기준으로 완료 상태다.

- 인증/세션/권한은 Spring Boot 중심 흐름으로 연결됐다.
- TBM/서명/채팅 핵심 저장, 조회, 권한 검증은 Spring Boot compatibility API로 연결됐다.
- 번역/STT/TTS/AI 핵심 route는 V3 세션 기준 Spring AI Gateway quota/logging을 통과한다.
- Redis, PostgreSQL/Flyway, Object Storage metadata, Actuator health, build, smoke test 근거가 남았다.

단, OpenAI 결제/쿼터, Google Cloud Vision API 활성화, 운영 Secret/도메인/중앙 로그 구성, 실제 고객 계정 기반 UAT는 코드 외 잔여 작업이다.

## 대표님 보고용 요약

```text
SAFE-LINK V3 상용화 리팩토링 1차 범위를 로컬 기준으로 정리했습니다.
인증/세션/권한은 Spring Boot 중심으로 전환했고, TBM/서명/채팅 핵심 기능은 site_id 권한 검증과 저장 구조를 보강했습니다.
번역, STT, TTS, Vision, Quiz 등 주요 AI 호출은 Spring Boot AI Gateway에서 Redis quota와 사용량 로그를 먼저 거치도록 정리했습니다.
Spring Boot 테스트, Next.js 빌드, Actuator Health Check, 관리자/근로자 핵심 화면 smoke test까지 통과했습니다.
Google TTS→STT, Papago, Google Translate 실제 호출과 STT/TTS/Vision Spring adapter 이전을 검증했습니다. 남은 부분은 OpenAI 결제/쿼터, Google Vision API 활성화, 운영 도메인/CORS/중앙 로그 구성입니다.
```

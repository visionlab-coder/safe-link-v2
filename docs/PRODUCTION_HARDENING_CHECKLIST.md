# SAFE-LINK V2 Production Hardening Checklist

이 문서는 `PoC 통과 이후`, 상용화 직전 안정화를 위해 실제 저장소 기준으로 무엇을 점검하고 어떤 파일을 우선 수정해야 하는지 정리한 실행 체크리스트다.

## Priority 1: Secrets And Access

### 1. Rotate exposed secrets
- 대상: `.env.local`, Cloudflare secret store, Supabase project secrets
- 즉시 재발급 권장:
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `OPENAI_API_KEY`, `GOOGLE_CLOUD_API_KEY`, `NAVER_CLIENT_SECRET`, `PUSHER_SECRET`
- 이유:
  현재 로컬 개발 중 노출 이력이 있다고 가정하는 편이 안전하다.

### 2. Freeze role contract
- 기준 파일:
  [src/lib/roles.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/lib/roles.ts:1)
- 확인 항목:
  `HQ_ADMIN`, `SAFETY_OFFICER`, `WORKER`, `ROOT`, `HQ_OFFICER`
- 해야 할 일:
  운영 문서와 DB seed에서도 이 문자열만 사용한다.

### 3. Re-check RLS
- 영향 테이블:
  `profiles`, `tbm_notices`, `tbm_ack`, `messages`
- 확인 기준:
  근로자는 자기 메시지와 자기 서명만 볼 수 있어야 한다.
  관리자도 자기 현장 기준으로만 조회되게 굳히는 것이 이상적이다.

## Priority 2: Operational Visibility

### 4. Promote `/api/check` to release gate
- 기준 파일:
  [src/app/api/check/route.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/api/check/route.ts:1)
- 현재 점검 항목:
  Supabase, Google Translate, Google TTS, Google STT, OpenAI, Papago, Pusher
- 운영 규칙:
  배포 직후와 현장 시연 직전에 한 번씩 실행

### 5. Show health on admin-facing surfaces
- 기준 파일:
  [src/components/SystemHealthCheck.tsx](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/components/SystemHealthCheck.tsx:1)
  [src/app/admin/page.tsx](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/admin/page.tsx:1)
- 확인 항목:
  장애가 있을 때 관리자 화면에서 바로 식별 가능한지

### 6. Add structured failure logging
- 우선 대상:
  [src/app/api/translate/route.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/api/translate/route.ts:1)
  [src/app/api/stt/route.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/api/stt/route.ts:1)
  [src/app/api/tts/route.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/api/tts/route.ts:1)
- 최소 요구:
  `service`, `error`, `lang`, `site_id`, `timestamp` 단위로 남기기

## Priority 3: Data Integrity

### 7. Freeze DB baseline
- 기준 파일:
  [supabase/POC_PRECHECK.sql](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/supabase/POC_PRECHECK.sql:1)
  [supabase/POC_REPAIR_CURRENT_20260428.sql](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/supabase/POC_REPAIR_CURRENT_20260428.sql:1)
  [docs/POC_DB_PRECHECK_GUIDE.md](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/docs/POC_DB_PRECHECK_GUIDE.md:1)
- 운영 규칙:
  스테이징/실운영 배포 전 `POC_PRECHECK.sql`을 기준 점검으로 사용한다.

### 8. Add duplicate and missing-data guards
- 우선 대상:
  [src/app/worker/tbm/[id]/page.tsx](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/worker/tbm/[id]/page.tsx:340)
  [src/app/admin/chat/page.tsx](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/admin/chat/page.tsx:390)
  [src/app/worker/chat/page.tsx](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/app/worker/chat/page.tsx:458)
- 목표:
  중복 서명, insert 실패 후 UI 잔상, 재시도 시 중복 메시지 같은 케이스를 줄인다.

## Priority 4: Translation Quality

### 9. Expand validation set
- 기준 파일:
  [docs/TRANSLATION_VALIDATION_MATRIX.md](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/docs/TRANSLATION_VALIDATION_MATRIX.md:1)
- 목표:
  언어별 검증 문장을 10개에서 30개 이상으로 확장
- 우선 언어:
  `vi`, `zh`, `en`, `th`

### 10. Keep glossary governance simple
- 기준 파일:
  [src/utils/normalize.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/utils/normalize.ts:1)
  [src/constants/glossary.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/constants/glossary.ts:1)
- 운영 규칙:
  현장 은어 추가는 승인자 1명 기준으로 관리

## Priority 5: Release Rehearsal

### 11. Repeat the PoC scenario under load
- 기준 문서:
  [docs/POC_REHEARSAL_CHECKLIST.md](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/docs/POC_REHEARSAL_CHECKLIST.md:1)
- 반복 기준:
  관리자 1명, 근로자 3명, TBM 5건, 채팅 왕복 10건

### 12. Freeze a deployment checklist
- 포함 항목:
  secrets 확인, `/api/check` 확인, DB precheck 확인, 관리자 로그인, 근로자 로그인, TBM 1건, 채팅 1건

## Recommended Next Build Work

1. `/api/check` 결과를 운영자 release gate로 쓰기
2. API 실패 structured logging 추가
3. RLS 재검토 문서화
4. 번역 검증표 확대
5. 반복 리허설 기록 남기기

# SAFE-LINK V2 소스 인벤토리

| 항목 | 수량 | 기준 |
|---|---:|---|
| Next API route | 69 | `src/app/api/**/route.ts` |
| Git 추적 migration | 53 | `git ls-files supabase/migrations/*.sql` |
| 로컬 미추적 migration 후보 | 2 | 운영 적용·전달 전 별도 검토 |
| Realtime channel 생성 | 11 | `.channel(...)` 정적 집계 |
| `CREATE POLICY` 선언 | 91 | `supabase/**/*.sql` |
| RLS 활성화 선언 | 35 | `ENABLE ROW LEVEL SECURITY` |
| 환경변수 계약 | 48 | `config/env-contract.json` |

## 중요 해석

- migration 53개가 운영 DB에 모두 적용됐다는 의미는 아니다. 운영 migration history와 대조해야 한다.
- SQL policy 수는 교체·rollback 파일을 포함한다. 최종 유효 정책은 staging DB에서 확인한다.
- 로컬의 `20260607_patent_alter_columns_recovery.sql`, `20260622_tbm_notices_realtime.sql`은 미추적 후보라 이번 ZIP에 포함하지 않는다.
- API는 `/api/version` 추가 후 69개이며 기존 문서의 67개 표기를 대체한다.

## 주요 Realtime 흐름

- 근로자 TBM: `worker_tbm_realtime`, `tbm_detail_realtime`
- 라이브 통역: `live_translation_feed_{profileId}`, `live_worker_responses_{adminId}`
- 채팅·알림: admin/worker site 채널
- 퀴즈: `tbm_quiz_live`
- Travel 실험: `travel-{code}`

자동 검증은 `npm run check:inventory`로 실행한다.

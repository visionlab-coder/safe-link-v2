# SAFE-LINK V2 PoC DB Precheck Guide

PoC 직전에는 새 기능보다 스키마 정합성이 더 중요하다.  
이 문서는 `supabase/POC_PRECHECK.sql` 결과를 보고 어떤 항목을 보정해야 하는지 빠르게 판단하기 위한 운영 가이드다.

## 실행 순서

1. Supabase SQL Editor에서 [supabase/POC_PRECHECK.sql](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/supabase/POC_PRECHECK.sql:1)을 실행한다.
2. 아래 표 기준으로 누락 항목을 판정한다.
3. 누락이 있으면 [supabase/POC_REPAIR_MINIMAL.sql](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/supabase/POC_REPAIR_MINIMAL.sql:1)을 검토 후 적용한다.
4. 다시 `POC_PRECHECK.sql`을 실행해 결과가 정리됐는지 확인한다.

## 테이블별 최소 합격 기준

`profiles`
- 필수 컬럼: `id`, `display_name`, `role`, `preferred_lang`, `phone_number`, `site_id`
- 관리자 계정 추가 확인용: `title`, `site_code`, `system_role`
- 누락 시 증상:
  `auth`, `setup`, `admin`, `worker`, `control`, `system` 진입 흐름이 불안정해진다.

`tbm_notices`
- 필수 컬럼: `id`, `content_ko`, `created_by`, `created_at`
- 권장 컬럼: `site_id`, `site_code`, `title`, `risk_level`
- 누락 시 증상:
  관리자 TBM 발송이 실패하거나 근로자 홈에서 신규 TBM 알림이 비정상 동작한다.

`tbm_ack`
- 필수 컬럼: `tbm_id`, `worker_id`, `signature_data`, `ack_at`
- 권장 컬럼: `signed_at`, `worker_name`
- 누락 시 증상:
  근로자 서명이 저장되지 않거나 관리자 서명 현황 화면이 비게 된다.

`messages`
- 필수 컬럼: `from_user`, `to_user`, `source_lang`, `target_lang`, `source_text`, `translated_text`, `created_at`
- 권장 컬럼: `site_id`, `is_read`, `audio_url`, `ai_analysis`
- 누락 시 증상:
  관리자-근로자 1:1 번역 채팅이 insert 실패하거나 알림 흐름이 깨진다.

`construction_glossary`
- 필수 컬럼: `slang`, `standard`, `is_active`
- 누락 시 증상:
  TBM 한국어 정규화가 DB 사전을 쓰지 못하고 로컬 fallback만 사용한다.

## role 값 합격 기준

`profiles.role`에는 최소 아래 값만 보여야 한다.

- `HQ_ADMIN`
- `SAFETY_OFFICER`
- `WORKER`
- `ROOT`
- `HQ_OFFICER`

이외 값이 섞여 있으면 [src/lib/roles.ts](/C:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/src/lib/roles.ts:1) 기준 라우팅과 어긋날 수 있다.

## 권장 적용 원칙

- PoC 직전에는 컬럼 이름 변경보다 `add column if not exists` 방식이 안전하다.
- 데이터 마이그레이션이 필요해 보이면 바로 rename 하지 말고, 우선 새 컬럼을 추가해 흐름을 살린다.
- `POC_REPAIR_MINIMAL.sql`은 additive-only 기준으로 작성돼 있다. 기존 데이터를 지우지 않는다.

-- ============================================================================
-- Migration: site_id TEXT → UUID REFERENCES sites(id)
-- Date: 2026-05-14
-- Author: SAFE-LINK Security/Schema Patch
-- ============================================================================
--
-- 대상 테이블 10개와 처리 내용:
--
-- [NOT NULL 컬럼]
--   1. claim13_hash_chain_events  — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_claim13_hash_chain_site_id (site_id, id) DROP → 재생성
--   2. stop_work_alerts           — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_stop_work_alerts_site (site_id, created_at) DROP → 재생성
--   3. claim17_stop_work_interventions — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_claim17_stop_work_site_status (site_id, status, created_at) DROP → 재생성
--   4. claim13_pledges            — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: 없음 (site_id 단독 인덱스 미존재)
--   5. safety_equipment_grants    — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_safety_grants_site (site_id, created_at) DROP → 재생성
--   6. nfc_tbm_sessions           — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_nfc_tbm_sessions_site (site_id) DROP → 재생성
--   7. nfc_worker_daily_access    — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_nfc_worker_daily_access_site_date (site_id, work_date, status) DROP → 재생성
--   8. nfc_worker_safety_daily_logs — site_id TEXT NOT NULL → UUID NOT NULL
--      인덱스: idx_nfc_worker_safety_daily_logs_site_date (site_id, work_date, status) DROP → 재생성
--
-- [NULLABLE 컬럼]
--   9. tbm_quiz_sessions          — site_id TEXT NULL → UUID NULL
--      인덱스: 없음 (site_id 단독 인덱스 미존재)
--  10. nfc_card_lifecycle_events  — site_id TEXT NULL → UUID NULL
--      인덱스: idx_nfc_card_lifecycle_site_created (site_id, created_at) DROP → 재생성
--
-- 전제 조건:
--   모든 site_id 값은 UUID 형식의 TEXT (gen_random_uuid() 기반으로 삽입됨).
--   각 테이블 앞에 precheck DO 블록을 두어 UUID 형식 위반 또는 sites 테이블에
--   미존재하는 orphan 레코드가 발견되면 즉시 EXCEPTION으로 트랜잭션 롤백.
--
-- 주의:
--   append_claim13_audit_event(p_site_id TEXT, ...) 함수 시그니처는 이 마이그레이션
--   범위 밖. 컬럼 타입 변경 후 TEXT → UUID 묵시적 캐스트는 유효한 UUID 문자열에
--   한해 계속 동작하나, 장기적으로 해당 함수 시그니처도 UUID로 갱신 권고.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. claim13_hash_chain_events
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.claim13_hash_chain_events
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'claim13_hash_chain_events: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_claim13_hash_chain_site_id;

ALTER TABLE public.claim13_hash_chain_events
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.claim13_hash_chain_events
  ADD CONSTRAINT fk_claim13_hash_chain_events_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_claim13_hash_chain_site_id
  ON public.claim13_hash_chain_events(site_id, id);


-- ============================================================================
-- 2. stop_work_alerts
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.stop_work_alerts
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'stop_work_alerts: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_stop_work_alerts_site;

ALTER TABLE public.stop_work_alerts
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.stop_work_alerts
  ADD CONSTRAINT fk_stop_work_alerts_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_stop_work_alerts_site
  ON public.stop_work_alerts(site_id, created_at DESC);


-- ============================================================================
-- 3. claim17_stop_work_interventions
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.claim17_stop_work_interventions
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'claim17_stop_work_interventions: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_claim17_stop_work_site_status;

ALTER TABLE public.claim17_stop_work_interventions
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.claim17_stop_work_interventions
  ADD CONSTRAINT fk_claim17_stop_work_interventions_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_claim17_stop_work_site_status
  ON public.claim17_stop_work_interventions(site_id, status, created_at DESC);


-- ============================================================================
-- 4. claim13_pledges
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.claim13_pledges
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'claim13_pledges: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

-- site_id 단독 인덱스 없음 — 타입 변경 후 FK만 추가
ALTER TABLE public.claim13_pledges
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.claim13_pledges
  ADD CONSTRAINT fk_claim13_pledges_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


-- ============================================================================
-- 5. safety_equipment_grants
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.safety_equipment_grants
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'safety_equipment_grants: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_safety_grants_site;

ALTER TABLE public.safety_equipment_grants
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.safety_equipment_grants
  ADD CONSTRAINT fk_safety_equipment_grants_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_safety_grants_site
  ON public.safety_equipment_grants(site_id, created_at DESC);


-- ============================================================================
-- 6. tbm_quiz_sessions  (NULLABLE — FK에 MATCH SIMPLE, NULL 허용)
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.tbm_quiz_sessions
   WHERE site_id IS NOT NULL
     AND (
       site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id)
     );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'tbm_quiz_sessions: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

-- site_id 단독 인덱스 없음 — 타입 변경 후 FK만 추가
ALTER TABLE public.tbm_quiz_sessions
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.tbm_quiz_sessions
  ADD CONSTRAINT fk_tbm_quiz_sessions_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;


-- ============================================================================
-- 7. nfc_tbm_sessions
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.nfc_tbm_sessions
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'nfc_tbm_sessions: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_nfc_tbm_sessions_site;

ALTER TABLE public.nfc_tbm_sessions
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.nfc_tbm_sessions
  ADD CONSTRAINT fk_nfc_tbm_sessions_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_nfc_tbm_sessions_site
  ON public.nfc_tbm_sessions(site_id);


-- ============================================================================
-- 8. nfc_worker_daily_access
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.nfc_worker_daily_access
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'nfc_worker_daily_access: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_nfc_worker_daily_access_site_date;

ALTER TABLE public.nfc_worker_daily_access
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.nfc_worker_daily_access
  ADD CONSTRAINT fk_nfc_worker_daily_access_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_nfc_worker_daily_access_site_date
  ON public.nfc_worker_daily_access(site_id, work_date, status);


-- ============================================================================
-- 9. nfc_worker_safety_daily_logs
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.nfc_worker_safety_daily_logs
   WHERE site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'nfc_worker_safety_daily_logs: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_nfc_worker_safety_daily_logs_site_date;

ALTER TABLE public.nfc_worker_safety_daily_logs
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.nfc_worker_safety_daily_logs
  ADD CONSTRAINT fk_nfc_worker_safety_daily_logs_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_nfc_worker_safety_daily_logs_site_date
  ON public.nfc_worker_safety_daily_logs(site_id, work_date DESC, status);


-- ============================================================================
-- 10. nfc_card_lifecycle_events  (NULLABLE)
-- ============================================================================
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.nfc_card_lifecycle_events
   WHERE site_id IS NOT NULL
     AND (
       site_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id::text = site_id)
     );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'nfc_card_lifecycle_events: % 행의 site_id가 UUID 형식이 아니거나 sites에 미존재', bad_count;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_nfc_card_lifecycle_site_created;

ALTER TABLE public.nfc_card_lifecycle_events
  ALTER COLUMN site_id TYPE UUID USING site_id::uuid;

ALTER TABLE public.nfc_card_lifecycle_events
  ADD CONSTRAINT fk_nfc_card_lifecycle_events_site_id
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_nfc_card_lifecycle_site_created
  ON public.nfc_card_lifecycle_events(site_id, created_at DESC);


-- ============================================================================
-- 완료
-- ============================================================================
-- NOTE: append_claim13_audit_event(p_site_id TEXT, ...) 및
--       verify_claim13_hash_chain(p_site_id TEXT) 함수 시그니처는 이 마이그레이션
--       범위에 포함하지 않음. TEXT → UUID 묵시적 캐스트는 UUID 문자열에 한해
--       계속 동작하나, 차기 패치에서 p_site_id 타입을 UUID로 변경 권고.
-- ============================================================================

COMMIT;

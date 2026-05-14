-- ============================================================================
-- 보안 패치 2: RLS 취약점 추가 수정 2026-05-15
-- C-3  : tbm_quiz_sessions — USING(true) WITH CHECK(true) → 관리자 전체 관리 + 근로자 자신 세션만 SELECT
-- C-5  : live_translations — USING(true) SELECT → 관리자 전체 + 근로자 동일 site_id만 SELECT
-- C-6  : sites — SELECT 의도적 공개 유지 (주석 명시) + INSERT/UPDATE/DELETE 관리자 전용 추가
-- C-7  : is_safelink_admin() — SET search_path = public 누락 수정
-- C-13 : safety_equipment_grants — SELECT-then-INSERT 레이스 컨디션 → UNIQUE 인덱스로 원자적 중복 방지
-- NFC  : nfc_worker_stickers — 활성 스티커 근로자당 1개 보장 (partial unique index)
-- ============================================================================

BEGIN;

-- ============================================================================
-- C-7: is_safelink_admin() SET search_path = public 누락 수정
-- 기존 정의(20260507_nfc_tbm_patent.sql)에 SET search_path 없어 search_path injection 가능
-- SITE_MANAGER 역할 추가 (task spec 기준)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_safelink_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER', 'SAFETY_OFFICER', 'SITE_MANAGER')
  );
$$;


-- ============================================================================
-- C-3: tbm_quiz_sessions RLS 강화
-- 기존: FOR ALL USING(true) WITH CHECK(true) → 인증된 모든 사용자 읽기/쓰기
-- 변경: 관리자 전체 관리 / 근로자는 자신의 응답(tbm_quiz_responses)이 있는 세션만 SELECT
-- ============================================================================
DROP POLICY IF EXISTS "admin manage quiz sessions" ON public.tbm_quiz_sessions;

CREATE POLICY "admins manage quiz sessions"
  ON public.tbm_quiz_sessions FOR ALL
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "workers read own quiz sessions" ON public.tbm_quiz_sessions;
CREATE POLICY "workers read own quiz sessions"
  ON public.tbm_quiz_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tbm_quiz_responses
      WHERE tbm_quiz_responses.quiz_session_id = tbm_quiz_sessions.id
        AND tbm_quiz_responses.worker_id = auth.uid()
    )
  );


-- ============================================================================
-- C-5: live_translations RLS 강화
-- 기존: USING(true) → 인증된 모든 사용자 전체 번역 기록 열람 가능
-- 변경: 관리자 전체 열람 / 근로자는 자신의 profiles.site_id와 일치하는 번역만 열람
-- ============================================================================
DROP POLICY IF EXISTS "live_translations_read_authenticated" ON public.live_translations;

CREATE POLICY "admins read all live translations"
  ON public.live_translations FOR SELECT
  TO authenticated
  USING (public.is_safelink_admin());

DROP POLICY IF EXISTS "workers read site live translations" ON public.live_translations;
CREATE POLICY "workers read site live translations"
  ON public.live_translations FOR SELECT
  TO authenticated
  USING (
    site_id = (
      SELECT site_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );


-- ============================================================================
-- C-6: sites 테이블 — SELECT 정책은 의도적 공개 유지
-- Intentionally public for authenticated users — site names are not sensitive.
-- INSERT/UPDATE/DELETE를 is_safelink_admin() 기반으로 명시적 추가
-- 기존 "System roots can manage sites" FOR ALL 정책과 충돌 방지를 위해 DROP 후 재생성
-- ============================================================================
-- SELECT 정책: 기존 그대로 유지 (의도적 공개)
DROP POLICY IF EXISTS "Anyone authenticated can view sites" ON public.sites;
CREATE POLICY "Anyone authenticated can view sites"
  ON public.sites FOR SELECT
  TO authenticated
  USING (true); -- Intentionally public for authenticated users — site names are not sensitive.

-- INSERT/UPDATE/DELETE: 관리자 전용 (기존 FOR ALL ROOT-only 정책을 범위 축소 후 교체)
DROP POLICY IF EXISTS "System roots can manage sites" ON public.sites;

DROP POLICY IF EXISTS "admins insert sites" ON public.sites;
CREATE POLICY "admins insert sites"
  ON public.sites FOR INSERT
  TO authenticated
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "admins update sites" ON public.sites;
CREATE POLICY "admins update sites"
  ON public.sites FOR UPDATE
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "admins delete sites" ON public.sites;
CREATE POLICY "admins delete sites"
  ON public.sites FOR DELETE
  TO authenticated
  USING (public.is_safelink_admin());


-- ============================================================================
-- C-13: safety_equipment_grants 레이스 컨디션 방지
-- SELECT-then-INSERT 패턴의 TOCTOU 취약점 → DB UNIQUE 제약으로 원자적 중복 방지
-- quiz_session_id 컬럼은 TEXT 타입 (claim12 원본 스키마 기준)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_grants_worker_equip_session
  ON public.safety_equipment_grants(worker_id, equipment_type, quiz_session_id)
  WHERE quiz_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_grants_worker_equip_no_session
  ON public.safety_equipment_grants(worker_id, equipment_type)
  WHERE quiz_session_id IS NULL;


-- ============================================================================
-- NFC 스티커 중복 발급 방지
-- nfc_worker_stickers: 근로자당 활성(is_active=true) 스티커 1개만 허용
-- route.ts의 revoke_previous=false 경로에서 복수 활성 스티커 발급 가능한 취약점 차단
-- ============================================================================
WITH ranked_active_stickers AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY worker_id
      ORDER BY issued_at DESC NULLS LAST, sig_version DESC, issued_epoch DESC, id DESC
    ) AS rn
  FROM public.nfc_worker_stickers
  WHERE is_active = true
)
UPDATE public.nfc_worker_stickers s
SET
  is_active = false,
  revoked_at = COALESCE(s.revoked_at, NOW()),
  revoke_reason = COALESCE(s.revoke_reason, 'auto_revoked_duplicate_active_sticker')
FROM ranked_active_stickers r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nfc_worker_stickers_active
  ON public.nfc_worker_stickers(worker_id)
  WHERE is_active = true;


COMMIT;

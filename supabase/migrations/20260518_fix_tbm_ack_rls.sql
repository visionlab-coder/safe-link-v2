-- ============================================================================
-- Fix: tbm_ack SELECT RLS — SITE_ADMIN 및 전역 관리자 조회 복구
-- Date: 2026-05-18
-- Background:
--   RLS_HARDEN_CORE_20260430.sql의 tbm_ack_select_policy가 is_site_admin()만 허용.
--   is_site_admin()은 HQ_ADMIN/SAFETY_OFFICER만 포함 — SITE_ADMIN 제외.
--   또한 전역 관리자(HQ_ADMIN, site_id=NULL)는 n.site_id = current_profile_site_id()
--   비교가 NULL = NULL로 FALSE → 조회 불가.
-- Fix:
--   is_safelink_admin() 함수(nfc_tbm_patent.sql에서 정의) 기준으로 정책 교체.
--   is_safelink_admin()은 ROOT/SUPER_ADMIN/HQ_ADMIN/HQ_OFFICER/SAFETY_OFFICER 포함.
--   SITE_ADMIN은 자신의 site와 일치하는 TBM만 조회 가능하도록 명시적으로 추가.
-- ============================================================================

-- tbm_ack SELECT: 관리자(전역 + 동일 현장) + 본인 서명 행
DROP POLICY IF EXISTS "tbm_ack_select_policy" ON public.tbm_ack;
CREATE POLICY "tbm_ack_select_policy"
  ON public.tbm_ack FOR SELECT
  TO authenticated
  USING (
    -- 본인 서명 행은 항상 볼 수 있음 (Worker용)
    auth.uid() = worker_id
    -- 전역 관리자 (ROOT, SUPER_ADMIN, HQ_ADMIN, HQ_OFFICER, SAFETY_OFFICER)
    OR public.is_safelink_admin()
    -- SITE_ADMIN: 자신의 site_id와 일치하는 TBM의 서명만 조회
    OR EXISTS (
      SELECT 1 FROM public.tbm_notices n
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE n.id = tbm_ack.tbm_id
        AND p.role = 'SITE_ADMIN'
        AND p.site_id IS NOT NULL
        AND n.site_id::text = p.site_id::text
    )
  );

-- tbm_notices SELECT: 동일하게 SITE_ADMIN 포함
DROP POLICY IF EXISTS "tbm_notices_select_policy" ON public.tbm_notices;
CREATE POLICY "tbm_notices_select_policy"
  ON public.tbm_notices FOR SELECT
  TO authenticated
  USING (
    public.is_safelink_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'SITE_ADMIN'
        AND p.site_id IS NOT NULL
        AND tbm_notices.site_id::text = p.site_id::text
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'WORKER'
        AND p.site_id IS NOT NULL
        AND tbm_notices.site_id::text = p.site_id::text
    )
  );

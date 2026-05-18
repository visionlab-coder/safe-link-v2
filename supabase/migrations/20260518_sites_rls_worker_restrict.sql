-- ============================================================================
-- H-08: sites 테이블 RLS — WORKER는 자신의 현장만 조회 가능
-- Date: 2026-05-18
-- Background:
--   sites 테이블이 모든 인증 사용자(WORKER 포함)에게 전체 현장 목록 공개.
--   전국 30개 현장 목록이 노출되어 경쟁사 정보 유출 등 비즈니스 리스크 존재.
-- Fix:
--   WORKER: profiles.site_id가 일치하는 현장만 조회 가능
--   관리자(is_safelink_admin): 전체 조회 가능
--   비인증: 접근 불가
-- ============================================================================

-- 기존 RLS 활성화 (이미 활성화됐을 수 있으므로 idempotent)
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- 기존 SELECT 정책 제거
DROP POLICY IF EXISTS "sites_select_policy" ON public.sites;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.sites;
DROP POLICY IF EXISTS "sites_authenticated_select" ON public.sites;

-- 신규 정책: 관리자는 전체, WORKER는 자신의 현장만
CREATE POLICY "sites_select_policy"
  ON public.sites FOR SELECT
  TO authenticated
  USING (
    public.is_safelink_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.site_id::text = sites.id::text
    )
  );

-- INSERT/UPDATE/DELETE: 관리자만
DROP POLICY IF EXISTS "sites_admin_write_policy" ON public.sites;
CREATE POLICY "sites_admin_write_policy"
  ON public.sites FOR ALL
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

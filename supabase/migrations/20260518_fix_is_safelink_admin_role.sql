-- ============================================================================
-- Fix: is_safelink_admin() SITE_MANAGER → SITE_ADMIN
-- Date: 2026-05-18
-- Background:
--   20260515_security_patch_rls2.sql에서 SITE_MANAGER 역할을 추가했으나
--   실제 시스템의 역할은 SITE_ADMIN임 (SITE_MANAGER는 존재하지 않는 역할).
--   이로 인해 SITE_ADMIN 사용자가 is_safelink_admin() 기반 RLS 정책 통과 불가.
-- Fix:
--   SITE_MANAGER → SITE_ADMIN 으로 수정.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_safelink_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER', 'SAFETY_OFFICER', 'SITE_ADMIN')
  );
$$;


-- ============================================================================
-- C-03: profiles INSERT 정책 강화 — 신규 설정 시 ROOT/SUPER_ADMIN 자가 부여 차단
-- Background:
--   /auth/setup 페이지가 클라이언트 Supabase로 profiles.upsert()를 직접 호출함.
--   INSERT 정책이 `auth.uid() = id`만 체크하므로 최초 설정 시 role=ROOT 삽입 가능.
-- Fix:
--   비시스템 운영자는 ROOT/SUPER_ADMIN 역할 또는 system_role 직접 삽입 불가.
-- ============================================================================
DROP POLICY IF EXISTS "profiles_insert_self_policy" ON public.profiles;
CREATE POLICY "profiles_insert_self_policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (
      -- 시스템 운영자는 모든 역할 허용
      public.is_system_operator()
      OR (
        -- 일반 사용자: 최상위 권한 역할 삽입 금지
        role NOT IN ('ROOT', 'SUPER_ADMIN')
        AND (system_role IS NULL OR system_role = '')
      )
    )
  );

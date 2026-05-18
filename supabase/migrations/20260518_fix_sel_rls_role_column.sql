-- ============================================================================
-- H-13: safety_education_library RLS — system_role → role 컬럼 수정
-- Date: 2026-05-18
-- Background:
--   20260409_safety_education_library.sql의 INSERT/UPDATE 정책이
--   profiles.system_role을 체크하지만 실제 시스템은 profiles.role을 사용.
--   system_role이 설정되지 않은 HQ_ADMIN, SAFETY_OFFICER는 라이브러리 편집 불가.
-- Fix:
--   system_role → role 컬럼으로 수정 + ROOT/SUPER_ADMIN 포함 역할 세트 일치.
-- ============================================================================

DROP POLICY IF EXISTS "sel_insert_admin" ON public.safety_education_library;
CREATE POLICY "sel_insert_admin"
  ON public.safety_education_library FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'SAFETY_OFFICER', 'SITE_ADMIN')
    )
  );

DROP POLICY IF EXISTS "sel_update_admin" ON public.safety_education_library;
CREATE POLICY "sel_update_admin"
  ON public.safety_education_library FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'SAFETY_OFFICER', 'SITE_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'SAFETY_OFFICER', 'SITE_ADMIN')
    )
  );

-- DELETE 정책 추가 (기존 마이그레이션에 누락됨)
DROP POLICY IF EXISTS "sel_delete_admin" ON public.safety_education_library;
CREATE POLICY "sel_delete_admin"
  ON public.safety_education_library FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN')
    )
  );

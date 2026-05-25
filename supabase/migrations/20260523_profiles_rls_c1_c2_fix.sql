-- ============================================================================
-- Red Team Fix C-1 + C-2: profiles RLS SELECT 범위 제한 + UPDATE 역할 컬럼 보호
-- Date: 2026-05-23
--
-- C-1: USING(true) SELECT 정책 → 본인 또는 관리자만 조회 가능
--      문제: profiles_select_authenticated(USING true)가 전체 근로자 PII 노출
--      수정: is_safelink_admin() 사용해 관리자-근로자 조회는 허용, 타 사이트 근로자 간 조회 차단
--
-- C-2: 클라이언트에서 role/system_role 컬럼 직접 UPDATE 차단
--      문제: authenticated 역할이 profiles UPDATE RLS를 통과하면 role 값 자유 변경 가능
--      수정: 컬럼 수준 REVOKE — service_role만 role/system_role 변경 가능
-- ============================================================================

-- ── C-1: SELECT 정책 교체 ───────────────────────────────────────────────────

-- 기존 전체 공개 정책 제거
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;

-- 본인 행 또는 관리자(is_safelink_admin)만 조회 허용
-- 관리자는 자신의 사이트 근로자 목록을 조회해야 하므로 관리자에게 전체 읽기 허용
-- 일반 근로자 간 상호 조회는 차단 (PII 보호)
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_safelink_admin()
  );

-- ── C-2: role / system_role 컬럼 수준 쓰기 권한 박탈 ───────────────────────

-- authenticated 역할에서 민감 컬럼 UPDATE 권한 제거
-- service_role(서버 API 전용)만 변경 가능
-- 영향 범위: setup/page.tsx의 클라이언트 upsert — /api/auth/setup-profile 서버 API로 대체 예정(C-3)
REVOKE UPDATE (role, system_role) ON profiles FROM authenticated;

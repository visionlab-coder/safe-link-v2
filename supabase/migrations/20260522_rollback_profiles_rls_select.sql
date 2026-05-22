-- profiles SELECT RLS 롤백 — 원래 상태 복구
-- 원인: 20260522_profiles_rls_hardening.sql의 profiles_select_own 정책이
--       관리자의 근로자 목록 조회(role=WORKER)를 차단
-- 결과: 관리자/근로자 로그인은 되지만 데이터가 빈 화면으로 표시
--
-- 수정: SELECT 제한 제거 → 인증된 사용자 전체 프로필 조회 허용 (원래 상태)

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

CREATE POLICY "profiles_select_authenticated"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

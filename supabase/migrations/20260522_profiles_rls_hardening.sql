-- profiles RLS hardening (레드팀 C-1, C-3 대응)
-- C-1: profiles INSERT 화이트리스트 — 본인 행만 삽입 가능
-- C-3: profiles SELECT — 본인 행만 조회 (서비스롤은 우회)

-- ────────────────────────────────────────────────────────────────
-- 1. RLS 활성화 (이미 켜진 경우 무해)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 2. SELECT 정책 — 본인 프로필만 조회
--    (서비스롤 키는 RLS를 우회하므로 서버사이드 관리 API 영향 없음)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────
-- 3. INSERT 정책 — 본인 ID로만 행 생성
--    anon 세션(미인증)에서 타인 프로필 생성 차단
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────
-- 4. UPDATE 정책 — 본인 행만 수정 (role 컬럼은 서비스롤만 변경)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

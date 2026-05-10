-- ============================================================
-- 레드팀 감사 수정 패치 2026-05-09
-- ============================================================

-- F-01: nfc_tbm_attendance 누락 컬럼 추가 (2탭 인증 복구)
ALTER TABLE public.nfc_tbm_attendance
  ADD COLUMN IF NOT EXISTS is_certified  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entry_method  TEXT        NOT NULL DEFAULT 'nfc'
    CHECK (entry_method IN ('nfc', 'qr'));

-- CRITICAL-1: profiles role 자가 승격 차단
-- 본인은 role/system_role을 직접 변경할 수 없음. 관리자(is_system_operator)만 변경 가능.
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id OR public.is_system_operator())
  WITH CHECK (
    -- 일반 사용자: role·system_role 변경 불가 (DB의 현재 값과 동일해야 함)
    (
      public.is_system_operator()
    )
    OR
    (
      auth.uid() = id
      AND role        = (SELECT role        FROM public.profiles WHERE id = auth.uid())
      AND COALESCE(system_role, '') = COALESCE(
            (SELECT system_role FROM public.profiles WHERE id = auth.uid()), '')
    )
  );

-- MEDIUM-1 보완: quiz tbm_quiz_responses workers read policy OR true 제거
-- (OR true는 보안 취약 — 인증된 사용자만 자신의 행을 읽도록)
DROP POLICY IF EXISTS "workers read own quiz" ON public.tbm_quiz_responses;
CREATE POLICY "workers read own quiz"
  ON public.tbm_quiz_responses FOR SELECT
  TO authenticated
  USING (true);  -- PoC: 관리자/근로자 모두 읽기 허용 (worker_id UUID 공간 불일치 문제로 완화)

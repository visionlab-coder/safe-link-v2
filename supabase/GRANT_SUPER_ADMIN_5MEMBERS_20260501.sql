-- GRANT_SUPER_ADMIN_5MEMBERS_20260501.sql
-- Purpose: Grant SUPER_ADMIN to 5 members (김무빈/천지연/임성윤/박순기/조재훈)
-- Apply: Run STEP 1 → verify exactly 5 rows → fill in emails → run STEP 2 → verify
-- Decided by: 김무빈 차장 (2026-05-01)
--
-- ⚠️ 주의: Supabase Studio SQL Editor에서 실행 권장 (service_role 직접 사용 금지)
-- ⚠️ STEP 1 결과가 정확히 5건인지 반드시 확인 후 STEP 2 실행

-- ──────────────────────────────────────────────────────────────
-- STEP 1: 대상 5명 확인 (먼저 실행 — 결과 검토 필수)
-- ──────────────────────────────────────────────────────────────
select id, email, display_name, role
from public.profiles
where email in (
  'visionlab@seowonenc.co.kr',   -- 김무빈
  '<천지연_이메일>',              -- 채워넣을 것
  '<임성윤_이메일>',              -- 채워넣을 것
  '<박순기_이메일>',              -- 채워넣을 것
  '<조재훈_이메일>'               -- 채워넣을 것
)
or display_name in ('김무빈', '천지연', '임성윤', '박순기', '조재훈');

-- ──────────────────────────────────────────────────────────────
-- STEP 2: SUPER_ADMIN 부여 (STEP 1에서 정확히 5건 확인 후 실행)
--         이메일을 실제 값으로 교체한 후 실행할 것
-- ──────────────────────────────────────────────────────────────
update public.profiles
set
  role = 'SUPER_ADMIN',
  updated_at = now()
where email in (
  'visionlab@seowonenc.co.kr',   -- 김무빈
  '<천지연_이메일>',              -- 채워넣을 것
  '<임성윤_이메일>',              -- 채워넣을 것
  '<박순기_이메일>',              -- 채워넣을 것
  '<조재훈_이메일>'               -- 채워넣을 것
)
or display_name in ('김무빈', '천지연', '임성윤', '박순기', '조재훈');

-- ──────────────────────────────────────────────────────────────
-- STEP 3: 결과 검증 (UPDATE 직후 실행 — 정확히 5건이어야 함)
-- ──────────────────────────────────────────────────────────────
select email, display_name, role, updated_at
from public.profiles
where role = 'SUPER_ADMIN'
order by display_name;
-- 기대 결과: 정확히 5건 (김무빈, 박순기, 임성윤, 조재훈, 천지연 — 가나다순)

-- ──────────────────────────────────────────────────────────────
-- ROLLBACK (필요 시 — 이메일 실제 값으로 교체 후 사용):
-- update public.profiles
-- set role = 'HQ_ADMIN', updated_at = now()
-- where email in (
--   'visionlab@seowonenc.co.kr',
--   '<천지연_이메일>',
--   '<임성윤_이메일>',
--   '<박순기_이메일>',
--   '<조재훈_이메일>'
-- )
-- or display_name in ('김무빈', '천지연', '임성윤', '박순기', '조재훈');

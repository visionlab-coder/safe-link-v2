-- profiles.role 컬럼 CHECK 제약
-- 유효하지 않은 역할(예: MANAGER, ADMIN 오타 등)이 DB에 저장되는 것을 원천 차단.
-- 이 제약 없이는 서비스 관리자가 직접 API로 임의 역할을 넣을 수 있어
-- 미들웨어 역할 체크를 우회하거나(영구 리다이렉트 루프) SaaS 권한 체계가 무너질 수 있음.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_valid
  CHECK (role IN (
    'HQ_ADMIN',
    'SAFETY_OFFICER',
    'SITE_ADMIN',
    'WORKER',
    'ROOT',
    'HQ_OFFICER',
    'SUPER_ADMIN'
  ));

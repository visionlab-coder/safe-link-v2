-- RLS_SUPER_ADMIN_PATCH_20260501.sql
-- Purpose: Extend RLS helpers to support SUPER_ADMIN tier (added 2026-05-01)
-- Apply: Staging first → verify worker/site_manager/HQ_ADMIN/SUPER_ADMIN flows → production
-- Author: 김무빈 (서원토건 미래전략TF)
--
-- Prerequisite: RLS_HARDEN_CORE_20260430.sql must already be applied.
-- This patch does NOT modify that file — uses CREATE OR REPLACE only.

-- 1. current_user_role(): 호출 사용자의 role 반환 (current_profile_role 별칭/표준화)
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- 2. is_admin(): HQ_ADMIN 또는 SUPER_ADMIN이면 true
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_user_role() in ('HQ_ADMIN', 'SUPER_ADMIN'), false);
$$;

-- 3. is_super_admin(): SUPER_ADMIN만 true
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_user_role() = 'SUPER_ADMIN', false);
$$;

-- 4. is_system_operator() 확장: SUPER_ADMIN 포함 (기존: ROOT, HQ_OFFICER)
create or replace function public.is_system_operator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_user_role() in ('ROOT', 'HQ_OFFICER', 'SUPER_ADMIN'), false);
$$;

-- VERIFY (실행 전 주석 해제):
-- select current_user_role(), is_admin(), is_super_admin(), is_system_operator();
--
-- 기대 결과 (SUPER_ADMIN 계정으로 실행 시):
--   current_user_role | is_admin | is_super_admin | is_system_operator
--   SUPER_ADMIN       | true     | true           | true

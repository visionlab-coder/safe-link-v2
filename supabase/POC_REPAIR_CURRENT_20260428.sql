-- SAFE-LINK V2 PoC targeted repair
-- Generated from live precheck on 2026-04-28.
-- Applies only the columns currently missing in the remote project.

alter table public.tbm_notices add column if not exists site_code text;
alter table public.tbm_notices add column if not exists title text;
alter table public.tbm_notices add column if not exists risk_level text;

alter table public.tbm_ack add column if not exists worker_name text;
alter table public.tbm_ack add column if not exists signed_at timestamptz;
alter table public.tbm_ack add column if not exists created_at timestamptz not null default now();

notify pgrst, 'reload schema';

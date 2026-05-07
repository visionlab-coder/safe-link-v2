-- SAFE-LINK V2 PoC minimal repair
-- Purpose: additive-only schema repair for the core PoC flows.
-- Safe usage: review first, then run in a staging or preview database before production.

create extension if not exists pgcrypto;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text,
  code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  role text,
  system_role text,
  preferred_lang text default 'ko',
  phone_number text,
  trade text,
  title text,
  site_code text,
  site_id uuid references public.sites(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists system_role text;
alter table public.profiles add column if not exists preferred_lang text default 'ko';
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists trade text;
alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists site_code text;
alter table public.profiles add column if not exists site_id uuid references public.sites(id) on delete set null;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tbm_notices (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  site_code text,
  title text,
  content_ko text not null,
  created_by uuid,
  risk_level text,
  created_at timestamptz not null default now()
);

alter table public.tbm_notices add column if not exists site_id uuid references public.sites(id) on delete set null;
alter table public.tbm_notices add column if not exists site_code text;
alter table public.tbm_notices add column if not exists title text;
alter table public.tbm_notices add column if not exists content_ko text;
alter table public.tbm_notices add column if not exists created_by uuid;
alter table public.tbm_notices add column if not exists risk_level text;
alter table public.tbm_notices add column if not exists created_at timestamptz not null default now();

create table if not exists public.tbm_ack (
  id uuid primary key default gen_random_uuid(),
  tbm_id uuid not null references public.tbm_notices(id) on delete cascade,
  worker_id uuid not null,
  worker_name text,
  signature_data text,
  ack_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tbm_ack add column if not exists tbm_id uuid references public.tbm_notices(id) on delete cascade;
alter table public.tbm_ack add column if not exists worker_id uuid;
alter table public.tbm_ack add column if not exists worker_name text;
alter table public.tbm_ack add column if not exists signature_data text;
alter table public.tbm_ack add column if not exists ack_at timestamptz;
alter table public.tbm_ack add column if not exists signed_at timestamptz;
alter table public.tbm_ack add column if not exists created_at timestamptz not null default now();

create unique index if not exists tbm_ack_unique_worker_per_tbm
  on public.tbm_ack (tbm_id, worker_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  from_user uuid not null,
  to_user uuid not null,
  source_lang text,
  target_lang text,
  source_text text not null,
  translated_text text,
  audio_url text,
  is_read boolean not null default false,
  ai_analysis text,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists site_id uuid references public.sites(id) on delete set null;
alter table public.messages add column if not exists from_user uuid;
alter table public.messages add column if not exists to_user uuid;
alter table public.messages add column if not exists source_lang text;
alter table public.messages add column if not exists target_lang text;
alter table public.messages add column if not exists source_text text;
alter table public.messages add column if not exists translated_text text;
alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists is_read boolean not null default false;
alter table public.messages add column if not exists ai_analysis text;
alter table public.messages add column if not exists created_at timestamptz not null default now();

create index if not exists messages_to_user_created_at_idx
  on public.messages (to_user, created_at desc);

create index if not exists messages_site_id_created_at_idx
  on public.messages (site_id, created_at desc);

create table if not exists public.construction_glossary (
  id uuid primary key default gen_random_uuid(),
  slang text not null,
  standard text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.construction_glossary add column if not exists slang text;
alter table public.construction_glossary add column if not exists standard text;
alter table public.construction_glossary add column if not exists is_active boolean not null default true;
alter table public.construction_glossary add column if not exists created_at timestamptz not null default now();

create index if not exists construction_glossary_active_idx
  on public.construction_glossary (is_active);

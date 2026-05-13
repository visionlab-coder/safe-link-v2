-- Fix: construction_glossary RLS policy used role = 'ADMIN' (never matched)
-- Actual role values are: HQ_ADMIN, SAFETY_OFFICER, HQ_OFFICER, ROOT, SUPER_ADMIN
-- This migration drops the broken policy and creates correct ones.

drop policy if exists "admin_can_manage_glossary" on public.construction_glossary;
drop policy if exists "admin_can_manage_translations" on public.site_term_translations;

create policy "admin_can_manage_glossary"
on public.construction_glossary
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
  )
);

create policy "admin_can_manage_translations"
on public.site_term_translations
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
  )
);

notify pgrst, 'reload schema';

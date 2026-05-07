-- SAFE-LINK V2 core RLS hardening
-- Draft for commercialization-stage review.
-- Apply in staging first, then verify admin/worker/system flows before production rollout.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.current_profile_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select site_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.is_system_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('ROOT', 'HQ_OFFICER'), false);
$$;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('HQ_ADMIN', 'SAFETY_OFFICER'), false);
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_policy" on public.profiles;
create policy "profiles_select_policy"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_system_operator()
  or (
    public.is_site_admin()
    and site_id = public.current_profile_site_id()
  )
);

drop policy if exists "profiles_insert_self_policy" on public.profiles;
create policy "profiles_insert_self_policy"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_policy" on public.profiles;
create policy "profiles_update_policy"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_system_operator()
)
with check (
  auth.uid() = id
  or public.is_system_operator()
);

alter table public.tbm_notices enable row level security;

drop policy if exists "tbm_notices_select_policy" on public.tbm_notices;
create policy "tbm_notices_select_policy"
on public.tbm_notices
for select
to authenticated
using (
  public.is_system_operator()
  or site_id = public.current_profile_site_id()
);

drop policy if exists "tbm_notices_insert_policy" on public.tbm_notices;
create policy "tbm_notices_insert_policy"
on public.tbm_notices
for insert
to authenticated
with check (
  public.is_system_operator()
  or (
    public.is_site_admin()
    and site_id = public.current_profile_site_id()
  )
);

drop policy if exists "tbm_notices_update_policy" on public.tbm_notices;
create policy "tbm_notices_update_policy"
on public.tbm_notices
for update
to authenticated
using (
  public.is_system_operator()
  or (
    public.is_site_admin()
    and site_id = public.current_profile_site_id()
  )
)
with check (
  public.is_system_operator()
  or (
    public.is_site_admin()
    and site_id = public.current_profile_site_id()
  )
);

alter table public.tbm_ack enable row level security;

drop policy if exists "tbm_ack_select_policy" on public.tbm_ack;
create policy "tbm_ack_select_policy"
on public.tbm_ack
for select
to authenticated
using (
  auth.uid() = worker_id
  or public.is_system_operator()
  or exists (
    select 1
    from public.tbm_notices n
    where n.id = tbm_ack.tbm_id
      and public.is_site_admin()
      and n.site_id = public.current_profile_site_id()
  )
);

drop policy if exists "tbm_ack_insert_policy" on public.tbm_ack;
create policy "tbm_ack_insert_policy"
on public.tbm_ack
for insert
to authenticated
with check (
  auth.uid() = worker_id
  and exists (
    select 1
    from public.tbm_notices n
    where n.id = tbm_ack.tbm_id
      and n.site_id = public.current_profile_site_id()
  )
);

drop policy if exists "tbm_ack_update_policy" on public.tbm_ack;
create policy "tbm_ack_update_policy"
on public.tbm_ack
for update
to authenticated
using (
  public.is_system_operator()
)
with check (
  public.is_system_operator()
);

alter table public.messages enable row level security;

drop policy if exists "Users can see their own messages" on public.messages;
drop policy if exists "Users can insert their own messages" on public.messages;
drop policy if exists "messages_select_policy" on public.messages;
create policy "messages_select_policy"
on public.messages
for select
to authenticated
using (
  auth.uid() = from_user
  or auth.uid() = to_user
  or public.is_system_operator()
);

drop policy if exists "messages_insert_policy" on public.messages;
create policy "messages_insert_policy"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = from_user
  and (
    public.is_system_operator()
    or site_id is null
    or site_id = public.current_profile_site_id()
  )
);

drop policy if exists "messages_update_policy" on public.messages;
create policy "messages_update_policy"
on public.messages
for update
to authenticated
using (
  auth.uid() = to_user
  or public.is_system_operator()
)
with check (
  auth.uid() = to_user
  or public.is_system_operator()
);

alter table public.construction_glossary enable row level security;
alter table public.site_term_translations enable row level security;

drop policy if exists "anyone_can_read_glossary" on public.construction_glossary;
create policy "anyone_can_read_glossary"
on public.construction_glossary
for select
to authenticated
using (true);

drop policy if exists "admin_can_manage_glossary" on public.construction_glossary;
create policy "admin_can_manage_glossary"
on public.construction_glossary
for all
to authenticated
using (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
)
with check (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
);

drop policy if exists "anyone_can_read_translations" on public.site_term_translations;
create policy "anyone_can_read_translations"
on public.site_term_translations
for select
to authenticated
using (true);

drop policy if exists "admin_can_manage_translations" on public.site_term_translations;
create policy "admin_can_manage_translations"
on public.site_term_translations
for all
to authenticated
using (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
)
with check (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
);

alter table public.safety_education_library enable row level security;

drop policy if exists "sel_read_authenticated" on public.safety_education_library;
create policy "sel_read_authenticated"
on public.safety_education_library
for select
to authenticated
using (true);

drop policy if exists "sel_insert_admin" on public.safety_education_library;
create policy "sel_insert_admin"
on public.safety_education_library
for insert
to authenticated
with check (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
);

drop policy if exists "sel_update_admin" on public.safety_education_library;
create policy "sel_update_admin"
on public.safety_education_library
for update
to authenticated
using (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
)
with check (
  public.current_profile_role() in ('ROOT', 'HQ_OFFICER', 'HQ_ADMIN', 'SAFETY_OFFICER')
);

alter table public.live_translations enable row level security;

drop policy if exists "live_translations_read_authenticated" on public.live_translations;
create policy "live_translations_read_authenticated"
on public.live_translations
for select
to authenticated
using (
  public.is_system_operator()
  or site_id = public.current_profile_site_id()
);

drop policy if exists "live_translations_insert_admin" on public.live_translations;
create policy "live_translations_insert_admin"
on public.live_translations
for insert
to authenticated
with check (
  public.is_system_operator()
  or (
    public.is_site_admin()
    and site_id = public.current_profile_site_id()
  )
);

notify pgrst, 'reload schema';

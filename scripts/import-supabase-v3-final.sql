\set ON_ERROR_STOP on

\if :{?batch_id}
\else
  \echo 'batch_id is required: psql -v batch_id=<id> -v apply=false -f scripts/import-supabase-v3-final.sql'
  \quit
\endif

\if :{?apply}
\else
  \set apply false
\endif

begin;

select set_config('app.migration_batch_id', :'batch_id', true);

do $$
declare
    wanted_batch_id bigint := current_setting('app.migration_batch_id')::bigint;
begin
    if not exists (
        select 1
        from legacy_supabase_import_batches
        where id = wanted_batch_id
    ) then
        raise exception 'legacy_batch_not_found:%', wanted_batch_id;
    end if;

    if exists (
        select 1
        from legacy_supabase_entity_mappings
        where batch_id = wanted_batch_id
    ) then
        raise exception 'legacy_batch_already_migrated:%', wanted_batch_id;
    end if;
end
$$;

create or replace function pg_temp.legacy_target_id(
    wanted_source_table text,
    wanted_source_id text,
    wanted_target_table text
) returns bigint
language sql
stable
as $$
    select mapping.target_id::bigint
    from legacy_supabase_entity_mappings mapping
    where mapping.batch_id = current_setting('app.migration_batch_id')::bigint
      and mapping.source_table = wanted_source_table
      and mapping.source_id = wanted_source_id
      and mapping.target_table = wanted_target_table
      and mapping.mapping_status in ('MAPPED', 'IMPORTED')
    limit 1
$$;

-- A non-login identity owns records whose original actor is absent.
insert into users(email, display_name, preferred_language, account_status)
values (
    'legacy-migration@safe-link.invalid',
    'Legacy Supabase migration',
    'ko',
    'DEACTIVATED'
)
on conflict (email) do nothing;

-- Sites
insert into sites(
    organization_id,
    name,
    address,
    status,
    created_at,
    latitude,
    longitude,
    geofence_radius_m,
    site_code
)
select
    1,
    record.payload ->> 'name',
    coalesce(
        nullif(record.payload ->> 'address', ''),
        nullif(record.payload ->> 'location', '')
    ),
    'ACTIVE',
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    nullif(record.payload ->> 'latitude', '')::double precision,
    nullif(record.payload ->> 'longitude', '')::double precision,
    coalesce(nullif(record.payload ->> 'geofence_radius_m', '')::integer, 300),
    coalesce(nullif(record.payload ->> 'site_code', ''), nullif(record.payload ->> 'code', ''))
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'sites'
  and not exists (
      select 1
      from sites target
      where target.site_code = coalesce(
          nullif(record.payload ->> 'site_code', ''),
          nullif(record.payload ->> 'code', '')
      )
         or target.name = record.payload ->> 'name'
  );

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'sites',
    target.id::text,
    'IMPORTED',
    case
        when target.site_code = coalesce(
            nullif(record.payload ->> 'site_code', ''),
            nullif(record.payload ->> 'code', '')
        ) then 'site_code'
        else 'name'
    end
from legacy_supabase_import_records record
join lateral (
    select site.*
    from sites site
    where site.site_code = coalesce(
            nullif(record.payload ->> 'site_code', ''),
            nullif(record.payload ->> 'code', '')
        )
       or site.name = record.payload ->> 'name'
    order by
        case when site.site_code = coalesce(
            nullif(record.payload ->> 'site_code', ''),
            nullif(record.payload ->> 'code', '')
        ) then 0 else 1 end,
        site.id
    limit 1
) target on true
where record.batch_id = :batch_id
  and record.source_table = 'sites';

-- Auth identities. Supabase Admin API does not expose password hashes, so
-- non-worker accounts require a controlled password reset after migration.
with profile_source as (
    select
        record.source_id,
        record.payload
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table = 'profiles'
)
insert into users(
    email,
    phone,
    display_name,
    preferred_language,
    account_status,
    created_at
)
select
    coalesce(
        nullif(auth.email, ''),
        case
            when nullif(auth.phone, '') is null
            then 'legacy-auth-' || auth.source_user_id::text || '@safe-link.invalid'
        end
    ),
    case
        when nullif(auth.phone, '') is not null
         and not exists (select 1 from users user_by_phone where user_by_phone.phone = auth.phone)
        then auth.phone
        else null
    end,
    coalesce(
        nullif(profile.payload ->> 'display_name', ''),
        nullif(auth.user_metadata ->> 'display_name', ''),
        nullif(split_part(auth.email, '@', 1), ''),
        'Legacy user'
    ),
    coalesce(
        nullif(profile.payload ->> 'preferred_lang', ''),
        nullif(profile.payload ->> 'language', ''),
        'ko'
    ),
    case
        when profile.source_id is null then 'DEACTIVATED'
        when upper(coalesce(profile.payload ->> 'role', '')) = 'DEACTIVATED' then 'DEACTIVATED'
        else 'ACTIVE'
    end,
    coalesce(auth.created_at, now())
from legacy_supabase_auth_users auth
left join profile_source profile
  on profile.source_id = auth.source_user_id::text
where auth.batch_id = :batch_id
  and not exists (
      select 1
      from users target
      where (
          auth.email is not null
          and lower(target.email) = lower(auth.email)
      )
         or (
          nullif(auth.phone, '') is not null
          and target.phone = auth.phone
      )
  );

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    auth.batch_id,
    'auth.users',
    auth.source_user_id::text,
    'users',
    target.id::text,
    'IMPORTED',
    case
        when auth.email is not null and lower(target.email) = lower(auth.email) then 'email'
        when nullif(auth.phone, '') is not null and target.phone = auth.phone then 'phone'
        else 'generated_email'
    end
from legacy_supabase_auth_users auth
join lateral (
    select app_user.*
    from users app_user
    where (
        auth.email is not null
        and lower(app_user.email) = lower(auth.email)
    )
       or (
        nullif(auth.phone, '') is not null
        and app_user.phone = auth.phone
    )
       or app_user.email = 'legacy-auth-' || auth.source_user_id::text || '@safe-link.invalid'
    order by
        case when auth.email is not null and lower(app_user.email) = lower(auth.email) then 0 else 1 end,
        app_user.id
    limit 1
) target on true
where auth.batch_id = :batch_id;

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'users',
    auth_map.target_id,
    'MAPPED',
    'auth_user_id'
from legacy_supabase_import_records record
join legacy_supabase_entity_mappings auth_map
  on auth_map.batch_id = record.batch_id
 and auth_map.source_table = 'auth.users'
 and auth_map.source_id = record.source_id
 and auth_map.target_table = 'users'
where record.batch_id = :batch_id
  and record.source_table = 'profiles';

insert into legacy_supabase_migration_issues(
    batch_id,
    source_table,
    source_id,
    issue_code,
    severity,
    details
)
select
    :batch_id,
    'auth.users',
    auth.source_user_id::text,
    'CREDENTIAL_RESET_REQUIRED',
    'WARNING',
    jsonb_build_object('reason', 'supabase_admin_export_omits_password_hash')
from legacy_supabase_auth_users auth
join legacy_supabase_entity_mappings mapping
  on mapping.batch_id = auth.batch_id
 and mapping.source_table = 'auth.users'
 and mapping.source_id = auth.source_user_id::text
 and mapping.target_table = 'users'
left join user_credentials credential
  on credential.user_id = mapping.target_id::bigint
where auth.batch_id = :batch_id
  and credential.user_id is null;

-- Some NFC workers were created without a Supabase Auth identity. Create
-- deactivated non-login identities so their historical records remain linked.
insert into users(
    email, phone, display_name, preferred_language, account_status, created_at
)
select
    'legacy-worker-' || record.source_id || '@safe-link.invalid',
    case
        when nullif(record.payload ->> 'phone', '') is not null
         and not exists (
             select 1 from users target
             where target.phone = record.payload ->> 'phone'
         )
        then record.payload ->> 'phone'
        else null
    end,
    coalesce(
        nullif(record.payload ->> 'display_name', ''),
        nullif(record.payload ->> 'full_name', ''),
        'Legacy worker'
    ),
    coalesce(nullif(record.payload ->> 'preferred_lang', ''), 'ko'),
    'DEACTIVATED',
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_workers'
  and coalesce(
      pg_temp.legacy_target_id(
          'auth.users',
          nullif(record.payload ->> 'auth_user_id', ''),
          'users'
      ),
      pg_temp.legacy_target_id('auth.users', record.source_id, 'users')
  ) is null
  and not exists (
      select 1 from users target
      where target.email = 'legacy-worker-' || record.source_id || '@safe-link.invalid'
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'users', target.id::text, 'IMPORTED', 'generated_non_login_identity'
from legacy_supabase_import_records record
join users target
  on target.email = 'legacy-worker-' || record.source_id || '@safe-link.invalid'
where record.batch_id = :batch_id
  and record.source_table = 'nfc_workers'
  and coalesce(
      pg_temp.legacy_target_id(
          'auth.users',
          nullif(record.payload ->> 'auth_user_id', ''),
          'users'
      ),
      pg_temp.legacy_target_id('auth.users', record.source_id, 'users')
  ) is null;

-- Role Contract normalization
with normalized_roles as (
    select
        record.source_id,
        pg_temp.legacy_target_id('profiles', record.source_id, 'users') as user_id,
        case
            when upper(coalesce(record.payload ->> 'system_role', '')) = 'ROOT' then 'HQ_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'ROOT' then 'HQ_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'SUPER_ADMIN' then 'HQ_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'HQ_ADMIN' then 'HQ_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'SITE_ADMIN' then 'SITE_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'SAFETY_OFFICER' then 'SAFETY_MANAGER'
            when upper(coalesce(record.payload ->> 'role', '')) = 'WORKER' then 'WORKER'
            else null
        end as target_role,
        record.payload
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table = 'profiles'
)
insert into user_roles(user_id, role, granted_by, granted_at)
select
    normalized.user_id,
    normalized.target_role,
    (select id from users where email = 'legacy-migration@safe-link.invalid'),
    coalesce(nullif(normalized.payload ->> 'created_at', '')::timestamptz, now())
from normalized_roles normalized
where normalized.user_id is not null
  and normalized.target_role is not null
  and not exists (
      select 1
      from user_roles active_user_role
      where active_user_role.user_id = normalized.user_id
        and active_user_role.role = normalized.target_role
        and active_user_role.revoked_at is null
  );

insert into legacy_supabase_migration_issues(
    batch_id,
    source_table,
    source_id,
    issue_code,
    severity,
    details
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'ROOT_REAPPROVAL_REQUIRED',
    'WARNING',
    jsonb_build_object(
        'source_role', record.payload ->> 'role',
        'source_system_role', record.payload ->> 'system_role',
        'temporary_target_role', 'HQ_ADMIN'
    )
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'profiles'
  and (
      upper(coalesce(record.payload ->> 'system_role', '')) = 'ROOT'
      or upper(coalesce(record.payload ->> 'role', '')) = 'ROOT'
  );

with memberships as (
    select
        pg_temp.legacy_target_id('profiles', record.source_id, 'users') as user_id,
        pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') as site_id,
        case
            when upper(coalesce(record.payload ->> 'role', '')) = 'SITE_ADMIN' then 'SITE_ADMIN'
            when upper(coalesce(record.payload ->> 'role', '')) = 'SAFETY_OFFICER' then 'SAFETY_MANAGER'
            when upper(coalesce(record.payload ->> 'role', '')) = 'WORKER' then 'WORKER'
            else null
        end as target_role,
        coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()) as created_at
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table = 'profiles'
)
insert into site_memberships(user_id, site_id, role, status, created_at)
select user_id, site_id, target_role, 'ACTIVE', created_at
from memberships
where user_id is not null
  and site_id is not null
  and target_role is not null
on conflict (user_id, site_id, role) do nothing;

-- Worker profiles from legacy NFC worker identities
insert into worker_profiles(
    user_id,
    worker_code,
    nationality,
    phone,
    trade,
    consent_signed_at,
    consent_doc_url,
    notes,
    is_active,
    nationality_confirmed_at,
    created_by,
    created_at,
    updated_at
)
select
    coalesce(
        pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'auth_user_id', ''), 'users'),
        pg_temp.legacy_target_id('auth.users', record.source_id, 'users'),
        pg_temp.legacy_target_id('nfc_workers', record.source_id, 'users')
    ),
    coalesce(
        nullif(record.payload ->> 'worker_code', ''),
        'legacy-' || left(replace(record.source_id, '-', ''), 20)
    ),
    case
        when upper(coalesce(record.payload ->> 'nationality', '')) ~ '^[A-Z]{2}$'
        then upper(record.payload ->> 'nationality')
        else 'KR'
    end,
    nullif(record.payload ->> 'phone', ''),
    case
        when lower(coalesce(record.payload ->> 'trade', '')) ~ '^[a-z0-9_-]{1,32}$'
        then lower(record.payload ->> 'trade')
        else 'general'
    end,
    nullif(record.payload ->> 'consent_signed_at', '')::timestamptz,
    nullif(record.payload ->> 'consent_doc_url', ''),
    nullif(record.payload ->> 'notes', ''),
    coalesce((record.payload ->> 'is_active')::boolean, true),
    nullif(record.payload ->> 'nationality_confirmed_at', '')::timestamptz,
    coalesce(
        pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'created_by', ''), 'users'),
        (select id from users where email = 'legacy-migration@safe-link.invalid')
    ),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'updated_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_workers'
  and coalesce(
      pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'auth_user_id', ''), 'users'),
      pg_temp.legacy_target_id('auth.users', record.source_id, 'users'),
      pg_temp.legacy_target_id('nfc_workers', record.source_id, 'users')
  ) is not null
on conflict (user_id) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'worker_profiles',
    profile.user_id::text,
    'IMPORTED',
    'auth_user_id'
from legacy_supabase_import_records record
join worker_profiles profile
  on profile.user_id = coalesce(
      pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'auth_user_id', ''), 'users'),
      pg_temp.legacy_target_id('auth.users', record.source_id, 'users'),
      pg_temp.legacy_target_id('nfc_workers', record.source_id, 'users')
  )
where record.batch_id = :batch_id
  and record.source_table = 'nfc_workers';

with worker_memberships as (
    select
        pg_temp.legacy_target_id('nfc_workers', record.source_id, 'worker_profiles') as user_id,
        pg_temp.legacy_target_id(
            'sites',
            coalesce(
                nullif(record.payload ->> 'assigned_site_id', ''),
                nullif(record.payload ->> 'site_id', '')
            ),
            'sites'
        ) as site_id,
        coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()) as created_at
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table = 'nfc_workers'
)
insert into site_memberships(user_id, site_id, role, status, created_at)
select user_id, site_id, 'WORKER', 'ACTIVE', created_at
from worker_memberships
where user_id is not null
  and site_id is not null
on conflict (user_id, site_id, role) do nothing;

insert into user_roles(user_id, role, granted_by, granted_at)
select
    mapping.target_id::bigint,
    'WORKER',
    (select id from users where email = 'legacy-migration@safe-link.invalid'),
    now()
from legacy_supabase_entity_mappings mapping
where mapping.batch_id = :batch_id
  and mapping.source_table = 'nfc_workers'
  and mapping.target_table = 'worker_profiles'
  and not exists (
      select 1
      from user_roles role
      where role.user_id = mapping.target_id::bigint
        and role.role = 'WORKER'
        and role.revoked_at is null
  );

insert into worker_quick_login_credentials(
    user_id,
    name_initials,
    phone_last4,
    enabled,
    updated_at
)
select
    pg_temp.legacy_target_id('nfc_workers', record.source_id, 'worker_profiles'),
    upper(record.payload ->> 'name_initials'),
    record.payload ->> 'phone_last4',
    coalesce((record.payload ->> 'is_active')::boolean, true),
    coalesce(nullif(record.payload ->> 'updated_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_workers'
  and upper(coalesce(record.payload ->> 'name_initials', '')) ~ '^[A-Z0-9]{1,6}$'
  and coalesce(record.payload ->> 'phone_last4', '') ~ '^[0-9]{4}$'
  and pg_temp.legacy_target_id('nfc_workers', record.source_id, 'worker_profiles') is not null
on conflict (user_id) do update
set name_initials = excluded.name_initials,
    phone_last4 = excluded.phone_last4,
    enabled = excluded.enabled,
    updated_at = excluded.updated_at;

-- Some historical worker references point to Auth users that have no
-- nfc_workers row. Preserve those relations with a deactivated, explicitly
-- flagged worker profile instead of assigning them to another person.
create temporary table qa_referenced_workers on commit drop as
with raw_refs as (
    select
        record.source_table,
        record.source_id as record_id,
        record.payload ->> 'worker_id' as source_worker_id,
        case
            when record.source_table = 'tbm_ack' then (
                select coalesce(
                    pg_temp.legacy_target_id(
                        'sites',
                        notice.payload ->> 'site_id',
                        'sites'
                    ),
                    (
                        select id from sites
                        where site_code = 'LEGACY-UNASSIGNED-B' || :batch_id
                    )
                )
                from legacy_supabase_import_records notice
                where notice.batch_id = record.batch_id
                  and notice.source_table = 'tbm_notices'
                  and notice.source_id = record.payload ->> 'tbm_id'
                limit 1
            )
            else pg_temp.legacy_target_id('sites', nullif(record.payload ->> 'site_id', ''), 'sites')
        end as site_id
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table in (
          'tbm_ack',
          'claim13_pledges',
          'claim17_stop_work_interventions',
          'safety_equipment_grants',
          'stop_work_alerts',
          'tbm_quiz_responses',
          'nfc_worker_daily_access',
          'nfc_tbm_attendance'
      )
      and nullif(record.payload ->> 'worker_id', '') is not null
),
resolved as (
    select
        raw_refs.*,
        coalesce(
            pg_temp.legacy_target_id('auth.users', raw_refs.source_worker_id, 'users'),
            pg_temp.legacy_target_id('nfc_workers', raw_refs.source_worker_id, 'worker_profiles')
        ) as user_id
    from raw_refs
)
select distinct on (user_id)
    source_worker_id,
    user_id,
    site_id
from resolved
where user_id is not null
order by user_id, site_id nulls last;

insert into worker_profiles(
    user_id,
    worker_code,
    nationality,
    trade,
    notes,
    is_active,
    created_by
)
select
    referenced.user_id,
    'legacy-ref-' || left(replace(referenced.source_worker_id, '-', ''), 20),
    'KR',
    'general',
    'Legacy reference-only worker identity; manual review required',
    false,
    (select id from users where email = 'legacy-migration@safe-link.invalid')
from qa_referenced_workers referenced
where not exists (
    select 1
    from worker_profiles profile
    where profile.user_id = referenced.user_id
)
on conflict (worker_code) do nothing;

insert into user_roles(user_id, role, granted_by, granted_at)
select
    referenced.user_id,
    'WORKER',
    (select id from users where email = 'legacy-migration@safe-link.invalid'),
    now()
from qa_referenced_workers referenced
where not exists (
    select 1
    from user_roles role
    where role.user_id = referenced.user_id
      and role.role = 'WORKER'
      and role.revoked_at is null
);

insert into site_memberships(user_id, site_id, role, status, created_at)
select referenced.user_id, referenced.site_id, 'WORKER', 'ACTIVE', now()
from qa_referenced_workers referenced
where referenced.site_id is not null
on conflict (user_id, site_id, role) do nothing;

insert into legacy_supabase_migration_issues(
    batch_id,
    source_table,
    source_id,
    issue_code,
    severity,
    details
)
select
    :batch_id,
    'auth.users',
    referenced.source_worker_id,
    'REFERENCE_ONLY_WORKER_PROFILE',
    'WARNING',
    jsonb_build_object(
        'target_user_id', referenced.user_id,
        'reason', 'worker_reference_without_nfc_worker_profile'
    )
from qa_referenced_workers referenced
where not exists (
    select 1
    from legacy_supabase_entity_mappings worker_mapping
    where worker_mapping.batch_id = :batch_id
      and worker_mapping.source_table = 'nfc_workers'
      and worker_mapping.source_id = referenced.source_worker_id
      and worker_mapping.target_table = 'worker_profiles'
);

-- TBM notices
insert into sites(
    organization_id, name, address, status, site_code
)
select
    1,
    'Legacy unassigned records (batch ' || :batch_id || ')',
    'Imported records awaiting site reassignment',
    'ARCHIVED',
    'LEGACY-UNASSIGNED-B' || :batch_id
where exists (
    select 1
    from legacy_supabase_import_records record
    where record.batch_id = :batch_id
      and record.source_table = 'tbm_notices'
      and nullif(record.payload ->> 'site_id', '') is null
)
  and not exists (
      select 1 from sites
      where site_code = 'LEGACY-UNASSIGNED-B' || :batch_id
  );

insert into tbm_notices(
    site_id,
    created_by,
    title,
    source_text,
    normalized_text,
    status,
    published_at,
    created_at
)
select
    coalesce(
        pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
        (select id from sites where site_code = 'LEGACY-UNASSIGNED-B' || :batch_id)
    ),
    coalesce(
        pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'created_by', ''), 'users'),
        (select id from users where email = 'legacy-migration@safe-link.invalid')
    ),
    coalesce(nullif(record.payload ->> 'title', ''), 'TBM'),
    coalesce(nullif(record.payload ->> 'content_ko', ''), '-'),
    nullif(record.payload ->> 'content_ko', ''),
    'PUBLISHED',
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'tbm_notices'
  and coalesce(
      pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
      (select id from sites where site_code = 'LEGACY-UNASSIGNED-B' || :batch_id)
  ) is not null;

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'tbm_notices',
    target.id::text,
    'IMPORTED',
    'site_created_at_content'
from legacy_supabase_import_records record
join tbm_notices target
  on target.site_id = coalesce(
     pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
     (select id from sites where site_code = 'LEGACY-UNASSIGNED-B' || :batch_id)
 )
 and target.created_at = coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, target.created_at)
 and target.title = coalesce(nullif(record.payload ->> 'title', ''), 'TBM')
 and target.source_text = coalesce(nullif(record.payload ->> 'content_ko', ''), '-')
where record.batch_id = :batch_id
  and record.source_table = 'tbm_notices';

insert into legacy_supabase_migration_issues(
    batch_id, source_table, source_id, issue_code, severity, details
)
select
    record.batch_id, record.source_table, record.source_id,
    'SITE_REASSIGNMENT_REQUIRED', 'WARNING',
    jsonb_build_object(
        'quarantine_site_code', 'LEGACY-UNASSIGNED-B' || :batch_id
    )
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'tbm_notices'
  and nullif(record.payload ->> 'site_id', '') is null;

-- Signature metadata. The corresponding bytes are uploaded to MinIO under
-- these deterministic object keys before the transaction is committed.
insert into file_objects(
    site_id,
    owner_user_id,
    object_key,
    sha256,
    mime_type,
    byte_size,
    purpose,
    status,
    created_at,
    verified_at
)
select
    target_notice.site_id,
    coalesce(
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles')
    ),
    'legacy/supabase/batch-' || :batch_id || '/tbm-signatures/' || record.source_id || '.png',
    encode(
        digest(
            decode(split_part(record.payload ->> 'signature_data', ',', 2), 'base64'),
            'sha256'
        ),
        'hex'
    ),
    'image/png',
    octet_length(decode(split_part(record.payload ->> 'signature_data', ',', 2), 'base64')),
    'TBM_SIGNATURE',
    'READY',
    coalesce(
        nullif(record.payload ->> 'signed_at', '')::timestamptz,
        nullif(record.payload ->> 'ack_at', '')::timestamptz,
        nullif(record.payload ->> 'created_at', '')::timestamptz,
        now()
    ),
    now()
from legacy_supabase_import_records record
join legacy_supabase_entity_mappings notice_mapping
  on notice_mapping.batch_id = record.batch_id
 and notice_mapping.source_table = 'tbm_notices'
 and notice_mapping.source_id = record.payload ->> 'tbm_id'
 and notice_mapping.target_table = 'tbm_notices'
join tbm_notices target_notice
  on target_notice.id = notice_mapping.target_id::bigint
where record.batch_id = :batch_id
  and record.source_table = 'tbm_ack'
  and coalesce(record.payload ->> 'signature_data', '') like 'data:image/png;base64,%'
on conflict (object_key) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'file_objects',
    target.id::text,
    'IMPORTED',
    'decoded_inline_signature'
from legacy_supabase_import_records record
join file_objects target
  on target.object_key =
     'legacy/supabase/batch-' || :batch_id || '/tbm-signatures/' || record.source_id || '.png'
where record.batch_id = :batch_id
  and record.source_table = 'tbm_ack'
  and coalesce(record.payload ->> 'signature_data', '') like 'data:image/png;base64,%';

insert into tbm_acknowledgements(
    tbm_notice_id,
    worker_id,
    site_id,
    acknowledged_at,
    signature_file_id
)
select
    notice_mapping.target_id::bigint,
    coalesce(
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles')
    ),
    target_notice.site_id,
    coalesce(
        nullif(record.payload ->> 'ack_at', '')::timestamptz,
        nullif(record.payload ->> 'signed_at', '')::timestamptz,
        nullif(record.payload ->> 'created_at', '')::timestamptz,
        now()
    ),
    pg_temp.legacy_target_id('tbm_ack', record.source_id, 'file_objects')
from legacy_supabase_import_records record
join legacy_supabase_entity_mappings notice_mapping
  on notice_mapping.batch_id = record.batch_id
 and notice_mapping.source_table = 'tbm_notices'
 and notice_mapping.source_id = record.payload ->> 'tbm_id'
 and notice_mapping.target_table = 'tbm_notices'
join tbm_notices target_notice
  on target_notice.id = notice_mapping.target_id::bigint
where record.batch_id = :batch_id
  and record.source_table = 'tbm_ack'
  and coalesce(
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles')
  ) is not null
on conflict (tbm_notice_id, worker_id) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id,
    source_table,
    source_id,
    target_table,
    target_id,
    mapping_status,
    mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'tbm_acknowledgements',
    target.id::text,
    'IMPORTED',
    'notice_worker'
from legacy_supabase_import_records record
join tbm_acknowledgements target
  on target.tbm_notice_id = pg_temp.legacy_target_id(
      'tbm_notices',
      record.payload ->> 'tbm_id',
      'tbm_notices'
  )
 and target.worker_id = coalesce(
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles')
 )
where record.batch_id = :batch_id
  and record.source_table = 'tbm_ack';

-- NFC/TBM sessions
insert into tbm_sessions(
    site_id,
    tbm_notice_id,
    title,
    status,
    started_at,
    ended_at,
    started_by,
    ended_by,
    metadata
)
select
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    pg_temp.legacy_target_id(
        'tbm_notices',
        nullif(record.payload ->> 'tbm_notice_id', ''),
        'tbm_notices'
    )::text,
    nullif(record.payload ->> 'title', ''),
    case lower(coalesce(record.payload ->> 'status', 'running'))
        when 'open' then 'open'
        when 'closed' then 'closed'
        when 'ended' then 'closed'
        else 'running'
    end,
    coalesce(nullif(record.payload ->> 'started_at', '')::timestamptz, now()),
    nullif(record.payload ->> 'ended_at', '')::timestamptz,
    coalesce(
        pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'started_by', ''), 'users'),
        (select id from users where email = 'legacy-migration@safe-link.invalid')
    ),
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'ended_by', ''), 'users'),
    coalesce(record.payload -> 'metadata', '{}'::jsonb)
        || jsonb_build_object('legacy_phase', record.payload ->> 'phase')
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_tbm_sessions'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'tbm_sessions',
    target.id::text,
    'IMPORTED',
    'site_started_at_title'
from legacy_supabase_import_records record
join tbm_sessions target
  on target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.started_at = coalesce(nullif(record.payload ->> 'started_at', '')::timestamptz, target.started_at)
 and coalesce(target.title, '') = coalesce(record.payload ->> 'title', '')
where record.batch_id = :batch_id
  and record.source_table = 'nfc_tbm_sessions';

-- NFC stickers
insert into worker_stickers(
    worker_id,
    site_id,
    sig_version,
    issued_epoch,
    identity_hint,
    is_active,
    issued_by,
    issued_at,
    revoked_at,
    revoked_by,
    revoke_reason
)
select
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    ),
    membership.site_id,
    coalesce(nullif(record.payload ->> 'sig_version', '')::integer, 1),
    coalesce(
        nullif(record.payload ->> 'issued_epoch', '')::bigint,
        extract(epoch from coalesce(nullif(record.payload ->> 'issued_at', '')::timestamptz, now()))::bigint
    ),
    nullif(record.payload ->> 'written_to_tag_uid', ''),
    coalesce((record.payload ->> 'is_active')::boolean, true),
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'issued_by', ''), 'users'),
    coalesce(nullif(record.payload ->> 'issued_at', '')::timestamptz, now()),
    nullif(record.payload ->> 'revoked_at', '')::timestamptz,
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'revoked_by', ''), 'users'),
    nullif(record.payload ->> 'revoke_reason', '')
from legacy_supabase_import_records record
join lateral (
    select site_membership.site_id
    from site_memberships site_membership
    where site_membership.user_id = coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    )
      and site_membership.role = 'WORKER'
      and site_membership.status = 'ACTIVE'
    order by site_membership.created_at
    limit 1
) membership on true
where record.batch_id = :batch_id
  and record.source_table = 'nfc_worker_stickers'
on conflict (worker_id, sig_version, issued_epoch) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'worker_stickers',
    target.id::text,
    'IMPORTED',
    'worker_version_epoch'
from legacy_supabase_import_records record
join worker_stickers target
  on target.worker_id = coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
  )
 and target.sig_version = coalesce(nullif(record.payload ->> 'sig_version', '')::integer, 1)
 and target.issued_epoch = coalesce(
      nullif(record.payload ->> 'issued_epoch', '')::bigint,
      extract(epoch from coalesce(nullif(record.payload ->> 'issued_at', '')::timestamptz, target.issued_at))::bigint
 )
where record.batch_id = :batch_id
  and record.source_table = 'nfc_worker_stickers';

insert into tbm_attendance(
    session_id,
    worker_id,
    sticker_id,
    tapped_at,
    tapped_by,
    lang_used,
    is_certified,
    certified_at
)
select
    pg_temp.legacy_target_id('nfc_tbm_sessions', record.payload ->> 'session_id', 'tbm_sessions'),
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    ),
    pg_temp.legacy_target_id('nfc_worker_stickers', nullif(record.payload ->> 'sticker_id', ''), 'worker_stickers'),
    coalesce(nullif(record.payload ->> 'tapped_at', '')::timestamptz, now()),
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'tapped_by', ''), 'users'),
    nullif(record.payload ->> 'lang_used', ''),
    coalesce((record.payload ->> 'is_certified')::boolean, false),
    nullif(record.payload ->> 'certified_at', '')::timestamptz
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_tbm_attendance'
  and pg_temp.legacy_target_id('nfc_tbm_sessions', record.payload ->> 'session_id', 'tbm_sessions') is not null
  and coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
  ) is not null
on conflict (session_id, worker_id) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'tbm_attendance',
    target.id::text,
    'IMPORTED',
    'session_worker'
from legacy_supabase_import_records record
join tbm_attendance target
  on target.session_id = pg_temp.legacy_target_id(
      'nfc_tbm_sessions',
      record.payload ->> 'session_id',
      'tbm_sessions'
  )
 and target.worker_id = coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
 )
where record.batch_id = :batch_id
  and record.source_table = 'nfc_tbm_attendance';

-- Daily access
insert into worker_daily_access(
    worker_id,
    site_id,
    work_date,
    status,
    checked_in_at,
    checked_out_at,
    last_seen_at,
    entry_method,
    created_at,
    updated_at
)
select
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    ),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    (record.payload ->> 'work_date')::date,
    case lower(coalesce(record.payload ->> 'status', 'active'))
        when 'checked_out' then 'CHECKED_OUT'
        else 'ACTIVE'
    end,
    nullif(record.payload ->> 'checked_in_at', '')::timestamptz,
    nullif(record.payload ->> 'checked_out_at', '')::timestamptz,
    coalesce(nullif(record.payload ->> 'last_seen_at', '')::timestamptz, now()),
    'SYSTEM',
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'updated_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_worker_daily_access'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
  ) is not null
on conflict (worker_id, site_id, work_date) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'worker_daily_access',
    target.id::text,
    'IMPORTED',
    'worker_site_date'
from legacy_supabase_import_records record
join worker_daily_access target
  on target.worker_id = coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
  )
 and target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.work_date = (record.payload ->> 'work_date')::date
where record.batch_id = :batch_id
  and record.source_table = 'nfc_worker_daily_access';

insert into site_daily_challenges(
    site_id,
    work_date,
    challenge_code,
    is_active,
    expires_at,
    created_by,
    created_at,
    metadata
)
select
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    (record.payload ->> 'work_date')::date,
    record.payload ->> 'challenge_code',
    coalesce((record.payload ->> 'is_active')::boolean, true),
    (record.payload ->> 'expires_at')::timestamptz,
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'created_by', ''), 'users'),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(record.payload -> 'metadata', '{}'::jsonb)
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_site_daily_challenges'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
on conflict (site_id, work_date) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'site_daily_challenges',
    target.site_id::text || ':' || target.work_date::text,
    'IMPORTED',
    'site_date'
from legacy_supabase_import_records record
join site_daily_challenges target
  on target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.work_date = (record.payload ->> 'work_date')::date
where record.batch_id = :batch_id
  and record.source_table = 'nfc_site_daily_challenges';

insert into worker_card_lifecycle_events(
    worker_id,
    sticker_id,
    site_id,
    event_type,
    actor_id,
    tag_uid,
    sig_version,
    issued_epoch,
    ndef_bytes,
    reason,
    metadata,
    created_at
)
select
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', nullif(record.payload ->> 'worker_id', ''), 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'worker_id', ''), 'users')
    ),
    pg_temp.legacy_target_id(
        'nfc_worker_stickers',
        nullif(record.payload ->> 'sticker_id', ''),
        'worker_stickers'
    ),
    pg_temp.legacy_target_id('sites', nullif(record.payload ->> 'site_id', ''), 'sites'),
    case lower(record.payload ->> 'event_type')
        when 'written' then 'written'
        when 'erased' then 'erased'
        when 'revoked' then 'revoked'
        when 'reissued' then 'reissued'
        else 'issued'
    end,
    pg_temp.legacy_target_id('auth.users', nullif(record.payload ->> 'actor_id', ''), 'users'),
    nullif(record.payload ->> 'tag_uid', ''),
    nullif(record.payload ->> 'sig_version', '')::integer,
    nullif(record.payload ->> 'issued_epoch', '')::bigint,
    nullif(record.payload ->> 'ndef_bytes', '')::integer,
    nullif(record.payload ->> 'reason', ''),
    coalesce(record.payload -> 'metadata', '{}'::jsonb),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'nfc_card_lifecycle_events';

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id,
    record.source_table,
    record.source_id,
    'worker_card_lifecycle_events',
    target.id::text,
    'IMPORTED',
    'created_at_event'
from legacy_supabase_import_records record
join worker_card_lifecycle_events target
  on target.created_at = coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, target.created_at)
 and target.event_type = case lower(record.payload ->> 'event_type')
      when 'written' then 'written'
      when 'erased' then 'erased'
      when 'revoked' then 'revoked'
      when 'reissued' then 'reissued'
      else 'issued'
 end
 and coalesce(target.tag_uid, '') = coalesce(record.payload ->> 'tag_uid', '')
where record.batch_id = :batch_id
  and record.source_table = 'nfc_card_lifecycle_events';

-- Chat plans: only worker/admin conversations fit the V3 contract.
create temporary table qa_chat_plan on commit drop as
select
    record.source_id,
    record.payload,
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') as site_id,
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'from_user', 'users') as sender_id,
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'to_user', 'users') as recipient_id,
    case
        when exists (
            select 1 from worker_profiles profile
            where profile.user_id = pg_temp.legacy_target_id(
                'auth.users',
                record.payload ->> 'from_user',
                'users'
            )
        ) then pg_temp.legacy_target_id('auth.users', record.payload ->> 'from_user', 'users')
        when exists (
            select 1 from worker_profiles profile
            where profile.user_id = pg_temp.legacy_target_id(
                'auth.users',
                record.payload ->> 'to_user',
                'users'
            )
        ) then pg_temp.legacy_target_id('auth.users', record.payload ->> 'to_user', 'users')
        else null
    end as worker_id,
    case
        when exists (
            select 1 from worker_profiles profile
            where profile.user_id = pg_temp.legacy_target_id(
                'auth.users',
                record.payload ->> 'from_user',
                'users'
            )
        ) then pg_temp.legacy_target_id('auth.users', record.payload ->> 'to_user', 'users')
        when exists (
            select 1 from worker_profiles profile
            where profile.user_id = pg_temp.legacy_target_id(
                'auth.users',
                record.payload ->> 'to_user',
                'users'
            )
        ) then pg_temp.legacy_target_id('auth.users', record.payload ->> 'from_user', 'users')
        else null
    end as admin_id
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'messages';

insert into chat_threads(site_id, worker_id, admin_user_id, status, created_at)
select
    plan.site_id,
    plan.worker_id,
    plan.admin_id,
    'OPEN',
    min(coalesce(nullif(plan.payload ->> 'created_at', '')::timestamptz, now()))
from qa_chat_plan plan
where plan.site_id is not null
  and plan.worker_id is not null
  and plan.admin_id is not null
group by plan.site_id, plan.worker_id, plan.admin_id
having not exists (
    select 1
    from chat_threads thread
    where thread.site_id = plan.site_id
      and thread.worker_id = plan.worker_id
      and thread.admin_user_id = plan.admin_id
);

insert into chat_messages(
    thread_id,
    site_id,
    sender_user_id,
    source_language,
    target_language,
    source_text,
    translated_text,
    created_at,
    client_message_id
)
select
    thread.id,
    plan.site_id,
    plan.sender_id,
    coalesce(nullif(plan.payload ->> 'source_lang', ''), 'ko'),
    coalesce(nullif(plan.payload ->> 'target_lang', ''), 'ko'),
    coalesce(nullif(plan.payload ->> 'source_text', ''), '-'),
    nullif(plan.payload ->> 'translated_text', ''),
    coalesce(nullif(plan.payload ->> 'created_at', '')::timestamptz, now()),
    'legacy-supabase:' || plan.source_id
from qa_chat_plan plan
join chat_threads thread
  on thread.site_id = plan.site_id
 and thread.worker_id = plan.worker_id
 and thread.admin_user_id = plan.admin_id
where plan.site_id is not null
  and plan.sender_id is not null
  and plan.worker_id is not null
  and plan.admin_id is not null
  and not exists (
      select 1
      from chat_messages message
      where message.thread_id = thread.id
        and message.sender_user_id = plan.sender_id
        and message.client_message_id = 'legacy-supabase:' || plan.source_id
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    :batch_id,
    'messages',
    plan.source_id,
    'chat_messages',
    message.id::text,
    'IMPORTED',
    'client_message_id'
from qa_chat_plan plan
join chat_messages message
  on message.client_message_id = 'legacy-supabase:' || plan.source_id
where plan.worker_id is not null;

insert into chat_message_reads(message_id, reader_user_id, read_at)
select
    message.id,
    plan.recipient_id,
    message.created_at
from qa_chat_plan plan
join chat_messages message
  on message.client_message_id = 'legacy-supabase:' || plan.source_id
where coalesce((plan.payload ->> 'is_read')::boolean, false)
  and plan.recipient_id is not null
on conflict (message_id, reader_user_id) do nothing;

insert into legacy_supabase_migration_issues(
    batch_id, source_table, source_id, issue_code, severity, details
)
select
    :batch_id,
    'messages',
    plan.source_id,
    'UNSUPPORTED_NON_WORKER_CHAT',
    'WARNING',
    jsonb_build_object(
        'reason', 'v3_chat_contract_requires_worker_admin_thread'
    )
from qa_chat_plan plan
where plan.worker_id is null;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method, details
)
select
    :batch_id,
    'messages',
    plan.source_id,
    'chat_messages',
    null,
    'BLOCKED',
    'unsupported_relationship',
    jsonb_build_object('archived', true)
from qa_chat_plan plan
where plan.worker_id is null;

-- Construction glossary
insert into construction_glossary(
    slang, standard, category, origin_lang, origin_word, note,
    is_active, created_at, updated_at
)
select
    record.payload ->> 'slang',
    record.payload ->> 'standard',
    coalesce(nullif(record.payload ->> 'category', ''), '기타'),
    nullif(record.payload ->> 'origin_lang', ''),
    nullif(record.payload ->> 'origin_word', ''),
    nullif(record.payload ->> 'note', ''),
    coalesce((record.payload ->> 'is_active')::boolean, true),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'updated_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'construction_glossary'
on conflict (slang) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'construction_glossary', target.id::text, 'IMPORTED', 'slang'
from legacy_supabase_import_records record
join construction_glossary target
  on target.slang = record.payload ->> 'slang'
where record.batch_id = :batch_id
  and record.source_table = 'construction_glossary';

-- The source education library had no V3 target before V022.
insert into safety_education_library(
    category, subcategory, accident_type, hazard_description,
    preventive_measure, risk_level, severity, frequency, is_critical,
    created_at, updated_at
)
select
    record.payload ->> 'category',
    nullif(record.payload ->> 'subcategory', ''),
    nullif(record.payload ->> 'accident_type', ''),
    record.payload ->> 'hazard_description',
    record.payload ->> 'preventive_measure',
    nullif(record.payload ->> 'risk_level', ''),
    nullif(record.payload ->> 'severity', '')::integer,
    nullif(record.payload ->> 'frequency', '')::integer,
    coalesce((record.payload ->> 'is_critical')::boolean, false),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'updated_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'safety_education_library'
  and not exists (
      select 1 from safety_education_library target
      where target.category = record.payload ->> 'category'
        and target.hazard_description = record.payload ->> 'hazard_description'
        and target.preventive_measure = record.payload ->> 'preventive_measure'
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'safety_education_library', target.id::text, 'IMPORTED', 'content'
from legacy_supabase_import_records record
join lateral (
    select item.id
    from safety_education_library item
    where item.category = record.payload ->> 'category'
      and item.hazard_description = record.payload ->> 'hazard_description'
      and item.preventive_measure = record.payload ->> 'preventive_measure'
    order by item.id
    limit 1
) target on true
where record.batch_id = :batch_id
  and record.source_table = 'safety_education_library';

insert into site_term_translations(
    glossary_id, pivot_en, lang_code, local_slang, local_phonetic,
    colonial_origin, note, created_at
)
select
    pg_temp.legacy_target_id(
        'construction_glossary',
        record.payload ->> 'glossary_id',
        'construction_glossary'
    ),
    record.payload ->> 'pivot_en',
    record.payload ->> 'lang_code',
    record.payload ->> 'local_slang',
    nullif(record.payload ->> 'local_phonetic', ''),
    nullif(record.payload ->> 'colonial_origin', ''),
    nullif(record.payload ->> 'note', ''),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'site_term_translations'
  and pg_temp.legacy_target_id(
      'construction_glossary',
      record.payload ->> 'glossary_id',
      'construction_glossary'
  ) is not null
  and not exists (
      select 1 from site_term_translations target
      where target.glossary_id = pg_temp.legacy_target_id(
          'construction_glossary',
          record.payload ->> 'glossary_id',
          'construction_glossary'
      )
        and target.lang_code = record.payload ->> 'lang_code'
        and target.local_slang = record.payload ->> 'local_slang'
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'site_term_translations', target.id::text, 'IMPORTED', 'glossary_language_slang'
from legacy_supabase_import_records record
join site_term_translations target
  on target.glossary_id = pg_temp.legacy_target_id(
      'construction_glossary',
      record.payload ->> 'glossary_id',
      'construction_glossary'
  )
 and target.lang_code = record.payload ->> 'lang_code'
 and target.local_slang = record.payload ->> 'local_slang'
where record.batch_id = :batch_id
  and record.source_table = 'site_term_translations';

-- Stop-work alerts and legal claim 17 interventions
insert into stop_work_alerts(
    worker_id, worker_name, site_id, reason, lang, resolved, created_at
)
select
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    ),
    coalesce(nullif(record.payload ->> 'worker_name', ''), 'Legacy worker'),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    record.payload ->> 'reason',
    coalesce(nullif(record.payload ->> 'lang', ''), 'ko'),
    coalesce((record.payload ->> 'resolved')::boolean, false),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'stop_work_alerts'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and not exists (
      select 1 from stop_work_alerts target
      where target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
        and target.created_at = coalesce(
            nullif(record.payload ->> 'created_at', '')::timestamptz,
            target.created_at
        )
        and target.reason = record.payload ->> 'reason'
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'stop_work_alerts', target.id::text, 'IMPORTED', 'site_created_reason'
from legacy_supabase_import_records record
join stop_work_alerts target
  on target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.created_at = coalesce(
     nullif(record.payload ->> 'created_at', '')::timestamptz,
     target.created_at
 )
 and target.reason = record.payload ->> 'reason'
where record.batch_id = :batch_id
  and record.source_table = 'stop_work_alerts';

-- One legacy intervention has no alert. Preserve it through a synthetic alert,
-- while recording that the relationship was reconstructed.
insert into stop_work_alerts(
    worker_id, worker_name, site_id, reason, lang, resolved, created_at
)
select
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
    coalesce(target_user.display_name, 'Legacy worker'),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    record.payload ->> 'reason',
    coalesce(nullif(record.payload ->> 'preferred_lang', ''), 'ko'),
    (lower(coalesce(record.payload ->> 'status', 'requested')) = 'resolved'),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
left join users target_user
  on target_user.id = pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
where record.batch_id = :batch_id
  and record.source_table = 'claim17_stop_work_interventions'
  and nullif(record.payload ->> 'alert_id', '') is null
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and not exists (
      select 1 from stop_work_alerts target
      where target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
        and target.created_at = coalesce(
            nullif(record.payload ->> 'created_at', '')::timestamptz,
            target.created_at
        )
        and target.reason = record.payload ->> 'reason'
  );

insert into legacy_supabase_migration_issues(
    batch_id, source_table, source_id, issue_code, severity, details
)
select
    record.batch_id, record.source_table, record.source_id,
    'SYNTHETIC_STOP_WORK_ALERT', 'WARNING',
    jsonb_build_object('reason', 'legacy_intervention_missing_alert_id')
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'claim17_stop_work_interventions'
  and nullif(record.payload ->> 'alert_id', '') is null;

insert into claim17_stop_work_interventions(
    alert_id, worker_id, site_id, reason, hazard_category, severity,
    preferred_lang, gps, photo_urls, status, escalation_due_at, created_at
)
select
    coalesce(
        pg_temp.legacy_target_id(
            'stop_work_alerts',
            nullif(record.payload ->> 'alert_id', ''),
            'stop_work_alerts'
        ),
        synthetic.id
    ),
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    record.payload ->> 'reason',
    coalesce(nullif(record.payload ->> 'hazard_category', ''), 'unspecified'),
    case lower(coalesce(record.payload ->> 'severity', 'high'))
        when 'low' then 'low' when 'medium' then 'medium'
        when 'critical' then 'critical' else 'high'
    end,
    coalesce(nullif(record.payload ->> 'preferred_lang', ''), 'ko'),
    record.payload -> 'gps',
    coalesce(record.payload -> 'photo_urls', '[]'::jsonb),
    case lower(coalesce(record.payload ->> 'status', 'requested'))
        when 'acknowledged' then 'acknowledged'
        when 'resolved' then 'resolved'
        when 'rejected' then 'rejected'
        else 'requested'
    end,
    nullif(record.payload ->> 'escalation_due_at', '')::timestamptz,
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
left join lateral (
    select alert.id
    from stop_work_alerts alert
    where nullif(record.payload ->> 'alert_id', '') is null
      and alert.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
      and alert.created_at = coalesce(
          nullif(record.payload ->> 'created_at', '')::timestamptz,
          alert.created_at
      )
      and alert.reason = record.payload ->> 'reason'
    order by alert.id
    limit 1
) synthetic on true
where record.batch_id = :batch_id
  and record.source_table = 'claim17_stop_work_interventions'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and coalesce(
      pg_temp.legacy_target_id(
          'stop_work_alerts',
          nullif(record.payload ->> 'alert_id', ''),
          'stop_work_alerts'
      ),
      synthetic.id
  ) is not null;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'claim17_stop_work_interventions', target.id::text, 'IMPORTED',
    'site_created_reason'
from legacy_supabase_import_records record
join claim17_stop_work_interventions target
  on target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.created_at = coalesce(
     nullif(record.payload ->> 'created_at', '')::timestamptz,
     target.created_at
 )
 and target.reason = record.payload ->> 'reason'
where record.batch_id = :batch_id
  and record.source_table = 'claim17_stop_work_interventions';

-- TBM quizzes and safety-equipment grants
insert into tbm_quiz_sessions(
    tbm_session_id, site_id, questions, created_by, status, source,
    sent_at, created_at
)
select
    pg_temp.legacy_target_id(
        'nfc_tbm_sessions',
        nullif(record.payload ->> 'tbm_session_id', ''),
        'tbm_sessions'
    ),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    coalesce(record.payload -> 'questions', '[]'::jsonb),
    coalesce(
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'created_by', 'users'),
        (select id from users where email = 'legacy-migration@safe-link.invalid')
    ),
    case lower(coalesce(record.payload ->> 'status', 'draft'))
        when 'sent' then 'sent'
        when 'closed' then 'closed'
        else 'draft'
    end,
    case lower(coalesce(record.payload ->> 'source', 'fallback'))
        when 'tbm' then 'tbm' else 'fallback'
    end,
    nullif(record.payload ->> 'sent_at', '')::timestamptz,
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'tbm_quiz_sessions'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and not exists (
      select 1 from tbm_quiz_sessions target
      where target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
        and target.created_at = coalesce(
            nullif(record.payload ->> 'created_at', '')::timestamptz,
            target.created_at
        )
        and target.questions = coalesce(record.payload -> 'questions', '[]'::jsonb)
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'tbm_quiz_sessions', target.id::text, 'IMPORTED', 'site_created_questions'
from legacy_supabase_import_records record
join tbm_quiz_sessions target
  on target.site_id = pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites')
 and target.created_at = coalesce(
     nullif(record.payload ->> 'created_at', '')::timestamptz,
     target.created_at
 )
 and target.questions = coalesce(record.payload -> 'questions', '[]'::jsonb)
where record.batch_id = :batch_id
  and record.source_table = 'tbm_quiz_sessions';

insert into tbm_quiz_responses(
    quiz_session_id, worker_id, lang, questions_translated,
    answer_index_correct, answers_submitted, score_pct, status,
    answered_at, created_at
)
select
    pg_temp.legacy_target_id(
        'tbm_quiz_sessions',
        record.payload ->> 'quiz_session_id',
        'tbm_quiz_sessions'
    ),
    coalesce(
        pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
        pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
    ),
    coalesce(nullif(record.payload ->> 'lang', ''), 'ko'),
    coalesce(record.payload -> 'questions_translated', '[]'::jsonb),
    coalesce(record.payload -> 'answer_index_correct', '[]'::jsonb),
    record.payload -> 'answers_submitted',
    nullif(record.payload ->> 'score_pct', '')::integer,
    case lower(coalesce(record.payload ->> 'status', 'sent'))
        when 'answered' then 'answered' else 'sent'
    end,
    nullif(record.payload ->> 'answered_at', '')::timestamptz,
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'tbm_quiz_responses'
  and pg_temp.legacy_target_id(
      'tbm_quiz_sessions',
      record.payload ->> 'quiz_session_id',
      'tbm_quiz_sessions'
  ) is not null
  and coalesce(
      pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
      pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
  ) is not null
on conflict (quiz_session_id, worker_id) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'tbm_quiz_responses', target.id::text, 'IMPORTED', 'session_worker'
from legacy_supabase_import_records record
join tbm_quiz_responses target
  on target.quiz_session_id = pg_temp.legacy_target_id(
      'tbm_quiz_sessions',
      record.payload ->> 'quiz_session_id',
      'tbm_quiz_sessions'
  )
 and target.worker_id = coalesce(
     pg_temp.legacy_target_id('nfc_workers', record.payload ->> 'worker_id', 'worker_profiles'),
     pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users')
 )
where record.batch_id = :batch_id
  and record.source_table = 'tbm_quiz_responses';

insert into safety_equipment_grants(
    worker_id, site_id, quiz_session_id, score_pct, equipment_type,
    granted_by, note, granted_at, created_at
)
select
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    pg_temp.legacy_target_id(
        'tbm_quiz_sessions',
        nullif(record.payload ->> 'quiz_session_id', ''),
        'tbm_quiz_sessions'
    ),
    nullif(record.payload ->> 'score_pct', '')::integer,
    record.payload ->> 'equipment_type',
    pg_temp.legacy_target_id(
        'auth.users',
        nullif(record.payload ->> 'granted_by', ''),
        'users'
    ),
    nullif(record.payload ->> 'note', ''),
    coalesce(nullif(record.payload ->> 'granted_at', '')::timestamptz, now()),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'safety_equipment_grants'
  and pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users') is not null
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
on conflict do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'safety_equipment_grants', target.id::text, 'IMPORTED',
    'worker_equipment_quiz'
from legacy_supabase_import_records record
join safety_equipment_grants target
  on target.worker_id = pg_temp.legacy_target_id(
      'auth.users',
      record.payload ->> 'worker_id',
      'users'
  )
 and target.equipment_type = record.payload ->> 'equipment_type'
 and target.quiz_session_id is not distinct from pg_temp.legacy_target_id(
     'tbm_quiz_sessions',
     nullif(record.payload ->> 'quiz_session_id', ''),
     'tbm_quiz_sessions'
 )
where record.batch_id = :batch_id
  and record.source_table = 'safety_equipment_grants';

-- Claim 13 pledge signatures and records
insert into file_objects(
    site_id, owner_user_id, object_key, sha256, mime_type, byte_size,
    purpose, status, created_at, verified_at
)
select
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
    'legacy/supabase/batch-' || :batch_id || '/pledge-signatures/' || record.source_id || '.png',
    encode(
        digest(
            decode(split_part(record.payload ->> 'signature_data', ',', 2), 'base64'),
            'sha256'
        ),
        'hex'
    ),
    'image/png',
    octet_length(decode(split_part(record.payload ->> 'signature_data', ',', 2), 'base64')),
    'PLEDGE_SIGNATURE',
    'READY',
    coalesce(
        nullif(record.payload ->> 'approved_at', '')::timestamptz,
        nullif(record.payload ->> 'created_at', '')::timestamptz,
        now()
    ),
    now()
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'claim13_pledges'
  and coalesce(record.payload ->> 'signature_data', '') like 'data:image/png;base64,%'
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
on conflict (object_key) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'file_objects', target.id::text, 'IMPORTED', 'decoded_inline_signature'
from legacy_supabase_import_records record
join file_objects target
  on target.object_key =
     'legacy/supabase/batch-' || :batch_id || '/pledge-signatures/' || record.source_id || '.png'
where record.batch_id = :batch_id
  and record.source_table = 'claim13_pledges';

insert into claim13_pledges(
    tbm_session_id, worker_id, site_id, pledge_content,
    pledge_content_hash, nfc_uid, signature_file_id, signature_sha256,
    client_ip, approved_at, created_at
)
select
    nullif(record.payload ->> 'tbm_session_id', ''),
    pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users'),
    pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites'),
    record.payload ->> 'pledge_content',
    record.payload ->> 'pledge_content_hash',
    nullif(record.payload ->> 'nfc_uid', ''),
    signature.id,
    signature.sha256,
    nullif(record.payload ->> 'client_ip', ''),
    nullif(record.payload ->> 'approved_at', '')::timestamptz,
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
join file_objects signature
  on signature.object_key =
     'legacy/supabase/batch-' || :batch_id || '/pledge-signatures/' || record.source_id || '.png'
where record.batch_id = :batch_id
  and record.source_table = 'claim13_pledges'
  and pg_temp.legacy_target_id('auth.users', record.payload ->> 'worker_id', 'users') is not null
  and pg_temp.legacy_target_id('sites', record.payload ->> 'site_id', 'sites') is not null
  and not exists (
      select 1 from claim13_pledges target
      where target.worker_id = pg_temp.legacy_target_id(
          'auth.users',
          record.payload ->> 'worker_id',
          'users'
      )
        and target.site_id = pg_temp.legacy_target_id(
            'sites',
            record.payload ->> 'site_id',
            'sites'
        )
        and target.created_at = coalesce(
            nullif(record.payload ->> 'created_at', '')::timestamptz,
            target.created_at
        )
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'claim13_pledges', target.id::text, 'IMPORTED', 'worker_site_created'
from legacy_supabase_import_records record
join claim13_pledges target
  on target.worker_id = pg_temp.legacy_target_id(
      'auth.users',
      record.payload ->> 'worker_id',
      'users'
  )
 and target.site_id = pg_temp.legacy_target_id(
     'sites',
     record.payload ->> 'site_id',
     'sites'
 )
 and target.created_at = coalesce(
     nullif(record.payload ->> 'created_at', '')::timestamptz,
     target.created_at
 )
where record.batch_id = :batch_id
  and record.source_table = 'claim13_pledges';

-- Live translation history
insert into live_translation_events(
    session_id, site_id, text_ko, translations, created_by, created_at
)
select
    record.payload ->> 'session_id',
    pg_temp.legacy_target_id(
        'sites',
        nullif(record.payload ->> 'site_id', ''),
        'sites'
    ),
    record.payload ->> 'text_ko',
    coalesce(record.payload -> 'translations', '{}'::jsonb),
    coalesce(
        pg_temp.legacy_target_id(
            'auth.users',
            nullif(record.payload ->> 'created_by', ''),
            'users'
        ),
        (select id from users where email = 'legacy-migration@safe-link.invalid')
    ),
    coalesce(nullif(record.payload ->> 'created_at', '')::timestamptz, now())
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'live_translations'
  and not exists (
      select 1 from live_translation_events target
      where target.session_id = record.payload ->> 'session_id'
        and target.created_at = coalesce(
            nullif(record.payload ->> 'created_at', '')::timestamptz,
            target.created_at
        )
        and target.text_ko = record.payload ->> 'text_ko'
  );

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'live_translation_events', target.id::text, 'IMPORTED',
    'session_created_text'
from legacy_supabase_import_records record
join live_translation_events target
  on target.session_id = record.payload ->> 'session_id'
 and target.created_at = coalesce(
     nullif(record.payload ->> 'created_at', '')::timestamptz,
     target.created_at
 )
 and target.text_ko = record.payload ->> 'text_ko'
where record.batch_id = :batch_id
  and record.source_table = 'live_translations';

insert into legacy_supabase_migration_issues(
    batch_id, source_table, source_id, issue_code, severity, details
)
select
    record.batch_id, record.source_table, record.source_id,
    'MISSING_ORIGINAL_ACTOR', 'WARNING',
    jsonb_build_object('replacement', 'legacy-migration@safe-link.invalid')
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'live_translations'
  and nullif(record.payload ->> 'created_by', '') is null;

-- Legal report evidence. Preserve source-only metadata inside payload.
insert into legal_report_exports(
    report_id, report_type, site_id, payload, report_hash_alg,
    report_hash, created_at
)
select
    record.payload ->> 'report_id',
    record.payload ->> 'report_type',
    pg_temp.legacy_target_id(
        'sites',
        nullif(record.payload ->> 'site_id', ''),
        'sites'
    ),
    jsonb_build_object(
        'legacy_data_scope', coalesce(record.payload -> 'data_scope', '{}'::jsonb),
        'legacy_source_tables', coalesce(record.payload -> 'source_tables', '[]'::jsonb),
        'legacy_generated_by', record.payload -> 'generated_by',
        'legacy_generated_at', record.payload -> 'generated_at',
        'legacy_voided_at', record.payload -> 'voided_at',
        'legacy_voided_by', record.payload -> 'voided_by',
        'legacy_void_reason', record.payload -> 'void_reason',
        'legacy_source_id', record.source_id,
        'legacy_batch_id', :batch_id
    ),
    coalesce(nullif(record.payload ->> 'report_hash_alg', ''), 'SHA-256'),
    lower(record.payload ->> 'report_hash'),
    coalesce(
        nullif(record.payload ->> 'generated_at', '')::timestamptz,
        nullif(record.payload ->> 'created_at', '')::timestamptz,
        now()
    )
from legacy_supabase_import_records record
where record.batch_id = :batch_id
  and record.source_table = 'legal_report_exports'
on conflict (report_id) do nothing;

insert into legacy_supabase_entity_mappings(
    batch_id, source_table, source_id, target_table, target_id,
    mapping_status, mapping_method
)
select
    record.batch_id, record.source_table, record.source_id,
    'legal_report_exports', target.report_id, 'IMPORTED', 'report_id'
from legacy_supabase_import_records record
join legal_report_exports target
  on target.report_id = record.payload ->> 'report_id'
where record.batch_id = :batch_id
  and record.source_table = 'legal_report_exports';

-- Hard completeness checks. A source row must be represented by a canonical
-- target mapping, or explicitly BLOCKED with the immutable archive retained.
select source.source_table, count(*) as unrepresented_records
from legacy_supabase_import_records source
where source.batch_id = :batch_id
  and not exists (
      select 1
      from legacy_supabase_entity_mappings mapping
      where mapping.batch_id = source.batch_id
        and mapping.source_table = source.source_table
        and mapping.source_id = source.source_id
        and mapping.mapping_status in ('MAPPED', 'IMPORTED', 'BLOCKED')
  )
group by source.source_table
order by source.source_table;

do $$
declare
    wanted_batch_id bigint := current_setting('app.migration_batch_id')::bigint;
    source_record_count bigint;
    represented_record_count bigint;
    source_auth_count bigint;
    mapped_auth_count bigint;
    error_issue_count bigint;
    bad_signature_count bigint;
begin
    select count(*)
      into source_record_count
    from legacy_supabase_import_records
    where batch_id = wanted_batch_id;

    select count(*)
      into represented_record_count
    from legacy_supabase_import_records source
    where source.batch_id = wanted_batch_id
      and exists (
          select 1
          from legacy_supabase_entity_mappings mapping
          where mapping.batch_id = source.batch_id
            and mapping.source_table = source.source_table
            and mapping.source_id = source.source_id
            and mapping.mapping_status in ('MAPPED', 'IMPORTED', 'BLOCKED')
      );

    if represented_record_count <> source_record_count then
        raise exception 'unrepresented_source_records: expected %, got %',
            source_record_count, represented_record_count;
    end if;

    select count(*) into source_auth_count
    from legacy_supabase_auth_users
    where batch_id = wanted_batch_id;

    select count(*) into mapped_auth_count
    from legacy_supabase_entity_mappings
    where batch_id = wanted_batch_id
      and source_table = 'auth.users'
      and target_table = 'users'
      and mapping_status in ('MAPPED', 'IMPORTED');

    if mapped_auth_count <> source_auth_count then
        raise exception 'unmapped_auth_users: expected %, got %',
            source_auth_count, mapped_auth_count;
    end if;

    select count(*) into error_issue_count
    from legacy_supabase_migration_issues
    where batch_id = wanted_batch_id
      and severity = 'ERROR'
      and resolved_at is null;

    if error_issue_count > 0 then
        raise exception 'unresolved_migration_errors:%', error_issue_count;
    end if;

    select count(*) into bad_signature_count
    from file_objects file
    where file.object_key like
          'legacy/supabase/batch-' || wanted_batch_id || '/%-signatures/%'
      and (
          file.byte_size <= 0
          or file.sha256 !~ '^[0-9a-f]{64}$'
          or file.mime_type <> 'image/png'
      );

    if bad_signature_count > 0 then
        raise exception 'invalid_signature_metadata:%', bad_signature_count;
    end if;
end
$$;

insert into audit_logs(
    actor_user_id, action, resource_type, resource_id,
    decision, reason, metadata
)
select
    user_owner.id,
    'migration.supabase.final',
    'legacy_supabase_import_batch',
    :batch_id::text,
    'ALLOWED',
    'validated_final_import',
    jsonb_build_object(
        'source_records', (
            select count(*) from legacy_supabase_import_records
            where batch_id = :batch_id
        ),
        'auth_users', (
            select count(*) from legacy_supabase_auth_users
            where batch_id = :batch_id
        ),
        'mapped_source_records', (
            select count(distinct (source_table, source_id))
            from legacy_supabase_entity_mappings
            where batch_id = :batch_id
              and source_table <> 'auth.users'
        ),
        'warning_issues', (
            select count(*) from legacy_supabase_migration_issues
            where batch_id = :batch_id and severity = 'WARNING'
        )
    )
from users user_owner
where user_owner.email = 'legacy-migration@safe-link.invalid';

\echo '=== final migration summary ==='
select
    source.source_table,
    count(*) as source_records,
    count(*) filter (
        where exists (
            select 1
            from legacy_supabase_entity_mappings mapping
            where mapping.batch_id = source.batch_id
              and mapping.source_table = source.source_table
              and mapping.source_id = source.source_id
              and mapping.mapping_status in ('MAPPED', 'IMPORTED')
        )
    ) as canonical_records,
    count(*) filter (
        where exists (
            select 1
            from legacy_supabase_entity_mappings mapping
            where mapping.batch_id = source.batch_id
              and mapping.source_table = source.source_table
              and mapping.source_id = source.source_id
              and mapping.mapping_status = 'BLOCKED'
        )
    ) as blocked_records
from legacy_supabase_import_records source
where source.batch_id = :batch_id
group by source.source_table
order by source.source_table;

select severity, issue_code, count(*) as issue_count
from legacy_supabase_migration_issues
where batch_id = :batch_id
group by severity, issue_code
order by severity, issue_code;

\if :apply
  \echo 'Applying validated migration'
  commit;
\else
  \echo 'Dry run only; rolling back'
  rollback;
\endif

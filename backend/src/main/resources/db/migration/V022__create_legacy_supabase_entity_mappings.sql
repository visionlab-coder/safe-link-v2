create table if not exists legacy_supabase_entity_mappings (
    batch_id bigint not null references legacy_supabase_import_batches(id) on delete restrict,
    source_table text not null,
    source_id text not null,
    target_table text not null,
    target_id text,
    mapping_status text not null,
    mapping_method text not null,
    details jsonb not null default '{}'::jsonb,
    mapped_at timestamptz not null default now(),
    primary key (batch_id, source_table, source_id, target_table),
    check (mapping_status in ('MAPPED', 'IMPORTED', 'SKIPPED', 'BLOCKED'))
);

create index if not exists legacy_supabase_entity_mappings_target_idx
    on legacy_supabase_entity_mappings(target_table, target_id);

create table if not exists legacy_supabase_migration_issues (
    id bigserial primary key,
    batch_id bigint not null references legacy_supabase_import_batches(id) on delete restrict,
    source_table text not null,
    source_id text not null,
    issue_code text not null,
    severity text not null,
    details jsonb not null default '{}'::jsonb,
    resolved_at timestamptz,
    resolution text,
    created_at timestamptz not null default now(),
    unique (batch_id, source_table, source_id, issue_code),
    check (severity in ('INFO', 'WARNING', 'ERROR'))
);

create index if not exists legacy_supabase_migration_issues_open_idx
    on legacy_supabase_migration_issues(batch_id, severity, issue_code)
    where resolved_at is null;

create table if not exists safety_education_library (
    id bigserial primary key,
    category text not null,
    subcategory text,
    accident_type text,
    hazard_description text not null,
    preventive_measure text not null,
    risk_level text,
    severity integer,
    frequency integer,
    is_critical boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists safety_education_library_category_idx
    on safety_education_library(category, subcategory);

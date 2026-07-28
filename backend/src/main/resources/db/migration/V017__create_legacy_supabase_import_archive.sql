create table if not exists legacy_supabase_import_batches (
    id bigserial primary key,
    source_url text not null,
    exported_at timestamptz not null,
    imported_at timestamptz not null default now(),
    snapshot jsonb not null
);

create table if not exists legacy_supabase_import_records (
    batch_id bigint not null references legacy_supabase_import_batches(id) on delete restrict,
    source_table text not null,
    source_id text not null,
    payload jsonb not null,
    imported_at timestamptz not null default now(),
    primary key (batch_id, source_table, source_id)
);

create index if not exists legacy_supabase_import_records_source_idx
    on legacy_supabase_import_records(source_table, source_id);

create table if not exists legacy_supabase_auth_users (
    batch_id bigint not null references legacy_supabase_import_batches(id) on delete restrict,
    source_user_id uuid not null,
    email text,
    phone text,
    user_metadata jsonb,
    app_metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    primary key (batch_id, source_user_id)
);

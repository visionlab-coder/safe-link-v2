create table if not exists legal_report_exports (
    report_id varchar(160) primary key,
    report_type varchar(32) not null,
    site_id bigint references sites(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    report_hash_alg varchar(16) not null default 'SHA-256',
    report_hash char(64) not null,
    created_at timestamptz not null default now(),
    retention_until timestamptz
);

create index if not exists idx_legal_report_exports_site_created
    on legal_report_exports(site_id, created_at desc);

create table if not exists report_verification_codes (
    report_id varchar(160) primary key references legal_report_exports(report_id) on delete cascade,
    verification_url text not null,
    qr_code_svg text not null,
    perceptual_hash varchar(16) not null,
    report_type varchar(32) not null,
    site_id bigint references sites(id) on delete set null,
    created_at timestamptz not null default now(),
    last_verified_at timestamptz,
    verify_count integer not null default 0
);

create index if not exists idx_report_verification_site_type
    on report_verification_codes(site_id, report_type, created_at desc);

create table if not exists live_broadcast_sessions (
    id bigserial primary key,
    session_id varchar(120) not null unique,
    site_id bigint not null references sites(id),
    started_by bigint not null references users(id),
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    active boolean not null default true
);

-- 한 현장에는 동시에 하나의 실시간 통역 방송만 유지한다.
create unique index if not exists uq_live_broadcast_sessions_active_site
    on live_broadcast_sessions(site_id)
    where active;

create index if not exists idx_live_broadcast_sessions_site_active
    on live_broadcast_sessions(site_id, active, started_at desc);

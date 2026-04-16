-- 실시간 통역(라이브) 테이블
-- 관리자가 말한 한국어 텍스트를 실시간 저장 → 근로자 스마트폰에서 Supabase Realtime 구독
-- V3 피처 롤백 감지: 2026-04-16 현장에서 통역 미작동 보고 → 테이블 부재 확인됨

create table if not exists live_translations (
    id uuid default gen_random_uuid() primary key,
    session_id text not null,
    text_ko text not null,
    site_id uuid references sites(id) on delete cascade,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz default now()
);

-- 실시간 구독 성능을 위한 인덱스
create index if not exists idx_live_translations_site_created on live_translations (site_id, created_at desc);
create index if not exists idx_live_translations_session on live_translations (session_id, created_at desc);

-- RLS
alter table live_translations enable row level security;

-- 인증된 사용자는 읽기 가능 (근로자가 구독)
create policy "live_translations_read_authenticated"
    on live_translations for select
    to authenticated
    using (true);

-- HQ_ADMIN / SAFETY_OFFICER / ROOT만 쓰기
create policy "live_translations_insert_admin"
    on live_translations for insert
    to authenticated
    with check (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
              and profiles.role in ('ROOT', 'HQ_ADMIN', 'SAFETY_OFFICER')
        )
    );

-- Realtime 발행 활성화 (postgres_changes 이벤트 송신)
alter publication supabase_realtime add table live_translations;

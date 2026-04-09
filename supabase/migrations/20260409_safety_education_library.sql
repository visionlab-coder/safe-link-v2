-- 기초교육 라이브러리 테이블
-- TBM 전파 시 미리 등록된 위험성평가 항목을 불러와서 사용
create table if not exists safety_education_library (
  id uuid default gen_random_uuid() primary key,
  category text not null,          -- 대공종 (철근작업, 거푸집작업 등)
  subcategory text not null,       -- 세부공종 (철근 반입, 철근 조립 등)
  hazard_description text not null,-- 잠재적/실제적 위험요인
  accident_type text not null,     -- 재해형태 (추락, 충돌, 감전 등)
  frequency int not null default 1,-- 빈도 (1-3)
  severity int not null default 1, -- 강도 (1-3)
  risk_level int not null default 1,-- 등급 (1-5)
  preventive_measure text not null,-- 관리계획 (예방대책)
  is_critical boolean not null default false, -- 중점관리 여부
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 검색 성능을 위한 인덱스
create index idx_sel_category on safety_education_library (category);
create index idx_sel_subcategory on safety_education_library (category, subcategory);
create index idx_sel_accident_type on safety_education_library (accident_type);
create index idx_sel_risk_level on safety_education_library (risk_level);

-- RLS 정책: 인증된 사용자는 읽기 가능, admin만 쓰기
alter table safety_education_library enable row level security;

create policy "sel_read_authenticated"
  on safety_education_library for select
  to authenticated
  using (true);

create policy "sel_insert_admin"
  on safety_education_library for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.system_role in ('HQ_ADMIN', 'SAFETY_OFFICER')
    )
  );

create policy "sel_update_admin"
  on safety_education_library for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.system_role in ('HQ_ADMIN', 'SAFETY_OFFICER')
    )
  );

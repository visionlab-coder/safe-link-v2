-- ============================================================================
-- P2: 특허 청구항 6 (원문/정규화/번역 3-튜플 + 사전/모델 메타)
--     특허 청구항 8 (이수/미이수/재교육 3분류 영속 + 사이트별 임계값)
-- C6 매칭률 55% → 90%, C8 매칭률 55% → 85% 목표
-- ============================================================================

-- ─── 1. 다국어 콘텐츠 정규화 통합 영속 (C6) ────────────────────────────────
create table if not exists public.multilingual_content_records (
  id                  uuid primary key default gen_random_uuid(),
  source_text         text not null,
  normalized_text     text not null,
  translated_text     text not null,
  source_lang         text not null,
  target_lang         text not null,
  glossary_version    text not null,                       -- 'construction-v2026.06.01'
  nlp_model_id        text not null,                       -- 'gemini-2.5-flash'|'papago'|'google-v3'
  parent_entity_type  text not null check (parent_entity_type in ('tbm','quiz','chat','pledge','briefing','live_speech')),
  parent_entity_id    uuid,
  unit_type           text not null check (unit_type in ('sentence','paragraph','hazard','edu_item','option')),
  unit_index          int,
  site_id             uuid references public.sites(id),
  worker_id           uuid references public.nfc_workers(id),
  created_at          timestamptz not null default now()
);

create index if not exists idx_mcr_parent
  on public.multilingual_content_records (parent_entity_type, parent_entity_id);
create index if not exists idx_mcr_site_lang
  on public.multilingual_content_records (site_id, target_lang);
create index if not exists idx_mcr_worker_recent
  on public.multilingual_content_records (worker_id, created_at desc);

comment on table public.multilingual_content_records is
  '청구항 6 — 원문/정규화/번역 3-튜플 통합 영속. 사전 버전, NLP 모델 ID, 단위(문장/문단/위험요인/교육항목) 메타 포함.';

alter table public.multilingual_content_records enable row level security;

drop policy if exists "mcr_admin_read_site" on public.multilingual_content_records;
create policy "mcr_admin_read_site"
  on public.multilingual_content_records for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ROOT','SUPER_ADMIN','HQ_ADMIN','HQ_OFFICER','SAFETY_OFFICER','SITE_ADMIN')
        and (
          p.role in ('ROOT','SUPER_ADMIN','HQ_ADMIN','HQ_OFFICER')
          or p.site_id = multilingual_content_records.site_id
        )
    )
  );

drop policy if exists "mcr_worker_read_own" on public.multilingual_content_records;
create policy "mcr_worker_read_own"
  on public.multilingual_content_records for select
  using (
    exists (
      select 1 from public.nfc_workers w
      where w.id = multilingual_content_records.worker_id
        and w.auth_user_id = auth.uid()
    )
  );

-- ─── 2. 이수 3분류 영속 + 사이트별 임계값 (C8) ─────────────────────────────
alter table public.tbm_quiz_responses
  add column if not exists completion_grade text
    check (completion_grade in ('passed','failed','remedial')),
  add column if not exists remedial_completed_at timestamptz,
  add column if not exists supplementary_content_id uuid,
  add column if not exists comprehension_score_breakdown jsonb;

create index if not exists idx_tbm_quiz_responses_grade
  on public.tbm_quiz_responses (completion_grade) where completion_grade is not null;

comment on column public.tbm_quiz_responses.completion_grade is
  '청구항 8 — 응답 기반 이해도 3분류 (passed/failed/remedial). respond 라우트가 채점 후 채움.';
comment on column public.tbm_quiz_responses.remedial_completed_at is
  '청구항 8 — 재교육 완료 시각. 재시도 후 passed 로 전환되면 기록.';
comment on column public.tbm_quiz_responses.comprehension_score_breakdown is
  '청구항 8 — 문항별 정/오답 세부, 단답형 유사도 점수 등 비교 가능한 raw 결과.';

-- 사이트별 이해도 임계값 설정
alter table public.sites
  add column if not exists comprehension_threshold int not null default 80,
  add column if not exists remedial_threshold int not null default 50;

comment on column public.sites.comprehension_threshold is
  '청구항 8 — 이 점수 이상이면 passed. 사이트별 운영 정책에 따라 조정.';
comment on column public.sites.remedial_threshold is
  '청구항 8 — 이 점수 이하면 failed (재교육도 무의미). 사이/이하 = remedial.';

-- ─── 3. 사이트별 임계값 기본값 보정 트리거 ──────────────────────────────────
-- 임계값이 NULL 또는 0 인 site 는 기본 80/50 으로 보정
update public.sites
   set comprehension_threshold = 80
 where comprehension_threshold is null or comprehension_threshold = 0;

update public.sites
   set remedial_threshold = 50
 where remedial_threshold is null or remedial_threshold = 0;

-- ─── 4. 보충 콘텐츠 라이브러리 (재교육 자동 제공용) ────────────────────────
create table if not exists public.supplementary_education_contents (
  id                 uuid primary key default gen_random_uuid(),
  related_keyword    text not null,                      -- 풀 키워드와 매칭 (안전모, 추락방지 등)
  lang               text not null,
  title              text not null,
  content_text       text not null,
  video_url          text,
  duration_seconds   int,
  created_at         timestamptz not null default now()
);

create index if not exists idx_supp_edu_keyword_lang
  on public.supplementary_education_contents (related_keyword, lang);

comment on table public.supplementary_education_contents is
  '청구항 8 — failed/remedial 분류 시 자동 제공할 보충 교육 콘텐츠. 키워드 기준으로 매칭.';

alter table public.supplementary_education_contents enable row level security;
drop policy if exists "supp_edu_read_all_auth" on public.supplementary_education_contents;
create policy "supp_edu_read_all_auth"
  on public.supplementary_education_contents for select
  using (auth.role() = 'authenticated');

-- ============================================================================
-- P3: 특허 청구항 5 (작업조/위치/시간 기준 위험성평가 + 보호구/점검사항)
--     특허 청구항 11 (보고서 + QR + 검증URL + 인지해시)
--     특허 청구항 12 (작업중지 다국어 번역 + 조치 결과 컬럼 분리)
-- C5 60% → 88%, C11 65% → 90%, C12 60% → 88%
-- ============================================================================

-- ─── 1. safety_education_library 확장 (C5) ─────────────────────────────────
alter table public.safety_education_library
  add column if not exists crew_type             text,                      -- '철근조' | '거푸집조' | '콘크리트조' | ...
  add column if not exists worksite_type         text,                      -- 'high-altitude' | 'excavation' | 'confined' | 'electrical' | 'general'
  add column if not exists applicable_time_window text,                     -- 'morning' | 'afternoon' | 'night' | 'all-day' | 'seasonal-summer' | 'seasonal-winter'
  add column if not exists ppe_required          text[] not null default array[]::text[],   -- ['safety_helmet','safety_belt','safety_shoes',...]
  add column if not exists inspection_checklist  jsonb,                     -- {items: [{label, required: true|false}]}
  add column if not exists site_id               uuid references public.sites(id);   -- NULL = 전체 적용, value = 사이트 한정

create index if not exists idx_safety_edu_crew_worksite
  on public.safety_education_library (crew_type, worksite_type);
create index if not exists idx_safety_edu_site_overlay
  on public.safety_education_library (site_id) where site_id is not null;
create index if not exists idx_safety_edu_ppe_gin
  on public.safety_education_library using gin (ppe_required);

comment on column public.safety_education_library.crew_type is
  '청구항 5 — 작업조(crew) 기준 위험성평가 조회 키.';
comment on column public.safety_education_library.worksite_type is
  '청구항 5 — 작업위치/공간 유형 (고소, 굴착, 밀폐, 전기, 일반).';
comment on column public.safety_education_library.applicable_time_window is
  '청구항 5 — 작업예정시간 매칭 (오전/오후/야간/계절).';
comment on column public.safety_education_library.ppe_required is
  '청구항 5 — 보호구 착용사항. ppe code 배열.';
comment on column public.safety_education_library.inspection_checklist is
  '청구항 5 — 안전점검 확인사항. {items: [...]} 구조.';
comment on column public.safety_education_library.site_id is
  '청구항 5 — 사이트별 커스텀 위험성평가 (NULL = 전체 표준).';

-- ─── 2. 안전약속 ↔ 위험성평가 자동 연결 (C9 + C5 결합) ─────────────────────
create table if not exists public.pledge_risk_assessments (
  pledge_id            uuid not null references public.claim13_pledges(id) on delete cascade,
  risk_assessment_id   uuid not null references public.safety_education_library(id),
  embedded_at_sign     boolean not null default true,
  created_at           timestamptz not null default now(),
  primary key (pledge_id, risk_assessment_id)
);

create index if not exists idx_pledge_risk_assessment
  on public.pledge_risk_assessments (risk_assessment_id);

comment on table public.pledge_risk_assessments is
  '청구항 5+9 — 안전약속 생성 시 자동 연결되는 위험성평가 항목. PDF/보고서 추적용.';

alter table public.pledge_risk_assessments enable row level security;
drop policy if exists "pledge_risk_assessments_read_via_pledge" on public.pledge_risk_assessments;
create policy "pledge_risk_assessments_read_via_pledge"
  on public.pledge_risk_assessments for select
  using (
    exists (
      select 1 from public.claim13_pledges p
      where p.id = pledge_risk_assessments.pledge_id
        and (
          exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid()
              and pr.role in ('ROOT','SUPER_ADMIN','HQ_ADMIN','HQ_OFFICER','SAFETY_OFFICER','SITE_ADMIN')
          )
          or exists (
            select 1 from public.nfc_workers w
            where w.id = p.worker_id and w.auth_user_id = auth.uid()
          )
        )
    )
  );

-- ─── 3. 보고서 검증 코드 (C11) ─────────────────────────────────────────────
create table if not exists public.report_verification_codes (
  report_id           uuid primary key,                                 -- legal_report_exports.report_id 와 동일
  verification_url    text not null,                                    -- /verify/{report_id}?h={hash}
  qr_code_svg         text not null,                                    -- inline SVG (서버 사이드 생성)
  perceptual_hash     text not null,                                    -- 인지 해시 (이미지 변조 감지용 dHash/pHash)
  report_type         text not null check (report_type in ('tbm','safety_edu','pledge','incident','esg')),
  site_id             uuid references public.sites(id),
  created_at          timestamptz not null default now(),
  last_verified_at    timestamptz,
  verify_count        int not null default 0
);

create index if not exists idx_report_verify_site_type
  on public.report_verification_codes (site_id, report_type, created_at desc);

comment on table public.report_verification_codes is
  '청구항 11 — 보고서마다 QR + 검증URL + 인지해시 생성. /verify/{report_id} 엔드포인트가 무결성 검사 후 결과 반환.';

alter table public.report_verification_codes enable row level security;

-- 누구나 검증 URL 로 읽기 가능 (anon 포함) — 단 row level 접근만, 데이터는 제한
drop policy if exists "report_verify_anon_read" on public.report_verification_codes;
create policy "report_verify_anon_read"
  on public.report_verification_codes for select
  using (true);

-- ─── 4. 작업중지 다국어 + 조치 결과 분리 (C12) ──────────────────────────────
alter table public.claim17_stop_work_interventions
  add column if not exists reason_lang                  text,                                                          -- 원문 언어 (워커 자국어)
  add column if not exists reason_translated_admin_lang text,                                                          -- 관리자 언어로 자동번역
  add column if not exists admin_lang                   text not null default 'ko',                                    -- 관리자 표준 언어
  add column if not exists crew_type                    text,                                                          -- 청구항 12 — 작업조 라우팅 키
  add column if not exists trigger_source               text check (trigger_source in ('worker_app','chat_safety_signal','manager_app','system_auto')),
  add column if not exists trigger_message_id           uuid references public.messages(id),
  add column if not exists action_owner_id              uuid references public.profiles(id),
  add column if not exists action_status                text check (action_status in ('received','investigating','acting','resolved','escalated','rejected')),
  add column if not exists action_result                text,
  add column if not exists action_completed_at          timestamptz,
  add column if not exists action_evidence_url          text;                                                          -- 사진/문서 URL

create index if not exists idx_stop_work_action_status_unresolved
  on public.claim17_stop_work_interventions (action_status)
  where action_status not in ('resolved','rejected');

create index if not exists idx_stop_work_crew_type
  on public.claim17_stop_work_interventions (crew_type) where crew_type is not null;

create index if not exists idx_stop_work_owner
  on public.claim17_stop_work_interventions (action_owner_id) where action_owner_id is not null;

comment on column public.claim17_stop_work_interventions.reason_lang is
  '청구항 12 — 작업중지 요청 원문 언어 (워커 자국어).';
comment on column public.claim17_stop_work_interventions.reason_translated_admin_lang is
  '청구항 12 — Cloud Translation 으로 관리자 언어 자동 번역. trigger 시 채워짐.';
comment on column public.claim17_stop_work_interventions.crew_type is
  '청구항 12 — 작업조 기준 라우팅 (예: 철근조 위험 → 철근 안전관리자).';
comment on column public.claim17_stop_work_interventions.action_status is
  '청구항 12 — 단계별 조치 상태. 단일 status 컬럼에서 5단계 트래킹 가능.';
comment on column public.claim17_stop_work_interventions.action_result is
  '청구항 12 — 조치 완료 결과 본문 (관리자 입력).';

-- ─── 5. 작업중지 조치 이력 (단계별 변경 추적용) ─────────────────────────────
create table if not exists public.stop_work_action_log (
  id                  uuid primary key default gen_random_uuid(),
  intervention_id     uuid not null references public.claim17_stop_work_interventions(id) on delete cascade,
  prev_status         text,
  new_status          text not null,
  actor_id            uuid references public.profiles(id),
  note                text,
  hash_chain_event_id uuid references public.claim13_audit_events(id),
  changed_at          timestamptz not null default now()
);

create index if not exists idx_swal_intervention
  on public.stop_work_action_log (intervention_id, changed_at desc);

comment on table public.stop_work_action_log is
  '청구항 12 — 작업중지 조치 단계별 변경 이력. 사후 감사용. 해시체인에도 연결.';

alter table public.stop_work_action_log enable row level security;

drop policy if exists "swal_admin_read" on public.stop_work_action_log;
create policy "swal_admin_read"
  on public.stop_work_action_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ROOT','SUPER_ADMIN','HQ_ADMIN','HQ_OFFICER','SAFETY_OFFICER','SITE_ADMIN')
    )
  );

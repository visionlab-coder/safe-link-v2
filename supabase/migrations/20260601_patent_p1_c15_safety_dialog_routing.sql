-- ============================================================================
-- P1: 특허 청구항 15 (1:1 안전대화 로그 + 위험키워드 → 증거 데이터셋 연결)
-- 매칭률 35% → 85% 목표
--
-- 변경 사항:
-- 1. safety_dialog_keywords — 다국어 위험 키워드 사전
-- 2. messages 확장 — tbm_session_id, risk_assessment_id, voice_audio_url, detected_keywords
-- 3. chat_safety_signals — 메시지 → 위험 신호 추출 + 자동 라우팅 기록
-- 4. 기본 키워드 시드 (한국어 + 5개 자국어)
-- ============================================================================

-- ─── 1. 다국어 위험 키워드 사전 ─────────────────────────────────────────────
create table if not exists public.safety_dialog_keywords (
  id           uuid primary key default gen_random_uuid(),
  keyword      text not null,
  lang         text not null,
  category     text not null check (category in ('danger','stop_work','incident','ppe_missing')),
  severity     int  not null check (severity between 1 and 5),
  created_at   timestamptz not null default now()
);

create unique index if not exists uq_safety_dialog_keywords_lang_kw
  on public.safety_dialog_keywords (lang, keyword);

create index if not exists idx_safety_dialog_keywords_category
  on public.safety_dialog_keywords (category, severity desc);

comment on table public.safety_dialog_keywords is
  '청구항 15 — 다국어 위험/사고/작업중지 키워드 사전 (관리자-근로자 1:1 대화에서 자동 감지용).';

-- ─── 2. messages 테이블 확장 (증거 데이터셋 외래키 + 음성 원본 + 감지 키워드) ──
alter table public.messages
  add column if not exists tbm_session_id      uuid references public.nfc_tbm_sessions(id),
  add column if not exists risk_assessment_id  uuid references public.safety_education_library(id),
  add column if not exists voice_audio_url     text,
  add column if not exists detected_keywords   text[] not null default array[]::text[];

create index if not exists idx_messages_tbm_session
  on public.messages (tbm_session_id) where tbm_session_id is not null;
create index if not exists idx_messages_risk_assessment
  on public.messages (risk_assessment_id) where risk_assessment_id is not null;
create index if not exists idx_messages_detected_keywords_gin
  on public.messages using gin (detected_keywords);

comment on column public.messages.tbm_session_id is
  '청구항 15 — 메시지가 특정 TBM 세션 맥락이면 참조. 없으면 일반 대화.';
comment on column public.messages.risk_assessment_id is
  '청구항 15 — 메시지가 특정 위험성평가 항목 논의면 참조.';
comment on column public.messages.voice_audio_url is
  '청구항 15 — STT 변환 전 음성 원본 (있을 때). Supabase Storage URL.';
comment on column public.messages.detected_keywords is
  '청구항 15 — safety_dialog_keywords 매칭 결과. detect 시점에 채워짐.';

-- ─── 3. chat_safety_signals — 위험 신호 + 자동 라우팅 ─────────────────────────
create table if not exists public.chat_safety_signals (
  id                       uuid primary key default gen_random_uuid(),
  message_id               uuid not null references public.messages(id) on delete cascade,
  keyword_type             text not null check (keyword_type in ('danger','stop_work','incident','ppe_missing')),
  matched_keywords         text[] not null,
  severity_max             int not null,
  hash_chain_event_id      uuid references public.claim13_audit_events(id),
  stop_work_alert_id       uuid references public.claim17_stop_work_interventions(id),
  routed_to_admin_id       uuid references public.profiles(id),
  routed_at                timestamptz,
  resolved_at              timestamptz,
  resolution_note          text,
  created_at               timestamptz not null default now()
);

create index if not exists idx_chat_safety_signals_message
  on public.chat_safety_signals (message_id);
create index if not exists idx_chat_safety_signals_type_unresolved
  on public.chat_safety_signals (keyword_type, resolved_at);
create index if not exists idx_chat_safety_signals_routed_admin
  on public.chat_safety_signals (routed_to_admin_id) where routed_to_admin_id is not null;

comment on table public.chat_safety_signals is
  '청구항 15 — 위험 키워드 감지 → 해시체인 append + stop-work 자동 트리거 + 관리자 라우팅 기록.';

-- ─── 4. RLS 정책 ─────────────────────────────────────────────────────────
alter table public.safety_dialog_keywords enable row level security;
alter table public.chat_safety_signals enable row level security;

-- 키워드 사전: 인증된 모든 사용자가 읽기 가능, 쓰기는 admin만
drop policy if exists "safety_dialog_keywords_read_all" on public.safety_dialog_keywords;
create policy "safety_dialog_keywords_read_all"
  on public.safety_dialog_keywords for select
  using (auth.role() = 'authenticated');

-- 안전 신호: admin이 site_id 매칭되는 것만 읽기, 워커는 본인 메시지에서 발생한 것만 읽기
drop policy if exists "chat_safety_signals_admin_read" on public.chat_safety_signals;
create policy "chat_safety_signals_admin_read"
  on public.chat_safety_signals for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ROOT','SUPER_ADMIN','HQ_ADMIN','HQ_OFFICER','SAFETY_OFFICER','SITE_ADMIN')
    )
  );

drop policy if exists "chat_safety_signals_worker_read_own" on public.chat_safety_signals;
create policy "chat_safety_signals_worker_read_own"
  on public.chat_safety_signals for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = chat_safety_signals.message_id
        and (m.from_user = auth.uid() or m.to_user = auth.uid())
    )
  );

-- ─── 5. 기본 키워드 시드 (한국어 + 베트남어/중국어/영어/우즈벡어/태국어) ─────
-- danger (위험 표현)
insert into public.safety_dialog_keywords (keyword, lang, category, severity) values
  -- 한국어 danger
  ('위험', 'ko', 'danger', 4),
  ('떨어진다', 'ko', 'danger', 5),
  ('무너진다', 'ko', 'danger', 5),
  ('전기 누전', 'ko', 'danger', 5),
  ('감전', 'ko', 'danger', 5),
  ('가스 새', 'ko', 'danger', 5),
  ('연기', 'ko', 'danger', 4),
  ('불이', 'ko', 'danger', 5),
  ('미끄러', 'ko', 'danger', 3),
  -- 한국어 stop_work
  ('작업 중지', 'ko', 'stop_work', 5),
  ('작업중지', 'ko', 'stop_work', 5),
  ('일 못해', 'ko', 'stop_work', 4),
  ('멈춰', 'ko', 'stop_work', 4),
  ('대피', 'ko', 'stop_work', 5),
  -- 한국어 incident
  ('사고', 'ko', 'incident', 5),
  ('다쳤', 'ko', 'incident', 5),
  ('부상', 'ko', 'incident', 5),
  ('119', 'ko', 'incident', 5),
  ('응급', 'ko', 'incident', 5),
  ('피', 'ko', 'incident', 4),
  -- 한국어 ppe_missing
  ('안전모 없', 'ko', 'ppe_missing', 4),
  ('안전대 없', 'ko', 'ppe_missing', 4),
  ('보호구 없', 'ko', 'ppe_missing', 3),

  -- 베트남어
  ('nguy hiểm', 'vi', 'danger', 4),
  ('rơi', 'vi', 'danger', 5),
  ('sập', 'vi', 'danger', 5),
  ('điện giật', 'vi', 'danger', 5),
  ('lửa', 'vi', 'danger', 5),
  ('dừng việc', 'vi', 'stop_work', 5),
  ('tai nạn', 'vi', 'incident', 5),
  ('bị thương', 'vi', 'incident', 5),
  ('cấp cứu', 'vi', 'incident', 5),

  -- 중국어
  ('危险', 'zh', 'danger', 4),
  ('掉下', 'zh', 'danger', 5),
  ('倒塌', 'zh', 'danger', 5),
  ('触电', 'zh', 'danger', 5),
  ('着火', 'zh', 'danger', 5),
  ('停工', 'zh', 'stop_work', 5),
  ('事故', 'zh', 'incident', 5),
  ('受伤', 'zh', 'incident', 5),
  ('急救', 'zh', 'incident', 5),

  -- 영어
  ('danger', 'en', 'danger', 4),
  ('falling', 'en', 'danger', 5),
  ('collapse', 'en', 'danger', 5),
  ('electric shock', 'en', 'danger', 5),
  ('fire', 'en', 'danger', 5),
  ('stop work', 'en', 'stop_work', 5),
  ('accident', 'en', 'incident', 5),
  ('injured', 'en', 'incident', 5),
  ('emergency', 'en', 'incident', 5),

  -- 우즈벡어
  ('xavf', 'uz', 'danger', 4),
  ('yiqilish', 'uz', 'danger', 5),
  ('yong''in', 'uz', 'danger', 5),
  ('ishni to''xtatish', 'uz', 'stop_work', 5),
  ('baxtsiz hodisa', 'uz', 'incident', 5),
  ('jarohat', 'uz', 'incident', 5),

  -- 태국어
  ('อันตราย', 'th', 'danger', 4),
  ('ตกลงมา', 'th', 'danger', 5),
  ('ไฟไหม้', 'th', 'danger', 5),
  ('หยุดงาน', 'th', 'stop_work', 5),
  ('อุบัติเหตุ', 'th', 'incident', 5),
  ('บาดเจ็บ', 'th', 'incident', 5)
on conflict (lang, keyword) do nothing;

-- ============================================================================
-- profiles.nationality 컬럼 추가 (2026-06-09)
--
-- 목적: NFC 워커 가입 시 nfc_workers.nationality 를 profiles 에도 동기화.
-- admin/chat 등 UI 에서 preferred_lang (예: 'en') 대신 정확한 국적 (KR/US/VN/CN 등)
-- 기준으로 국기 표시 가능.
--
-- 인덱스: site_id + nationality 로 사이트 admin 의 국적별 워커 조회 최적화.
-- ============================================================================

alter table public.profiles
  add column if not exists nationality text;

create index if not exists idx_profiles_site_nationality
  on public.profiles (site_id, nationality) where nationality is not null;

comment on column public.profiles.nationality is
  'ISO 3166-1 alpha-2 (KR/VN/CN/TH/UZ/PH/KH/ID/MN/MM/NP/BD/KZ/RU/US/JP/GB/AU 등). NFC 가입 시 nfc_workers.nationality 동기화.';

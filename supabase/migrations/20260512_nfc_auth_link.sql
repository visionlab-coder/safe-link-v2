-- NFC 자동 로그인: nfc_workers에 Supabase auth 연결 + 국가 자기선택 기록 컬럼 추가
-- auth_user_id: 근로자 매직링크 로그인용 (lazy 생성)
-- nationality_confirmed_at: 근로자가 직접 국가를 선택한 시각 (NULL = 관리자 입력 상태 = 재선택 필요)

ALTER TABLE public.nfc_workers
  ADD COLUMN IF NOT EXISTS auth_user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nationality_confirmed_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_nfc_workers_auth_user ON public.nfc_workers(auth_user_id);

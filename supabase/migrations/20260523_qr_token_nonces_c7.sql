-- ============================================================================
-- Red Team Fix C-7: QR 토큰 nonce/jti + 재사용 방지
-- Date: 2026-05-23
-- Issue: QR 토큰에 jti 없음 → 유효 기간 내 무제한 재사용(replay) 가능
-- Fix: 토큰 발급 시 nonce 삽입, enter 모드 사용 시 nonce 소각 (one-time use)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.qr_token_nonces (
  nonce       TEXT            PRIMARY KEY,
  worker_id   UUID            NOT NULL,
  site_id     UUID            NOT NULL,
  expires_at  TIMESTAMPTZ     NOT NULL,
  used_at     TIMESTAMPTZ     DEFAULT NULL,  -- NULL = 미사용, NOT NULL = 소각됨
  created_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- 만료된 nonce 자동 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_qr_token_nonces_expires ON public.qr_token_nonces (expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_token_nonces_worker  ON public.qr_token_nonces (worker_id);

-- service_role만 접근 (클라이언트 직접 접근 금지)
ALTER TABLE public.qr_token_nonces ENABLE ROW LEVEL SECURITY;
-- 정책 없음 → service_role만 접근 가능 (authenticated 역할은 모두 차단)

-- 만료 nonce 주기적 정리 (Supabase pg_cron이 있으면 활성화)
-- SELECT cron.schedule('qr-nonce-cleanup', '0 * * * *',
--   'DELETE FROM public.qr_token_nonces WHERE expires_at < now() - INTERVAL ''1 hour''');

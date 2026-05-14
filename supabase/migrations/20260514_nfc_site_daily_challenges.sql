-- SAFE-LINK NFC site daily challenge codes.
-- Adds a second proof for worker check-in/check-out so copied NFC URLs plus
-- spoofed GPS are not enough to create attendance records.

CREATE TABLE IF NOT EXISTS public.nfc_site_daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  work_date DATE NOT NULL,
  challenge_code TEXT NOT NULL CHECK (challenge_code ~ '^[0-9]{6}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (site_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_nfc_site_daily_challenges_site_date
  ON public.nfc_site_daily_challenges(site_id, work_date DESC);

ALTER TABLE public.nfc_site_daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage nfc site daily challenges" ON public.nfc_site_daily_challenges;
CREATE POLICY "Admins manage nfc site daily challenges"
  ON public.nfc_site_daily_challenges
  FOR ALL
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

COMMENT ON TABLE public.nfc_site_daily_challenges IS
  'Daily site challenge code shown by admins at the worksite and required for NFC check-in/check-out.';

-- SAFE-LINK NFC reuse, daily activation, and worksite geofence support.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geofence_radius_m INTEGER NOT NULL DEFAULT 300;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sites_latitude'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT chk_sites_latitude
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sites_longitude'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT chk_sites_longitude
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sites_geofence_radius'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT chk_sites_geofence_radius
      CHECK (geofence_radius_m BETWEEN 20 AND 5000);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nfc_worker_daily_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_out')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkin_location JSONB,
  checkout_location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_nfc_worker_daily_access_site_date
  ON public.nfc_worker_daily_access(site_id, work_date, status);

CREATE INDEX IF NOT EXISTS idx_nfc_worker_daily_access_worker_date
  ON public.nfc_worker_daily_access(worker_id, work_date DESC);

CREATE TABLE IF NOT EXISTS public.nfc_worker_safety_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  tbm_signed_at TIMESTAMPTZ,
  tbm_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  attendance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_daily_access_id UUID REFERENCES public.nfc_worker_daily_access(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_nfc_worker_safety_daily_logs_site_date
  ON public.nfc_worker_safety_daily_logs(site_id, work_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_nfc_worker_safety_daily_logs_worker_date
  ON public.nfc_worker_safety_daily_logs(worker_id, work_date DESC);

CREATE TABLE IF NOT EXISTS public.nfc_card_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.nfc_workers(id) ON DELETE SET NULL,
  sticker_id UUID REFERENCES public.nfc_worker_stickers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('issued', 'written', 'erased', 'reissued', 'revoked')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  site_id TEXT,
  tag_uid TEXT,
  sig_version INTEGER,
  issued_epoch BIGINT,
  ndef_bytes INTEGER,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_card_lifecycle_worker_created
  ON public.nfc_card_lifecycle_events(worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfc_card_lifecycle_sticker_created
  ON public.nfc_card_lifecycle_events(sticker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfc_card_lifecycle_site_created
  ON public.nfc_card_lifecycle_events(site_id, created_at DESC);

ALTER TABLE public.nfc_worker_daily_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_worker_safety_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_card_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage nfc daily access" ON public.nfc_worker_daily_access;
CREATE POLICY "Admins manage nfc daily access"
  ON public.nfc_worker_daily_access
  FOR ALL
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "Admins manage nfc worker safety daily logs" ON public.nfc_worker_safety_daily_logs;
CREATE POLICY "Admins manage nfc worker safety daily logs"
  ON public.nfc_worker_safety_daily_logs
  FOR ALL
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "Admins manage nfc card lifecycle events" ON public.nfc_card_lifecycle_events;
CREATE POLICY "Admins manage nfc card lifecycle events"
  ON public.nfc_card_lifecycle_events
  FOR ALL
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

CREATE OR REPLACE FUNCTION public.fn_touch_nfc_worker_daily_access_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nfc_worker_daily_access_updated_at ON public.nfc_worker_daily_access;
CREATE TRIGGER trg_nfc_worker_daily_access_updated_at
  BEFORE UPDATE ON public.nfc_worker_daily_access
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_nfc_worker_daily_access_updated_at();

DROP TRIGGER IF EXISTS trg_nfc_worker_safety_daily_logs_updated_at ON public.nfc_worker_safety_daily_logs;
CREATE TRIGGER trg_nfc_worker_safety_daily_logs_updated_at
  BEFORE UPDATE ON public.nfc_worker_safety_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_nfc_worker_daily_access_updated_at();

COMMENT ON TABLE public.nfc_worker_daily_access IS
  'Daily NFC access state. First valid worksite tap activates SAFE-LINK, later tap checks out and disables access for that work date.';

COMMENT ON TABLE public.nfc_worker_safety_daily_logs IS
  'Manager-facing daily safety log generated at worker NFC checkout. Includes TBM signature status, check-in time, and checkout time for attendance management.';

COMMENT ON TABLE public.nfc_card_lifecycle_events IS
  'Append-only NFC card lifecycle audit log for issue, write, erase, reissue, and revoke operations.';

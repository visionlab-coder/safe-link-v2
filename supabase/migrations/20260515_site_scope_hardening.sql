-- SAFE-LINK multi-site hardening for 30-site rollout.
-- This migration is intentionally non-destructive: it adds lookup indexes and
-- an operator view for duplicate identity hints instead of forcing a UNIQUE
-- constraint that could fail on existing pilot data.

CREATE INDEX IF NOT EXISTS idx_profiles_role_site
  ON public.profiles(role, site_id)
  WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nfc_workers_site_identity_active
  ON public.nfc_workers(assigned_site_id, name_initials, phone_last4)
  WHERE is_active = true
    AND assigned_site_id IS NOT NULL
    AND name_initials IS NOT NULL
    AND phone_last4 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nfc_tbm_sessions_site_status_started
  ON public.nfc_tbm_sessions(site_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfc_daily_access_site_date_status
  ON public.nfc_worker_daily_access(site_id, work_date, status);

CREATE OR REPLACE VIEW public.nfc_worker_identity_duplicates AS
SELECT
  assigned_site_id,
  name_initials,
  phone_last4,
  COUNT(*) AS worker_count,
  array_agg(id ORDER BY created_at) AS worker_ids
FROM public.nfc_workers
WHERE is_active = true
  AND assigned_site_id IS NOT NULL
  AND name_initials IS NOT NULL
  AND phone_last4 IS NOT NULL
GROUP BY assigned_site_id, name_initials, phone_last4
HAVING COUNT(*) > 1;

COMMENT ON VIEW public.nfc_worker_identity_duplicates IS
  'Active workers sharing the same site + name initials + phone last4. These rows must be cleaned before enabling fully frictionless site QR entry.';

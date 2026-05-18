-- ============================================================================
-- ADV-010: Prevent duplicate QR guest workers created by concurrent site entry
-- Date: 2026-05-18
--
-- The QR site-entry endpoint creates a minimal nfc_workers row with worker_code
-- prefixed by "QR-" when no active worker matches the submitted site + initials
-- + phone_last4. Two concurrent requests can both observe no match and insert
-- duplicate guest rows. A partial unique index closes that race.
--
-- Scope intentionally stays on QR guest workers only. Applying this uniqueness
-- to every active nfc_workers row would also block legitimate manually enrolled
-- workers who happen to share initials and phone last4 in the same site.
-- ============================================================================

DROP INDEX IF EXISTS public.uq_nfc_workers_site_initials_phone;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT count(*)
    INTO duplicate_count
  FROM (
    SELECT assigned_site_id, name_initials, phone_last4
    FROM public.nfc_workers
    WHERE is_active = true
      AND assigned_site_id IS NOT NULL
      AND name_initials IS NOT NULL
      AND phone_last4 IS NOT NULL
      AND worker_code LIKE 'QR-%'
    GROUP BY assigned_site_id, name_initials, phone_last4
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create QR guest worker unique index: % duplicate site+initials+phone_last4 groups exist',
      duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfc_guest_workers_site_initials_phone
  ON public.nfc_workers (assigned_site_id, name_initials, phone_last4)
  WHERE is_active = true
    AND assigned_site_id IS NOT NULL
    AND name_initials IS NOT NULL
    AND phone_last4 IS NOT NULL
    AND worker_code LIKE 'QR-%';

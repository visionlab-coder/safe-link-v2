-- Site-level SAFE-LINK access switch for NFC-operated worksites.

CREATE TABLE IF NOT EXISTS public.nfc_site_access_controls (
  site_id text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nfc_site_access_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage nfc site access controls" ON public.nfc_site_access_controls;
CREATE POLICY "Admins manage nfc site access controls"
  ON public.nfc_site_access_controls
  FOR ALL
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

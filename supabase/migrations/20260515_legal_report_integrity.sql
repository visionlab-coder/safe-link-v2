CREATE TABLE IF NOT EXISTS public.legal_report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL UNIQUE,
  report_type TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  data_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_tables TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  report_hash_alg TEXT NOT NULL DEFAULT 'SHA-256',
  report_hash TEXT NOT NULL CHECK (report_hash ~ '^[0-9a-f]{64}$'),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_report_exports_site_generated
  ON public.legal_report_exports(site_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_report_exports_type_generated
  ON public.legal_report_exports(report_type, generated_at DESC);

ALTER TABLE public.legal_report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read legal report exports" ON public.legal_report_exports;
CREATE POLICY "Admins read legal report exports"
  ON public.legal_report_exports
  FOR SELECT
  TO authenticated
  USING (public.is_safelink_admin());

DROP POLICY IF EXISTS "Admins insert legal report exports" ON public.legal_report_exports;
CREATE POLICY "Admins insert legal report exports"
  ON public.legal_report_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_safelink_admin());

DROP POLICY IF EXISTS "Admins void legal report exports" ON public.legal_report_exports;
CREATE POLICY "Admins void legal report exports"
  ON public.legal_report_exports
  FOR UPDATE
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

COMMENT ON TABLE public.legal_report_exports IS
  'Legal evidence metadata for generated SAFE-LINK reports. Original report records should be voided, not deleted.';

ALTER TABLE public.nfc_workers
  ADD COLUMN IF NOT EXISTS erp_external_id TEXT,
  ADD COLUMN IF NOT EXISTS erp_match_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS erp_matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erp_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_nfc_workers_erp_external_id
  ON public.nfc_workers(erp_external_id)
  WHERE erp_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nfc_workers_erp_match_status
  ON public.nfc_workers(erp_match_status);

COMMENT ON COLUMN public.nfc_workers.erp_external_id IS
  'External worker id from Seowon ERP labor API after name-based matching.';

COMMENT ON COLUMN public.nfc_workers.erp_match_status IS
  'ERP matching state: pending, matched, ambiguous, not_found, disabled.';

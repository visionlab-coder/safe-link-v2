ALTER TABLE public.nfc_workers
  ADD COLUMN IF NOT EXISTS name_initials TEXT,
  ADD COLUMN IF NOT EXISTS phone_last4 TEXT;

CREATE INDEX IF NOT EXISTS idx_nfc_workers_identity_hint
  ON public.nfc_workers(name_initials, phone_last4)
  WHERE name_initials IS NOT NULL OR phone_last4 IS NOT NULL;

COMMENT ON COLUMN public.nfc_workers.name_initials IS
  'Minimal identity hint written into NFC/QR URL, e.g. Roman initials. Not a full legal name.';

COMMENT ON COLUMN public.nfc_workers.phone_last4 IS
  'Minimal identity hint written into NFC/QR URL: last 4 digits only.';

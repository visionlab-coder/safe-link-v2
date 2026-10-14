-- Existing accounts remain on legacy login until their date is explicitly registered.
-- Store YYMMDD verbatim, preserving leading zeroes without inferring a century.
ALTER TABLE worker_quick_login_credentials ADD COLUMN birth_date VARCHAR(6);
ALTER TABLE worker_quick_login_credentials ADD CONSTRAINT worker_birth_date_format
  CHECK (birth_date IS NULL OR CASE WHEN birth_date ~ '^[0-9]{6}$' THEN
    make_date(2000 + substring(birth_date,1,2)::int,
      substring(birth_date,3,2)::int, substring(birth_date,5,2)::int) IS NOT NULL
    ELSE false END);
-- A date + last four digits must resolve to exactly one enabled account, across sites.
CREATE UNIQUE INDEX uq_worker_birth_login
  ON worker_quick_login_credentials (birth_date, phone_last4)
  WHERE enabled = true AND birth_date IS NOT NULL;

-- Keep historical manual approvals; new self-conversions must not claim ERP/contract verification.
ALTER TABLE worker_upgrade_requests DROP CONSTRAINT worker_upgrade_requests_check;
ALTER TABLE worker_upgrade_requests ADD CONSTRAINT worker_upgrade_verification_check
  CHECK (status <> 'APPROVED' OR (decided_by IS NOT NULL AND
    verification_method IN ('MANUAL_CONTRACT_CHECK','SELF_REPORTED_IRIS')));

CREATE TABLE site_name_localizations (
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL,
  source_name TEXT NOT NULL,
  translated_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, language)
);

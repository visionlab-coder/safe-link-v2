ALTER TABLE tbm_notices
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX uq_tbm_notices_site_idempotency
  ON tbm_notices(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- No dedicated Claim 24 table is required. The ESG report API aggregates existing
-- operational tables. This marker migration keeps the claim implementation
-- auditable alongside the other 2026-05-09 claim migrations.

CREATE INDEX IF NOT EXISTS idx_claim13_hash_chain_events_site_created
    ON public.claim13_hash_chain_events(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claim13_pledges_site_created
    ON public.claim13_pledges(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claim17_stop_work_site_created
    ON public.claim17_stop_work_interventions(site_id, created_at DESC);

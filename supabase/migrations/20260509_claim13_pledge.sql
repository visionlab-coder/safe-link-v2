CREATE TABLE IF NOT EXISTS public.claim13_pledges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tbm_session_id UUID REFERENCES public.nfc_tbm_sessions(id) ON DELETE SET NULL,
    worker_id UUID NOT NULL,
    site_id TEXT NOT NULL,
    pledge_content TEXT NOT NULL,
    pledge_content_hash TEXT NOT NULL,
    nfc_uid TEXT,
    signature_data TEXT,
    client_ip TEXT,
    approved_at TIMESTAMPTZ,
    hash_chain_event_id BIGINT REFERENCES public.claim13_hash_chain_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim13_pledges_session
    ON public.claim13_pledges(tbm_session_id);

CREATE INDEX IF NOT EXISTS idx_claim13_pledges_worker
    ON public.claim13_pledges(worker_id, created_at DESC);

ALTER TABLE public.claim13_pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workers create own pledge" ON public.claim13_pledges;
CREATE POLICY "workers create own pledge"
    ON public.claim13_pledges
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "read pledge" ON public.claim13_pledges;
CREATE POLICY "read pledge"
    ON public.claim13_pledges
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "update own pledge" ON public.claim13_pledges;
CREATE POLICY "update own pledge"
    ON public.claim13_pledges
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- SAFE-LINK claims 13 and 17 additive migration.
-- Claim 13: SHA-256 hash-chain audit trail.
-- Claim 17: improved stop-work authority lifecycle.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.claim13_hash_chain_events (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    previous_hash TEXT CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
    current_hash TEXT NOT NULL CHECK (current_hash ~ '^[0-9a-f]{64}$'),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim13_hash_chain_site_id
    ON public.claim13_hash_chain_events(site_id, id);

CREATE INDEX IF NOT EXISTS idx_claim13_hash_chain_entity
    ON public.claim13_hash_chain_events(entity_type, entity_id, id);

ALTER TABLE public.claim13_hash_chain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim13 hash events readable by authenticated users"
    ON public.claim13_hash_chain_events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "claim13 hash events service inserted only"
    ON public.claim13_hash_chain_events FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.append_claim13_audit_event(
    p_site_id TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_event_type TEXT,
    p_payload JSONB,
    p_payload_sha256 TEXT,
    p_created_by UUID DEFAULT NULL
)
RETURNS public.claim13_hash_chain_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_previous_hash TEXT;
    v_created_at TIMESTAMPTZ := now();
    v_current_hash TEXT;
    v_row public.claim13_hash_chain_events;
BEGIN
    IF p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'payload_sha256 must be a lowercase SHA-256 hex digest';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('claim13:' || p_site_id));

    SELECT current_hash
      INTO v_previous_hash
      FROM public.claim13_hash_chain_events
     WHERE site_id = p_site_id
     ORDER BY id DESC
     LIMIT 1;

    v_current_hash := encode(
        digest(
            concat_ws('|',
                coalesce(v_previous_hash, ''),
                p_site_id,
                p_entity_type,
                p_entity_id,
                p_event_type,
                p_payload_sha256,
                extract(epoch from v_created_at)::TEXT,
                coalesce(p_created_by::TEXT, '')
            ),
            'sha256'
        ),
        'hex'
    );

    INSERT INTO public.claim13_hash_chain_events (
        site_id,
        entity_type,
        entity_id,
        event_type,
        event_payload,
        payload_sha256,
        previous_hash,
        current_hash,
        created_by,
        created_at
    )
    VALUES (
        p_site_id,
        p_entity_type,
        p_entity_id,
        p_event_type,
        coalesce(p_payload, '{}'::jsonb),
        p_payload_sha256,
        v_previous_hash,
        v_current_hash,
        p_created_by,
        v_created_at
    )
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_claim13_hash_chain(p_site_id TEXT)
RETURNS TABLE (
    event_id BIGINT,
    expected_previous_hash TEXT,
    actual_previous_hash TEXT,
    expected_current_hash TEXT,
    actual_current_hash TEXT,
    reason TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH ordered AS (
    SELECT
        e.*,
        lag(e.current_hash) OVER (PARTITION BY e.site_id ORDER BY e.id) AS lag_hash
    FROM public.claim13_hash_chain_events e
    WHERE e.site_id = p_site_id
),
recomputed AS (
    SELECT
        ordered.*,
        encode(
            digest(
                concat_ws('|',
                    coalesce(ordered.previous_hash, ''),
                    ordered.site_id,
                    ordered.entity_type,
                    ordered.entity_id,
                    ordered.event_type,
                    ordered.payload_sha256,
                    extract(epoch from ordered.created_at)::TEXT,
                    coalesce(ordered.created_by::TEXT, '')
                ),
                'sha256'
            ),
            'hex'
        ) AS recomputed_hash
    FROM ordered
)
SELECT
    id AS event_id,
    lag_hash AS expected_previous_hash,
    previous_hash AS actual_previous_hash,
    recomputed_hash AS expected_current_hash,
    current_hash AS actual_current_hash,
    CASE
        WHEN previous_hash IS DISTINCT FROM lag_hash THEN 'previous_hash_mismatch'
        WHEN current_hash IS DISTINCT FROM recomputed_hash THEN 'current_hash_mismatch'
        ELSE 'unknown'
    END AS reason
FROM recomputed
WHERE previous_hash IS DISTINCT FROM lag_hash
   OR current_hash IS DISTINCT FROM recomputed_hash;
$$;

CREATE TABLE IF NOT EXISTS public.claim17_stop_work_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.stop_work_alerts(id) ON DELETE SET NULL,
    worker_id UUID NOT NULL,
    site_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    hazard_category TEXT NOT NULL DEFAULT 'unspecified',
    severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    preferred_lang TEXT NOT NULL DEFAULT 'ko',
    gps JSONB,
    photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'acknowledged', 'escalated', 'resolved', 'rejected')),
    escalation_due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim17_stop_work_site_status
    ON public.claim17_stop_work_interventions(site_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claim17_stop_work_worker
    ON public.claim17_stop_work_interventions(worker_id, created_at DESC);

ALTER TABLE public.claim17_stop_work_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers can create claim17 stop work"
    ON public.claim17_stop_work_interventions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "authenticated users can read claim17 stop work"
    ON public.claim17_stop_work_interventions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated users can update claim17 stop work"
    ON public.claim17_stop_work_interventions FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_claim17_stop_work_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim17_stop_work_updated_at ON public.claim17_stop_work_interventions;
CREATE TRIGGER trg_claim17_stop_work_updated_at
BEFORE UPDATE ON public.claim17_stop_work_interventions
FOR EACH ROW
EXECUTE FUNCTION public.touch_claim17_stop_work_updated_at();

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.claim13_hash_chain_events;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.claim17_stop_work_interventions;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

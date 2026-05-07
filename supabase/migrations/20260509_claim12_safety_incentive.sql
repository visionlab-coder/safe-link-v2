CREATE TABLE IF NOT EXISTS public.safety_equipment_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL,
    site_id TEXT NOT NULL,
    quiz_session_id TEXT,
    score_pct INTEGER NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
    equipment_type TEXT NOT NULL DEFAULT 'general',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_grants_worker
    ON public.safety_equipment_grants(worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_grants_site
    ON public.safety_equipment_grants(site_id, created_at DESC);

ALTER TABLE public.safety_equipment_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can manage safety grants" ON public.safety_equipment_grants;
CREATE POLICY "admin can manage safety grants"
    ON public.safety_equipment_grants
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Claim 16: stop-work priority routing table
-- SAFETY_OFFICER 우선 라우팅, 5분 미응답 시 SITE_MANAGER 에스컬레이션

CREATE TABLE IF NOT EXISTS public.stop_work_alert_routing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.stop_work_alerts(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL,
    admin_role TEXT NOT NULL,
    is_priority BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    escalation_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stop_work_routing_alert
    ON public.stop_work_alert_routing(alert_id);

CREATE INDEX IF NOT EXISTS idx_stop_work_routing_admin
    ON public.stop_work_alert_routing(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stop_work_routing_escalation
    ON public.stop_work_alert_routing(escalation_due_at)
    WHERE acknowledged_at IS NULL;

ALTER TABLE public.stop_work_alert_routing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routing readable by authenticated" ON public.stop_work_alert_routing;
CREATE POLICY "routing readable by authenticated"
    ON public.stop_work_alert_routing FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "routing service insert" ON public.stop_work_alert_routing;
CREATE POLICY "routing service insert"
    ON public.stop_work_alert_routing FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "routing admin update" ON public.stop_work_alert_routing;
CREATE POLICY "routing admin update"
    ON public.stop_work_alert_routing FOR UPDATE
    TO authenticated
    USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_work_alert_routing;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

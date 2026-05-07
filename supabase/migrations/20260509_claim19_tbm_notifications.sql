CREATE TABLE IF NOT EXISTS public.tbm_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tbm_session_id UUID NOT NULL,
    worker_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_retry_at TIMESTAMPTZ,
    channel TEXT NOT NULL DEFAULT 'push',
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_tbm_notif_session
    ON public.tbm_notification_log(tbm_session_id, worker_id);

ALTER TABLE public.tbm_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin notif rw" ON public.tbm_notification_log;
CREATE POLICY "admin notif rw"
    ON public.tbm_notification_log
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

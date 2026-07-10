-- SAFE-LINK V3 compatibility surface: TBM broadcast storage.
-- Current Next.js/Supabase TBM screens expect these two tables.

CREATE TABLE IF NOT EXISTS public.tbm_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_code TEXT,
  title TEXT NOT NULL DEFAULT 'TBM 안전 브리핑',
  content_ko TEXT NOT NULL,
  risk_level INTEGER NOT NULL DEFAULT 1 CHECK (risk_level BETWEEN 1 AND 5),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbm_notices_site_created
  ON public.tbm_notices(site_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tbm_ack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tbm_id UUID NOT NULL REFERENCES public.tbm_notices(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_name TEXT,
  signature_data TEXT,
  ack_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tbm_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_tbm_ack_tbm
  ON public.tbm_ack(tbm_id);

CREATE INDEX IF NOT EXISTS idx_tbm_ack_worker
  ON public.tbm_ack(worker_id);

ALTER TABLE public.tbm_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbm_ack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tbm_notices_select_policy" ON public.tbm_notices;
CREATE POLICY "tbm_notices_select_policy"
  ON public.tbm_notices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER')
          OR (
            p.role IN ('SAFETY_OFFICER', 'SITE_ADMIN', 'SAFETY_MANAGER', 'WORKER')
            AND p.site_id IS NOT NULL
            AND p.site_id = tbm_notices.site_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "tbm_notices_insert_admin_policy" ON public.tbm_notices;
CREATE POLICY "tbm_notices_insert_admin_policy"
  ON public.tbm_notices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER')
          OR (
            p.role IN ('SAFETY_OFFICER', 'SITE_ADMIN', 'SAFETY_MANAGER')
            AND p.site_id IS NOT NULL
            AND p.site_id = tbm_notices.site_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "tbm_ack_select_policy" ON public.tbm_ack;
CREATE POLICY "tbm_ack_select_policy"
  ON public.tbm_ack
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = worker_id
    OR EXISTS (
      SELECT 1
      FROM public.tbm_notices n
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE n.id = tbm_ack.tbm_id
        AND (
          p.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER')
          OR (
            p.role IN ('SAFETY_OFFICER', 'SITE_ADMIN', 'SAFETY_MANAGER')
            AND p.site_id IS NOT NULL
            AND p.site_id = n.site_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "tbm_ack_insert_worker_policy" ON public.tbm_ack;
CREATE POLICY "tbm_ack_insert_worker_policy"
  ON public.tbm_ack
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = worker_id
    AND EXISTS (
      SELECT 1
      FROM public.tbm_notices n
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE n.id = tbm_ack.tbm_id
        AND p.role = 'WORKER'
        AND p.site_id IS NOT NULL
        AND p.site_id = n.site_id
    )
  );

GRANT SELECT ON public.tbm_notices TO authenticated;
GRANT SELECT, INSERT ON public.tbm_ack TO authenticated;
GRANT ALL ON public.tbm_notices TO service_role;
GRANT ALL ON public.tbm_ack TO service_role;

NOTIFY pgrst, 'reload schema';

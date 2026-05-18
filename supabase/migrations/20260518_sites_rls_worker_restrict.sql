-- ============================================================================
-- H-08: Harden sites SELECT RLS
-- Date: 2026-05-18
--
-- Risk:
--   A previous policy exposed all sites to every authenticated user, including
--   WORKER accounts. Rollout site names, addresses, codes, and geofence metadata
--   should not be globally visible to workers.
--
-- Access model:
--   - is_safelink_admin(): can read and write every site.
--   - WORKER: can read only the site referenced by profiles.site_id.
--   - unauthenticated: no access.
-- ============================================================================

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Remove every known broad/legacy SELECT policy.
DROP POLICY IF EXISTS "sites_select_policy" ON public.sites;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.sites;
DROP POLICY IF EXISTS "sites_authenticated_select" ON public.sites;
DROP POLICY IF EXISTS "Anyone authenticated can view sites" ON public.sites;

CREATE POLICY "sites_select_policy"
  ON public.sites FOR SELECT
  TO authenticated
  USING (
    public.is_safelink_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND upper(profiles.role::text) = 'WORKER'
        AND profiles.site_id IS NOT NULL
        AND profiles.site_id::text = sites.id::text
    )
  );

-- Replace legacy write policies with one admin-only write policy.
DROP POLICY IF EXISTS "sites_admin_write_policy" ON public.sites;
DROP POLICY IF EXISTS "System roots can manage sites" ON public.sites;
DROP POLICY IF EXISTS "admins insert sites" ON public.sites;
DROP POLICY IF EXISTS "admins update sites" ON public.sites;
DROP POLICY IF EXISTS "admins delete sites" ON public.sites;

CREATE POLICY "sites_admin_write_policy"
  ON public.sites FOR ALL
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

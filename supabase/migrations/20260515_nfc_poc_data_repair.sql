-- Repair POC data created before the NFC/site-code flow was stabilized.

-- 1) Admin profiles that stored a worksite name in profiles.site_code but
--    missed profiles.site_id get a matching site row.
DO $$
DECLARE
  has_code boolean;
  has_metadata boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = 'code'
  ) INTO has_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = 'metadata'
  ) INTO has_metadata;

  IF has_code AND has_metadata THEN
    INSERT INTO public.sites (code, name, metadata)
    SELECT DISTINCT ON (lower(btrim(p.site_code)))
      upper(btrim(p.site_code)) AS code,
      btrim(p.site_code) AS name,
      jsonb_build_object('source', 'poc_repair_from_profile_site_code')
    FROM public.profiles p
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND btrim(p.site_code) <> ''
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
      AND NOT EXISTS (
        SELECT 1
        FROM public.sites s
        WHERE lower(coalesce(s.name, s.code)) = lower(btrim(p.site_code))
           OR lower(s.code) = lower(btrim(p.site_code))
      )
    ORDER BY lower(btrim(p.site_code)), btrim(p.site_code);
  ELSIF has_code THEN
    INSERT INTO public.sites (code, name)
    SELECT DISTINCT ON (lower(btrim(p.site_code)))
      upper(btrim(p.site_code)) AS code,
      btrim(p.site_code) AS name
    FROM public.profiles p
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND btrim(p.site_code) <> ''
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
      AND NOT EXISTS (
        SELECT 1
        FROM public.sites s
        WHERE lower(coalesce(s.name, s.code)) = lower(btrim(p.site_code))
           OR lower(s.code) = lower(btrim(p.site_code))
      )
    ORDER BY lower(btrim(p.site_code)), btrim(p.site_code);
  ELSIF has_metadata THEN
    INSERT INTO public.sites (name, metadata)
    SELECT DISTINCT
      btrim(p.site_code) AS name,
      jsonb_build_object('source', 'poc_repair_from_profile_site_code')
    FROM public.profiles p
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND btrim(p.site_code) <> ''
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
      AND NOT EXISTS (
        SELECT 1
        FROM public.sites s
        WHERE lower(s.name) = lower(btrim(p.site_code))
      );
  ELSE
    INSERT INTO public.sites (name)
    SELECT DISTINCT
      btrim(p.site_code) AS name
    FROM public.profiles p
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND btrim(p.site_code) <> ''
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN')
      AND NOT EXISTS (
        SELECT 1
        FROM public.sites s
        WHERE lower(s.name) = lower(btrim(p.site_code))
      );
  END IF;
END $$;

-- 2) Attach those admin profiles to the matching site.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = 'code'
  ) THEN
    UPDATE public.profiles p
    SET site_id = s.id
    FROM public.sites s
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND (
        lower(coalesce(s.name, s.code)) = lower(btrim(p.site_code))
        OR lower(s.code) = lower(btrim(p.site_code))
      )
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN');
  ELSE
    UPDATE public.profiles p
    SET site_id = s.id
    FROM public.sites s
    WHERE p.site_id IS NULL
      AND p.site_code IS NOT NULL
      AND lower(s.name) = lower(btrim(p.site_code))
      AND upper(coalesce(p.role, '')) IN ('HQ_ADMIN', 'SAFETY_OFFICER', 'HQ_OFFICER', 'ROOT', 'SUPER_ADMIN');
  END IF;
END $$;

-- 3) Existing NFC workers created while the admin profile had no site_id
--    inherit the creator admin's repaired site_id.
UPDATE public.nfc_workers w
SET assigned_site_id = p.site_id::text
FROM public.profiles p
WHERE (w.assigned_site_id IS NULL OR btrim(w.assigned_site_id) = '')
  AND w.created_by = p.id
  AND p.site_id IS NOT NULL;

-- Repair NFC workers whose assigned_site_id stored a site code/name instead of sites.id.

DO $$
DECLARE
  has_code boolean;
  has_site_code boolean;
  join_extra text := '';
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
      AND column_name = 'site_code'
  ) INTO has_site_code;

  IF has_code THEN
    join_extra := join_extra || ' OR lower(btrim(w.assigned_site_id)) = lower(btrim(s.code))';
  END IF;

  IF has_site_code THEN
    join_extra := join_extra || ' OR lower(btrim(w.assigned_site_id)) = lower(btrim(s.site_code))';
  END IF;

  EXECUTE '
    WITH matched_site AS (
      SELECT DISTINCT ON (w.id)
        w.id AS worker_id,
        s.id AS site_id
      FROM public.nfc_workers w
      JOIN public.sites s
        ON lower(btrim(w.assigned_site_id)) = lower(btrim(s.id::text))
        OR lower(btrim(w.assigned_site_id)) = lower(btrim(s.name))
        ' || join_extra || '
      WHERE w.assigned_site_id IS NOT NULL
        AND btrim(w.assigned_site_id) <> ''''
        AND w.assigned_site_id !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''
      ORDER BY w.id, s.id
    )
    UPDATE public.nfc_workers w
    SET assigned_site_id = m.site_id::text
    FROM matched_site m
    WHERE w.id = m.worker_id
  ';
END $$;

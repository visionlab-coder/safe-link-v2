-- Human-readable worksite codes.
-- Internal relations keep using sites.id (uuid); this code is for admin/operator display.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS site_code text;

CREATE OR REPLACE FUNCTION public.generate_site_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate :=
      'SL-' ||
      to_char(timezone('Asia/Seoul', now()), 'YYMMDD') ||
      '-' ||
      lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.sites
      WHERE site_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

UPDATE public.sites
SET site_code = public.generate_site_code()
WHERE site_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_site_code_unique
  ON public.sites (site_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sites_site_code_format'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT chk_sites_site_code_format
      CHECK (site_code ~ '^SL-[0-9]{6}-[0-9]{4}$');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_site_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.site_code IS NULL OR btrim(NEW.site_code) = '' THEN
    NEW.site_code := public.generate_site_code();
  ELSE
    NEW.site_code := upper(btrim(NEW.site_code));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sites_site_code ON public.sites;
CREATE TRIGGER trg_sites_site_code
  BEFORE INSERT ON public.sites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_code();

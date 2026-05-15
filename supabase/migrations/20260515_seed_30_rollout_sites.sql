-- SAFE-LINK 30-site rollout seed.
-- Internal joins keep using sites.id (UUID). Operator-friendly site codes are
-- stored in sites.code because sites.site_code is reserved for SL-YYMMDD-XXXX.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS rollout_status text NOT NULL DEFAULT 'standby';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sites_rollout_status'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT chk_sites_rollout_status
      CHECK (rollout_status IN ('pilot', 'standby', 'active', 'inactive'));
  END IF;
END;
$$;

WITH normalized AS (
  SELECT
    id,
    upper(btrim(code)) AS normalized_code,
    row_number() OVER (PARTITION BY lower(btrim(code)) ORDER BY created_at, id) AS rn
  FROM public.sites
  WHERE code IS NOT NULL
    AND btrim(code) <> ''
)
UPDATE public.sites s
SET
  code = CASE
    WHEN n.rn = 1 THEN n.normalized_code
    ELSE n.normalized_code || '-DUP' || n.rn::text
  END
FROM normalized n
WHERE s.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_code_unique_ci
  ON public.sites (lower(code))
  WHERE code IS NOT NULL;

DO $$
DECLARE
  site_row record;
BEGIN
  FOR site_row IN
    SELECT *
    FROM (
      VALUES
        (1,  '식사동현장',             'SIKSA',                'standby'),
        (2,  '청주사직1공구(대우)',    'CJ-SAJIK1-DAEWOO',     'pilot'),
        (3,  '장성파인대우',           'JS-PINE-DAEWOO',       'standby'),
        (4,  '양산사송',               'YANG-SASONG',          'standby'),
        (5,  '철산역자이',             'CS-XI',                'standby'),
        (6,  '청담서원빌딩',           'CD-SEOWON-BLDG',       'standby'),
        (7,  '신광교 지산센터',        'SGG-JISAN',            'standby'),
        (8,  '동탄대우',               'DT-DAEWOO',            'standby'),
        (9,  '안성현대차',             'AS-HYUNDAI',           'standby'),
        (10, '남양주왕숙(대우)',       'NYJ-WANGSUK-DAEWOO',   'standby'),
        (11, '남양주진접(디엘)',       'NYJ-JINJEOP-DL',       'standby'),
        (12, '원주무실',               'WJ-MUSIL',             'standby'),
        (13, '부산에코3차(31BL)',      'BS-ECO3-31BL',         'standby'),
        (14, '탕정대우',               'TJ-DAEWOO',            'standby'),
        (15, '평택대우A공구',          'PT-DAEWOO-A',          'standby'),
        (16, '탕정디엘',               'TJ-DL',                'standby'),
        (17, '유원제일1차',            'YW-JEIL1',             'standby'),
        (18, '성수동 업무시설',        'SS-OFFICE',            'standby'),
        (19, '과천G-TOWM',             'GC-GTOWN',             'pilot'),
        (20, '과천자이',               'GC-XI',                'standby'),
        (21, '성남산성대우',           'SN-SANSEONG-DAEWOO',   'standby'),
        (22, '울산문수로',             'US-MUNSURO',           'standby'),
        (23, '여수글렌츠현장1공구',    'YS-GLENZ-1',           'standby'),
        (24, '이천자이',               'IC-XI',                'standby'),
        (25, '부산범일대우',           'BS-BEOMIL-DAEWOO',     'standby'),
        (26, '의정부푸르지오',         'UJB-PRUGIO',           'standby'),
        (27, '부산에코2차(13BL)',      'BS-ECO2-13BL',         'standby'),
        (28, '고양삼송',               'GY-SAMSUNG',           'standby'),
        (29, '울산야음동',             'US-YAEUM',             'standby'),
        (30, '미정',                   'SITE-030',             'standby')
    ) AS v(seq, name, code, rollout_status)
  LOOP
    UPDATE public.sites
    SET
      name = site_row.name,
      code = site_row.code,
      rollout_status = site_row.rollout_status
    WHERE lower(code) = lower(site_row.code);

    IF NOT FOUND THEN
      INSERT INTO public.sites (name, code, rollout_status)
      VALUES (site_row.name, site_row.code, site_row.rollout_status);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.sites.code IS
  'Operator-friendly site code, e.g. CJ-SAJIK1-DAEWOO. Use this for printed QR/admin UI.';

COMMENT ON COLUMN public.sites.rollout_status IS
  'Rollout state for staged deployment: pilot, standby, active, inactive.';

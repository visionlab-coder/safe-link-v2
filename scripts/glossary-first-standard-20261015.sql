-- User-authorized cleanup of CURRENT multiple-choice standards, not future input policy.
-- Original values are retained inside the operational DB audit history for recovery.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE construction_glossary IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE glossary_first_standard_changes ON COMMIT DROP AS
SELECT g.id, g.slang, g.standard AS old_standard, g.is_active,
       btrim((regexp_split_to_array(g.standard, E'[,，/;；\\n]'))[1]) AS new_standard,
       to_jsonb(g) AS before_row
FROM construction_glossary g
WHERE regexp_replace(g.standard, '[（(].*$', '') ~ E'[,，/;；\\n]'
  -- This slash is embedded in an explanation, not a list of alternative standards.
  AND NOT (g.slang='고도리' AND g.standard='철탑/전봇대 시공 시 자재 가조립 인력');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM glossary_first_standard_changes WHERE new_standard='') THEN
    RAISE EXCEPTION 'empty_first_standard';
  END IF;
END $$;
UPDATE construction_glossary g SET standard=c.new_standard
FROM glossary_first_standard_changes c WHERE g.id=c.id AND g.standard=c.old_standard;
INSERT INTO audit_logs(action,resource_type,resource_id,decision,reason,metadata)
SELECT 'ops.glossary.first_standard','construction_glossary',id::text,'ALLOWED',
       'user_requested_first_alternative_20261015',
       jsonb_build_object('before',before_row,'afterStandard',new_standard)
FROM glossary_first_standard_changes;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM glossary_first_standard_changes c
             JOIN construction_glossary g ON g.id=c.id
             WHERE g.standard<>c.new_standard OR g.is_active<>c.is_active) THEN
    RAISE EXCEPTION 'first_standard_verification_failed';
  END IF;
END $$;
SELECT count(*) AS changed, count(*) FILTER (WHERE NOT is_active) AS inactive_preserved
FROM glossary_first_standard_changes;
COMMIT;

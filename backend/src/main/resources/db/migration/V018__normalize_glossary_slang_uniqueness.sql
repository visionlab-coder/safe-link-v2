UPDATE construction_glossary
SET slang = lower(btrim(slang)),
    updated_at = now()
WHERE slang <> lower(btrim(slang));

CREATE UNIQUE INDEX uq_construction_glossary_slang_normalized
ON construction_glossary ((lower(btrim(slang))));

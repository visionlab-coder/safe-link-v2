ALTER TABLE tbm_notices ADD COLUMN summary_text TEXT;
ALTER TABLE tbm_notices ADD CONSTRAINT tbm_summary_length CHECK (summary_text IS NULL OR length(summary_text) <= 12000);

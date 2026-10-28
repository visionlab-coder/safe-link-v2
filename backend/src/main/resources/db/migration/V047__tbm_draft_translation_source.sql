-- Preserve speech source separately from the Korean display draft. Existing drafts remain unchanged.
ALTER TABLE tbm_live_drafts ADD COLUMN source_text text;

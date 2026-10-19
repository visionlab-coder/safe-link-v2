ALTER TABLE live_broadcast_sessions ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Preserve the real last activity across deploys; deploying must not renew a stale broadcast.
UPDATE live_broadcast_sessions s SET last_activity_at = greatest(s.started_at,
    (SELECT max(e.created_at) FROM live_translation_events e WHERE e.session_id=s.session_id),
    (SELECT d.updated_at FROM tbm_live_drafts d WHERE d.session_id=s.session_id));

CREATE FUNCTION touch_tbm_broadcast_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.content_ko IS NOT DISTINCT FROM OLD.content_ko THEN RETURN NEW; END IF;
    END IF;
    UPDATE live_broadcast_sessions SET last_activity_at=clock_timestamp()
    WHERE session_id=NEW.session_id AND active;
    RETURN NEW;
END;
$$;
CREATE TRIGGER live_translation_activity AFTER INSERT ON live_translation_events
    FOR EACH ROW EXECUTE FUNCTION touch_tbm_broadcast_activity();
CREATE TRIGGER tbm_draft_activity AFTER INSERT OR UPDATE ON tbm_live_drafts
    FOR EACH ROW EXECUTE FUNCTION touch_tbm_broadcast_activity();

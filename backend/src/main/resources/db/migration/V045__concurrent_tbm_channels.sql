-- Empty TBM trade_types is the independent site-wide channel; nonempty arrays
-- reserve only their own trades. Never terminate or rewrite an existing session.
DROP INDEX IF EXISTS uq_live_broadcast_sessions_active_site;

CREATE FUNCTION enforce_live_tbm_channels() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.active THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(737037);
  IF EXISTS (
    SELECT 1 FROM live_broadcast_sessions s
    WHERE s.site_id=NEW.site_id AND s.active AND s.session_id<>NEW.session_id
      AND (left(s.session_id,4)<>'tbm_' OR left(NEW.session_id,4)<>'tbm_'
        OR (s.trade_types='[]'::jsonb AND NEW.trade_types='[]'::jsonb)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.trade_types) t(value)
                   WHERE s.trade_types ? t.value))
  ) THEN
    RAISE EXCEPTION 'tbm_trade_live_conflict' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER live_tbm_channels_guard
BEFORE INSERT OR UPDATE OF active,site_id,trade_types ON live_broadcast_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_live_tbm_channels();

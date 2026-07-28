CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  event_row RECORD;
  current_site_id BIGINT := NULL;
  previous_event_hash TEXT := NULL;
  recalculated_hash TEXT;
BEGIN
  FOR event_row IN
    SELECT id, site_id, entity_type, entity_id, event_type, payload
    FROM claim13_hash_chain_events
    ORDER BY site_id, id
    FOR UPDATE
  LOOP
    IF current_site_id IS DISTINCT FROM event_row.site_id THEN
      current_site_id := event_row.site_id;
      previous_event_hash := NULL;
    END IF;

    recalculated_hash := encode(
      digest(
        convert_to(
          event_row.site_id::text || '|' ||
          event_row.entity_type || '|' ||
          event_row.entity_id || '|' ||
          event_row.event_type || '|' ||
          event_row.payload::text || '|' ||
          coalesce(previous_event_hash, ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    UPDATE claim13_hash_chain_events
    SET previous_hash = previous_event_hash,
        event_hash = recalculated_hash
    WHERE id = event_row.id;

    previous_event_hash := recalculated_hash;
  END LOOP;
END
$$;

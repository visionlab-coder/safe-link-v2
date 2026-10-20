-- User approved ALL existing sites' worker-home notifications.
-- Fixed read-only production snapshot: 2026-10-20 06:57:22.579613 UTC, max ID 1379.
-- Does NOT hide later publications, alter TBM status, delete content, or fabricate signatures.
-- Run only after V043. Re-running is idempotent. Audit keeps the exact target IDs.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE hidden_tbm_batch ON COMMIT DROP AS
WITH changed AS (
    UPDATE tbm_notices
    SET home_notification_hidden_at = now()
    WHERE id <= 1379 AND status = 'PUBLISHED'
      AND coalesce(published_at, created_at) <= timestamptz '2026-10-20 06:57:22.579613+00'
      AND home_notification_hidden_at IS NULL
    RETURNING id, site_id, home_notification_hidden_at
)
SELECT * FROM changed;
INSERT INTO audit_logs(site_id, action, resource_type, resource_id, decision, reason, metadata)
SELECT site_id, 'ops.tbm.hide_home_notification', 'tbm_notice', id::text, 'ALLOWED',
       'user_requested_all_existing_notifications_hidden_20261020',
       jsonb_build_object('previousHiddenAt', null, 'hiddenAt', home_notification_hidden_at,
                          'cutoff', '2026-10-20T06:57:22.579613Z')
FROM hidden_tbm_batch;
SELECT count(*) AS hidden_notifications FROM hidden_tbm_batch;
COMMIT;
-- Recovery (only with user approval): set home_notification_hidden_at=NULL for IDs
-- recorded by the exact action/reason above, retaining these audit entries.

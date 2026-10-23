-- Explicitly authorized one-time production fixture. Does not convert the account.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE worker_upgrade_requests, worker_test_iris_reservations IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    PERFORM 1 FROM users u JOIN worker_quick_login_credentials c ON c.user_id=u.id
      WHERE u.id=1474 AND c.birth_date='991111' AND c.enabled AND u.account_status='ACTIVE'
      FOR UPDATE OF u;
    IF NOT FOUND OR (SELECT count(*) FROM worker_quick_login_credentials WHERE birth_date='991111' AND enabled) <> 1
       OR (SELECT array_agg(role ORDER BY role) FROM user_roles WHERE user_id=1474 AND revoked_at IS NULL) IS DISTINCT FROM ARRAY['TEMP_WORKER']::text[] THEN
        RAISE EXCEPTION 'expected_unique_temporary_test_account_missing';
    END IF;
    IF EXISTS (SELECT 1 FROM worker_upgrade_requests WHERE user_id=1474 OR iris_id='990202610231474') THEN
        RAISE EXCEPTION 'account_or_iris_already_used';
    END IF;
    IF EXISTS (SELECT 1 FROM worker_test_iris_reservations WHERE iris_id='990202610231474' AND (user_id<>1474 OR consumed_at IS NOT NULL)) THEN
        RAISE EXCEPTION 'reservation_conflict';
    END IF;
END;
$$;
WITH created AS (
    INSERT INTO worker_test_iris_reservations(iris_id,user_id,reason)
    VALUES ('990202610231474',1474,'User-authorized single-use production enrollment test, 2026-10-23; not a biometric registry entry')
    ON CONFLICT(iris_id) DO NOTHING RETURNING user_id
)
INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,decision,reason,metadata)
SELECT NULL,'worker.test_iris.reserve','user',user_id::text,'ALLOWED','explicit_user_requested_test',
       '{"one_time":true,"operator":"codex","credential_changed":false,"role_changed":false}'::jsonb
FROM created;
COMMIT;
SELECT user_id,consumed_at IS NULL AS ready FROM worker_test_iris_reservations WHERE iris_id='990202610231474';

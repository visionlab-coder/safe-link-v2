-- Operator-issued test identifiers are restrictions, never an enrollment bypass.
-- No public API creates reservations; normal consent/site/role checks still apply.
CREATE TABLE worker_test_iris_reservations (
    iris_id TEXT PRIMARY KEY CHECK (iris_id ~ '^[0-9]{1,64}$'),
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_request_id BIGINT,
    CHECK ((consumed_at IS NULL) = (consumed_request_id IS NULL))
);

CREATE FUNCTION enforce_worker_test_iris_reservation() RETURNS trigger AS $$
DECLARE
    reservation worker_test_iris_reservations%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED'
       AND (NEW.iris_id <> OLD.iris_id OR NEW.user_id <> OLD.user_id OR NEW.status <> OLD.status)
       AND EXISTS (SELECT 1 FROM worker_test_iris_reservations WHERE iris_id = OLD.iris_id) THEN
        RAISE EXCEPTION 'test_iris_already_consumed' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO reservation FROM worker_test_iris_reservations
        WHERE iris_id = NEW.iris_id FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF reservation.user_id <> NEW.user_id THEN
        RAISE EXCEPTION 'test_iris_account_mismatch' USING ERRCODE = '23514';
    END IF;
    IF reservation.consumed_at IS NOT NULL THEN
        -- Only non-identity edits of the original approved record are idempotent.
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'test_iris_already_consumed' USING ERRCODE = '23514';
        END IF;
        IF reservation.consumed_request_id <> NEW.id OR OLD.status <> 'APPROVED'
           OR NEW.status <> 'APPROVED' OR OLD.iris_id <> NEW.iris_id OR OLD.user_id <> NEW.user_id THEN
            RAISE EXCEPTION 'test_iris_already_consumed' USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.status = 'APPROVED' THEN
        UPDATE worker_test_iris_reservations
           SET consumed_at = now(), consumed_request_id = NEW.id
         WHERE iris_id = NEW.iris_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER worker_test_iris_reservation_guard
BEFORE INSERT OR UPDATE ON worker_upgrade_requests
FOR EACH ROW EXECUTE FUNCTION enforce_worker_test_iris_reservation();

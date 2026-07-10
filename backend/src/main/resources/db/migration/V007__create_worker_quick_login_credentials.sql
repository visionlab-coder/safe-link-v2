CREATE TABLE worker_quick_login_credentials (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name_initials TEXT NOT NULL,
  phone_last4 TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (name_initials ~ '^[A-Z0-9]{1,6}$'),
  CHECK (phone_last4 ~ '^[0-9]{4}$')
);

CREATE INDEX idx_worker_quick_login_lookup
  ON worker_quick_login_credentials (name_initials, phone_last4)
  WHERE enabled = true;

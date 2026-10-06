-- Explicit nationwide orchestration; each worker still sees only site-scoped records.
CREATE TABLE nationwide_tbm_broadcasts (
    id VARCHAR(100) PRIMARY KEY,
    created_by BIGINT NOT NULL REFERENCES users(id),
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('LIVE', 'NOTICE')),
    state VARCHAR(12) NOT NULL CHECK (state IN ('ACTIVE', 'STOPPED', 'PUBLISHED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE nationwide_tbm_targets (
    broadcast_id VARCHAR(100) NOT NULL REFERENCES nationwide_tbm_broadcasts(id),
    site_id BIGINT NOT NULL REFERENCES sites(id),
    session_id VARCHAR(120) UNIQUE REFERENCES live_broadcast_sessions(session_id),
    tbm_notice_id BIGINT UNIQUE REFERENCES tbm_notices(id),
    PRIMARY KEY (broadcast_id, site_id)
);
CREATE INDEX idx_nationwide_tbm_owner ON nationwide_tbm_broadcasts(created_by, created_at DESC);

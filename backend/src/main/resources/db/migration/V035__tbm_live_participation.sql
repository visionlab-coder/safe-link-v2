CREATE TABLE tbm_live_participation (
    session_id VARCHAR(120) NOT NULL REFERENCES live_broadcast_sessions(session_id),
    worker_id BIGINT NOT NULL REFERENCES users(id),
    site_id BIGINT NOT NULL REFERENCES sites(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, worker_id)
);
CREATE INDEX idx_tbm_live_participation_worker_site ON tbm_live_participation(worker_id, site_id, joined_at DESC);

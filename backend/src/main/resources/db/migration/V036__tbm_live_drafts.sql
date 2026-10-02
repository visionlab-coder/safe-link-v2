CREATE TABLE tbm_live_drafts (
    session_id VARCHAR(120) PRIMARY KEY REFERENCES live_broadcast_sessions(session_id),
    site_id BIGINT NOT NULL REFERENCES sites(id),
    content_ko TEXT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (length(content_ko) <= 60000)
);

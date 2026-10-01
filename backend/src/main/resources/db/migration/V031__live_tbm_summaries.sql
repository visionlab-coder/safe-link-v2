CREATE TABLE live_tbm_summaries (
    session_id VARCHAR(120) PRIMARY KEY REFERENCES live_broadcast_sessions(session_id),
    site_id BIGINT NOT NULL REFERENCES sites(id),
    created_by BIGINT NOT NULL REFERENCES users(id),
    source_transcript TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    model TEXT NOT NULL,
    tbm_notice_id BIGINT NOT NULL UNIQUE REFERENCES tbm_notices(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

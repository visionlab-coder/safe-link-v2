CREATE TABLE chat_presence (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_presence_site_seen ON chat_presence(site_id, last_seen_at DESC);

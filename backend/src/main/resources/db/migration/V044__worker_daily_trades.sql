CREATE TABLE worker_daily_trades (
    worker_id BIGINT NOT NULL REFERENCES users(id),
    site_id BIGINT NOT NULL REFERENCES sites(id),
    work_date DATE NOT NULL,
    trade_types JSONB NOT NULL CHECK (jsonb_typeof(trade_types) = 'array' AND jsonb_array_length(trade_types) BETWEEN 1 AND 16),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (worker_id, site_id, work_date)
);

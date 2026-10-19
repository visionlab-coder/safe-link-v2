-- TBM metadata only. No worker membership or routing/permission changes.
ALTER TABLE tbm_notices ADD COLUMN trade_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE live_broadcast_sessions ADD COLUMN trade_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tbm_notices ADD CONSTRAINT tbm_trade_types_array CHECK (jsonb_typeof(trade_types) = 'array');
ALTER TABLE live_broadcast_sessions ADD CONSTRAINT live_trade_types_array CHECK (jsonb_typeof(trade_types) = 'array');

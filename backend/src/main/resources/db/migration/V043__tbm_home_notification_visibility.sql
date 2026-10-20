-- Presentation-only suppression. Never changes publication, content or acknowledgements.
-- Existing rows remain visible until an explicitly authorized operational update.
alter table tbm_notices add column home_notification_hidden_at timestamptz;
comment on column tbm_notices.home_notification_hidden_at is
    'Hide only the worker home notification; preserve TBM history and signatures.';

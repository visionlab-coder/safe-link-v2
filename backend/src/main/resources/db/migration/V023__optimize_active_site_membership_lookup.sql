CREATE INDEX IF NOT EXISTS idx_site_memberships_active_user
    ON site_memberships (user_id, site_id)
    WHERE status = 'ACTIVE';

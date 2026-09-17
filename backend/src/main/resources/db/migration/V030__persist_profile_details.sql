CREATE TABLE user_profile_details (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active_site_id BIGINT REFERENCES sites(id),
    title TEXT NOT NULL DEFAULT '',
    trade TEXT NOT NULL DEFAULT '',
    phone_number TEXT NOT NULL DEFAULT '',
    site_code TEXT NOT NULL DEFAULT ''
);

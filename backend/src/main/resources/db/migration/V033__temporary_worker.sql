ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('ROOT','HQ_ADMIN','SITE_ADMIN','SAFETY_MANAGER','WORKER','TEMP_WORKER','VIEWER'));
ALTER TABLE site_memberships DROP CONSTRAINT site_memberships_role_check;
ALTER TABLE site_memberships ADD CONSTRAINT site_memberships_role_check CHECK (role IN ('SITE_ADMIN','SAFETY_MANAGER','WORKER','TEMP_WORKER','VIEWER'));

CREATE TABLE temporary_worker_consents (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  site_id BIGINT NOT NULL REFERENCES sites(id),
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

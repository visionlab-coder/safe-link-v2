-- Only execute against the dedicated worker_login_test database, after Flyway startup.
DO $$ BEGIN IF current_database() <> 'worker_login_test' THEN RAISE EXCEPTION 'wrong_database'; END IF; END $$;
INSERT INTO organizations(id,name) VALUES(99001,'Local test only') ON CONFLICT DO NOTHING;
INSERT INTO sites(id,organization_id,name) VALUES(99001,99001,'테스트 교육 현장'),(99002,99001,'테스트 전환 현장') ON CONFLICT DO NOTHING;
INSERT INTO users(id,email,display_name,account_status) VALUES(99001,'worker-login-sponsor@example.invalid','TEST MANAGER','ACTIVE') ON CONFLICT DO NOTHING;
INSERT INTO site_memberships(user_id,site_id,role) VALUES(99001,99001,'SITE_ADMIN') ON CONFLICT DO NOTHING;
INSERT INTO user_roles(user_id,role) SELECT 99001,'SITE_ADMIN' WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=99001 AND role='SITE_ADMIN');
INSERT INTO users(id,phone,display_name,account_status) VALUES(99002,'01000009876','LEGACY TEST','ACTIVE') ON CONFLICT DO NOTHING;
INSERT INTO user_roles(user_id,role) SELECT 99002,'WORKER' WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=99002 AND role='WORKER');
INSERT INTO site_memberships(user_id,site_id,role) VALUES(99002,99001,'WORKER') ON CONFLICT DO NOTHING;
INSERT INTO worker_quick_login_credentials(user_id,name_initials,phone_last4) VALUES(99002,'LEGACY','9876') ON CONFLICT DO NOTHING;
INSERT INTO site_name_localizations(site_id,language,source_name,translated_name) VALUES
 (99001,'en','테스트 교육 현장','Test training site'),(99002,'en','테스트 전환 현장','Test regular-worker site'),
 (99001,'vi','테스트 교육 현장','Công trường đào tạo thử nghiệm'),(99002,'vi','테스트 전환 현장','Công trường chuyển đổi thử nghiệm')
 ON CONFLICT DO NOTHING;

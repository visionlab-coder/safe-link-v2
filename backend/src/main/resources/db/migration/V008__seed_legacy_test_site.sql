INSERT INTO organizations(name)
SELECT '서원건설'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = '서원건설'
);

INSERT INTO sites(organization_id, name, address, status)
SELECT o.id, '임시 테스트현장', '테스트용 현장', 'ACTIVE'
FROM organizations o
WHERE o.name = '서원건설'
  AND NOT EXISTS (
    SELECT 1 FROM sites WHERE name = '임시 테스트현장'
  );

INSERT INTO site_memberships(user_id, site_id, role, status)
SELECT ur.user_id, s.id, 'SITE_ADMIN', 'ACTIVE'
FROM user_roles ur
CROSS JOIN sites s
WHERE s.name = '임시 테스트현장'
  AND s.status = 'ACTIVE'
  AND ur.role = 'SITE_ADMIN'
  AND ur.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM site_memberships sm
    WHERE sm.user_id = ur.user_id
      AND sm.status = 'ACTIVE'
  );

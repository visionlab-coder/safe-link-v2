// Only a new, disposable database named iris_test on loopback. No operational data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const db = new pg.Client({host:'127.0.0.1',port:Number(process.argv[2]),user:'iris_test',password:'local-fixture-only',database:'iris_test'});
await db.connect();
try {
  assert.equal((await db.query('select current_database() name')).rows[0].name,'iris_test');
  assert.equal((await db.query("select to_regclass('public.users') t")).rows[0].t,null,'requires empty disposable DB');
  for (const name of ['V001__create_identity_and_site_core','V005__create_audit_log','V007__create_worker_quick_login_credentials','V033__temporary_worker','V034__worker_upgrade_requests','V040__worker_birth_date_login','V046__reserved_worker_test_iris']) {
    await db.query(readFileSync(new URL(`../backend/src/main/resources/db/migration/${name}.sql`,import.meta.url),'utf8'));
  }
  await db.query("insert into organizations(id,name) values(1,'Fixture'); insert into sites(id,organization_id,name) values(2,1,'Fixture'); insert into users(id,phone,display_name,account_status) values(1474,'01000008011','8011','ACTIVE'),(1475,'01000000002','Other','ACTIVE'); insert into user_roles(user_id,role) values(1474,'TEMP_WORKER'),(1475,'TEMP_WORKER'); insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,birth_date) values(1474,'TEMP','8011','991111')");
  const provision=readFileSync(new URL('./reserve-test-iris-20261023.sql',import.meta.url),'utf8').replace(/^\\set.*$/gm,'');
  await db.query(provision);
  await db.query(provision);
  assert.equal((await db.query("select count(*)::int n from audit_logs where action='worker.test_iris.reserve'")).rows[0].n,1);
  assert.equal((await db.query('select consumed_at from worker_test_iris_reservations')).rows[0].consumed_at,null);
  const insert="insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version) values($1,2,'Fixture','01000008011','990202610231474','test')";
  await assert.rejects(db.query(insert,[1475]),/test_iris_account_mismatch/);
  await db.query('begin');
  await db.query(insert,[1474]);
  await db.query("update worker_upgrade_requests set status='APPROVED',decided_by=1474,verification_method='SELF_REPORTED_IRIS' where user_id=1474");
  await db.query('rollback');
  assert.equal((await db.query('select consumed_at from worker_test_iris_reservations')).rows[0].consumed_at,null);
  await db.query(insert,[1474]);
  await db.query("update worker_upgrade_requests set status='APPROVED',decided_by=1474,verification_method='SELF_REPORTED_IRIS' where user_id=1474");
  assert.ok((await db.query('select consumed_at from worker_test_iris_reservations')).rows[0].consumed_at);
  await assert.rejects(db.query("update worker_upgrade_requests set iris_id='12345' where user_id=1474"),/test_iris_already_consumed/);
  await db.query('delete from worker_upgrade_requests where user_id=1474');
  await assert.rejects(db.query(insert,[1474]),/test_iris_already_consumed/);
  console.log('PASS: migration, guarded/idempotent provisioning, audit, account restriction, rollback, single use and reuse denial after deletion.');
} finally { await db.end(); }

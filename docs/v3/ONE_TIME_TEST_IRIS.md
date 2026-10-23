# One-time test iris reservation — 2026-10-23

## Scope and authorization

The user explicitly requested a single-use test identifier for the existing production
temporary worker login `991111`. Read-only lookup resolved exactly one active account,
user 1474. Do not convert the user, reset credentials, change their site, or submit consent
on their behalf. The user will select a site and complete the normal UI themselves.

Current enrollment accepts a numeric, unused iris identifier for new birth-date accounts;
it does not verify an ERP or biometric registry. A test reservation only **restricts** an
identifier to one account. It does not skip consent, active-site, temporary-role, duplicate
iris or transaction checks. No public provisioning endpoint or universal bypass is added.

## Implementation

- Flyway V046 adds `worker_test_iris_reservations` and a trigger on upgrade requests.
- Other users cannot submit a reserved identifier. Successful approval consumes it in the
  same transaction. A failed transaction restores availability. A consumed identifier
  remains unavailable even if its upgrade record is later deleted. Ordinary identifiers
  keep existing behavior.
- Migrations contain no production account or fixture. After V046, the operator runs
  `scripts/reserve-test-iris-20261023.sql`, guarded to the specified unique temporary
  account and unused identifier. It records an audit event and is safe to retry before use.
- The user stays TEMP_WORKER until their own submission. Existing login credentials stay
  unchanged after conversion. Test with QA site 2 to avoid adding a test user to a work site.

## Verification and rollout

`WorkerUpgradeDatabaseTest` covers another account being denied, failed-site validation,
transaction rollback, successful consumption, unchanged login, duplicate submission,
immutable approved identity and reuse prevention after removal. Existing immediate and
manual enrollment tests run against the same new migration.

Local verification: all 10 `WorkerUpgradeDatabaseTest` cases passed (none skipped).
`node scripts/test-iris-reservation-local.mjs <disposable-db-port>` also passed against a
separate PostgreSQL 16 container, including the exact provisioning script run twice and
a single audit event. Initial Docker/Ryuk detection skips were not counted as verification;
the successful rerun disabled the incompatible local cleanup helper.

Roll out V046 through the normal tested release. Verify migration success, reservation
owner and unused status, and that the production user still has only TEMP_WORKER. Do not
consume the production identifier to test it. No live broadcast or signed record is needed.

Rollback: prior application code is compatible with this additive restriction. Preserve
the table/trigger and consumed records; removing them would make the test identifier
available again. Cancel an unused reservation only with explicit operator approval.

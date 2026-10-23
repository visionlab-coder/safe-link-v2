# Birth-login worker profile setup — 2026-10-23

## Approved change

Birth-date signup workers were blocked by the shared English-name confirmation: their
four-digit display nickname fails English-name validation. The user approved fixing and
deploying this path while leaving legacy English-login workers unchanged. V2's name field
was editable, not a read-only login credential; V3 retains that distinction.

## Behavior and boundaries

- `/api/v1/auth/me` and the profile-save response expose nullable `workerBirthDate` for
  the authenticated self, only for WORKER-only accounts with an enabled birth credential.
  The BFF passes it through. No phone suffix/password is added to the response.
- `/auth/setup` uses this server value, never a numeric display name or query parameter,
  to render a read-only YYMMDD login ID in place of the English-name confirmation.
- These workers select an authorized site ID from `/sites/options`; an empty list blocks
  progression. Optional phone/trade profile fields need not be re-entered for site-only
  changes. The existing stored display name is sent unchanged, not replaced by the ID.
- Existing site authorization and active-site validation in `AuthService` remain in force.
  This changes the active work site among existing memberships, **not** membership transfer
  or arbitrary self-enrollment into a new site. No role, birth credential, password,
  signature or enrollment data is migrated.
- Legacy English-login workers and administrators retain the original name confirmation
  and form flow. Existing 20-language strings are reused; no Korean fallback labels added.

## Verification

- `WorkerUpgradeDatabaseTest`: birth worker changes authorized site with numeric nickname,
  same login credentials and display name; foreign/inactive sites denied; English login
  still works; metadata absent for administrator/legacy accounts.
- `AuthControllerTest`: self metadata returned; a request-supplied birth value cannot
  replace the server-owned login identifier.
- `scripts/test-profile-birth-login-browser.mjs`: mobile layout and 20 languages, read-only
  ID, no name confirmation, site-only payload, rejection/retry, save/reload, empty site
  guard; English confirmation retained; numeric display name alone is not sufficient.
- Existing profile i18n browser/unit suite, TypeScript, ESLint and full backend suite.
  Browser APIs are mocked and database tests use isolated PostgreSQL; no production
  identity/site changes are performed for verification.

### Local result (2026-10-23)

- Full backend suite completed successfully; the database regression class executed
  11 tests with no skips/failures, and the controller class executed 4 tests successfully.
- Both browser suites passed all 20 languages on loopback port 3117; birth-login and
  legacy-login behavior were checked separately. Profile unit tests: 3 passed.
- TypeScript checking and changed-file ESLint completed without errors.

## Deployment

Deploy frontend and backend together through the normal pipeline. No new migration.
Rollback to the preceding release without changing the database. Verify release SHA,
both services, readiness and authentication redirect before reporting completion.

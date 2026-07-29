# SafeLink V3 k6 load tests

These tests cover QA checklist rows 243 and 244 without creating or deleting
production business records. The authenticated workload is read-only.

## Test files

- `smoke.js`: readiness and CSRF bootstrap, one VU and one iteration.
- `authenticated-read.js`: concurrent admin and worker read journeys.
- `pagination.js`: maximum worker/TBM page sizes and chat cursor traversal.

## Install

```bash
brew install k6
k6 version
```

## 1. Public smoke

Local:

```bash
k6 run \
  -e K6_BASE_URL=http://localhost:8080 \
  tests/load/smoke.js
```

Production smoke is only two requests and does not require an account:

```bash
mkdir -p tests/load/results
k6 run \
  -e K6_BASE_URL=https://api.safe-link.co.kr \
  --summary-export=tests/load/results/smoke.json \
  tests/load/smoke.js
```

## 2. Create a local QA account file

```bash
cp tests/load/accounts.example.json tests/load/accounts.local.json
```

Edit `tests/load/accounts.local.json` with dedicated QA accounts. The local file
is ignored by Git. Prefer one account per VU. When fewer accounts are provided,
accounts are reused in round-robin order.

Use an absolute path when passing the file:

```bash
export K6_ACCOUNTS_FILE="/absolute/path/to/safeLink_v3_git/tests/load/accounts.local.json"
```

Do not commit the local account file or paste its contents into a test report.

## 3. Authenticated concurrent-user test

Local baseline, five admins and five workers:

```bash
k6 run \
  -e K6_BASE_URL=http://localhost:8080 \
  -e K6_ACCOUNTS_FILE="$K6_ACCOUNTS_FILE" \
  -e K6_ADMIN_VUS=5 \
  -e K6_WORKER_VUS=5 \
  -e K6_RAMP_DURATION=1m \
  -e K6_HOLD_DURATION=5m \
  tests/load/authenticated-read.js
```

Production execution is blocked unless the approved-window switch is set:

```bash
mkdir -p tests/load/results
k6 run \
  -e K6_BASE_URL=https://api.safe-link.co.kr \
  -e K6_ALLOW_PRODUCTION=true \
  -e K6_ACCOUNTS_FILE="$K6_ACCOUNTS_FILE" \
  -e K6_ADMIN_VUS=10 \
  -e K6_WORKER_VUS=40 \
  -e K6_RAMP_DURATION=2m \
  -e K6_HOLD_DURATION=10m \
  -e K6_THINK_TIME_SECONDS=2 \
  --summary-export=tests/load/results/authenticated-50vu.json \
  tests/load/authenticated-read.js
```

Recommended progression:

1. 1 admin + 1 worker, 1 minute
2. 5 admins + 5 workers, 5 minutes
3. 10 admins + 40 workers, 10 minutes
4. Contracted peak concurrency, 10–15 minutes

Never start the next stage if the previous stage exceeds a threshold or causes
resource saturation.

## 4. Large-list and pagination probe

```bash
k6 run \
  -e K6_BASE_URL=https://api.safe-link.co.kr \
  -e K6_ALLOW_PRODUCTION=true \
  -e K6_ACCOUNTS_FILE="$K6_ACCOUNTS_FILE" \
  --summary-export=tests/load/results/pagination.json \
  tests/load/pagination.js
```

Current API contract limitations:

- workers: at most 200 rows, no page/cursor parameter;
- TBM notices: at most 100 rows, no page/cursor parameter;
- chat messages: cursor traversal is available through `before`.

Therefore the QA requirement for navigating 1,000 worker and TBM rows cannot be
marked PASS until server-side cursor or page pagination is implemented. The k6
probe verifies the current maximum responses and traverses up to 1,000 chat
messages.

## Default PASS thresholds

- HTTP failure rate below 1%
- check success rate above 99%
- overall p95 below 800 ms
- workers/TBM/chat list p95 below 1,000–1,200 ms

Override only after an agreed performance SLO:

```bash
-e K6_MAX_FAILURE_RATE=0.01
-e K6_MIN_CHECK_RATE=0.99
-e K6_P95_MS=800
```

## Production safety controls

- Production authenticated tests require `K6_ALLOW_PRODUCTION=true`.
- Total VUs are capped at 200 by default.
- Raising the cap also requires `K6_ALLOW_HIGH_LOAD=true`.
- The supplied workloads use GET requests after login and do not create TBM,
  chat, signature, worker, or NFC data.
- Watch EC2 CPU/memory, PostgreSQL connections, Redis, nginx 5xx, and backend
  readiness during the run.
- Stop immediately if readiness is not `UP`, 5xx rises, or the server exhausts
  CPU, memory, disk, or DB connections.

## Result interpretation

The process exits nonzero if a threshold fails. In the console and exported JSON
review:

- `http_req_failed`
- `http_req_duration` p(95)
- `checks`
- endpoint-tagged duration metrics
- completed and interrupted iterations

Keep result JSON as QA evidence, but do not include passwords, cookies, or raw
personal data.

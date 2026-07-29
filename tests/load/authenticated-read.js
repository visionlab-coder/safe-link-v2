import http from "k6/http";
import { check, group, sleep } from "k6";
import {
  BASE_URL,
  commonThresholds,
  durationEnv,
  enforceVuSafety,
  integerEnv,
  jsonParams,
  queryString,
  requireProductionApproval,
} from "./lib/config.js";
import {
  ADMIN_ACCOUNTS,
  WORKER_ACCOUNTS,
  accountForVu,
  loginAdmin,
  loginWorker,
  requireAccounts,
} from "./lib/auth.js";

const ADMIN_VUS = integerEnv("K6_ADMIN_VUS", 5, 0, 5000);
const WORKER_VUS = integerEnv("K6_WORKER_VUS", 5, 0, 5000);
const RAMP_DURATION = durationEnv("K6_RAMP_DURATION", "1m");
const HOLD_DURATION = durationEnv("K6_HOLD_DURATION", "5m");
const SLEEP_SECONDS = integerEnv("K6_THINK_TIME_SECONDS", 2, 0, 60);

requireProductionApproval();
enforceVuSafety(ADMIN_VUS + WORKER_VUS);
requireAccounts(ADMIN_VUS, WORKER_VUS);

const scenarios = {};
if (ADMIN_VUS > 0) {
  scenarios.admins = {
    executor: "ramping-vus",
    exec: "adminJourney",
    startVUs: 0,
    stages: [
      { duration: RAMP_DURATION, target: ADMIN_VUS },
      { duration: HOLD_DURATION, target: ADMIN_VUS },
      { duration: RAMP_DURATION, target: 0 },
    ],
    gracefulStop: "30s",
    tags: { role: "admin" },
  };
}
if (WORKER_VUS > 0) {
  scenarios.workers = {
    executor: "ramping-vus",
    exec: "workerJourney",
    startVUs: 0,
    stages: [
      { duration: RAMP_DURATION, target: WORKER_VUS },
      { duration: HOLD_DURATION, target: WORKER_VUS },
      { duration: RAMP_DURATION, target: 0 },
    ],
    gracefulStop: "30s",
    tags: { role: "worker" },
  };
}

export const options = {
  scenarios,
  thresholds: {
    ...commonThresholds(),
    "http_req_duration{name:GET /api/v1/auth/me}": ["p(95)<600"],
    "http_req_duration{name:GET /api/v1/admin/workers}": ["p(95)<1000"],
    "http_req_duration{name:GET /api/v1/tbm/compat/today}": ["p(95)<800"],
    "http_req_duration{name:GET /api/v1/chat/compat/messages}": ["p(95)<1000"],
  },
  tags: { suite: "safelink-authenticated-read" },
};

let adminAuthenticated = false;
let workerAuthenticated = false;

function get(path, name) {
  return http.get(`${BASE_URL}${path}`, jsonParams(name));
}

function verifyJson200(response, label) {
  return check(response, {
    [`${label} is 200`]: (result) => result.status === 200,
    [`${label} is JSON`]: (result) =>
      (result.headers["Content-Type"] || "").includes("application/json"),
  });
}

export function adminJourney() {
  const account = accountForVu(ADMIN_ACCOUNTS);
  if (!adminAuthenticated) {
    loginAdmin(account);
    adminAuthenticated = true;
  }

  group("admin read journey", () => {
    verifyJson200(get("/api/v1/auth/me", "GET /api/v1/auth/me"), "admin me");

    const query = queryString({
      limit: 200,
      active: 1,
      site_id: account.site_id,
    });
    verifyJson200(
      get(`/api/v1/admin/workers?${query}`, "GET /api/v1/admin/workers"),
      "admin workers",
    );

    const noticesQuery = queryString({
      limit: 100,
      site_id: account.site_id,
    });
    verifyJson200(
      get(`/api/v1/tbm/compat/notices?${noticesQuery}`, "GET /api/v1/tbm/compat/notices"),
      "admin TBM notices",
    );

    const peers = get(
      "/api/v1/chat/compat/admin/workers",
      "GET /api/v1/chat/compat/admin/workers",
    );
    if (verifyJson200(peers, "admin chat peers")) {
      const workers = peers.json("workers") || [];
      if (workers.length > 0) {
        const peer = workers[(__ITER + __VU - 1) % workers.length];
        verifyJson200(
          get(
            `/api/v1/chat/compat/messages?peer_id=${encodeURIComponent(peer.id)}&limit=50`,
            "GET /api/v1/chat/compat/messages",
          ),
          "admin chat messages",
        );
      }
    }
  });

  sleep(SLEEP_SECONDS);
}

export function workerJourney() {
  const account = accountForVu(WORKER_ACCOUNTS);
  if (!workerAuthenticated) {
    loginWorker(account);
    workerAuthenticated = true;
  }

  group("worker read journey", () => {
    verifyJson200(get("/api/v1/auth/me", "GET /api/v1/auth/me"), "worker me");
    verifyJson200(
      get("/api/v1/tbm/compat/today?limit=20", "GET /api/v1/tbm/compat/today"),
      "worker TBM today",
    );

    const peers = get(
      "/api/v1/chat/compat/worker/admins",
      "GET /api/v1/chat/compat/worker/admins",
    );
    if (verifyJson200(peers, "worker chat peers")) {
      const admins = peers.json("admins") || [];
      if (admins.length > 0) {
        const peer = admins[(__ITER + __VU - 1) % admins.length];
        verifyJson200(
          get(
            `/api/v1/chat/compat/messages?peer_id=${encodeURIComponent(peer.id)}&limit=50`,
            "GET /api/v1/chat/compat/messages",
          ),
          "worker chat messages",
        );
      }
    }
  });

  sleep(SLEEP_SECONDS);
}
